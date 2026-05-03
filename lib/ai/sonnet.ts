// ============================================================
// lib/ai/sonnet.ts - Wrapper de Claude Sonnet 4.5 para generación
//
// SOPORTA 2 MODOS:
//   1. generateWithSonnet()        → modo legacy sync (compat retro)
//   2. generateWithSonnetStream()  → streaming, con prompt caching opcional
//
// Streaming:
//   Es OBLIGATORIO cuando max_tokens >= 5000 según docs Anthropic.
//   Mantiene el TCP vivo evitando idle timeouts en redes intermedias
//   (firewalls, NAT, proxies). Sin streaming, requests con max_tokens
//   altos pueden recibir 504 antes de completar.
//   Ref: https://platform.claude.com/docs/en/api/errors#long-requests
//
// Prompt caching (Anthropic):
//   Marca con cache_control un bloque del system prompt para que
//   Anthropic lo cachee 5min. Llamadas posteriores con el mismo
//   prefijo facturan input cached a $0.30/Mtok (vs $3/Mtok normal).
//   Coste de creación de cache: $3.75/Mtok (25% recargo, una vez).
//   Útil cuando varias generaciones comparten el mismo system prompt
//   (ejemplo: chunks paralelos del mismo informe).
//   Ref: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

// ---------- TYPES ----------

export interface GenerationRequest {
  /** System prompt (instrucciones permanentes del bot) */
  system: string;
  /** User message (datos específicos de esta llamada) */
  user: string;
  /** Default 16000. Recomendado <=8000 para informes finales. */
  max_tokens?: number;
  /** 0..1, default 0.7. Más alto = más variedad, menos predecible. */
  temperature?: number;
  /**
   * Si true, marca el system prompt como cacheable (cache_control
   * ephemeral). Anthropic cachea ~5min. Solo activar cuando el system
   * sea idéntico entre llamadas (ej. chunks del mismo informe).
   */
  cache_system?: boolean;
}

export interface GenerationResult {
  content: string;
  tokens_in: number;
  tokens_out: number;
  /** Tokens leídos desde cache (precio reducido). */
  tokens_cache_read: number;
  /** Tokens escritos en cache (precio recargado). */
  tokens_cache_write: number;
  model_used: string;
  /** Coste en USD calculado con tarifas Sonnet 4.5 + cache pricing. */
  cost_usd: number;
  duration_ms: number;
  /** stop_reason del modelo: 'end_turn' | 'max_tokens' | etc. */
  stop_reason: string | null;
}

// ---------- PRICING (Sonnet 4.5, USD per million tokens) ----------

const SONNET_45_INPUT_PER_MTOK = 3;
const SONNET_45_OUTPUT_PER_MTOK = 15;
// Cache write: 25% recargo sobre input normal
const SONNET_45_CACHE_WRITE_PER_MTOK = 3.75;
// Cache read: 90% descuento sobre input normal
const SONNET_45_CACHE_READ_PER_MTOK = 0.3;
const MODEL_ID = 'claude-sonnet-4-5-20250929';

// ---------- CLIENT (singleton) ----------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY env var is required');
    }
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Margen de seguridad: 13min en cliente para cubrir Vercel maxDuration 800s.
      // El streaming protege contra idle timeouts intermedios; este timeout es solo
      // para detectar que Anthropic no responde NADA en 13min.
      timeout: 13 * 60 * 1000,
    });
  }
  return _client;
}

// ---------- LEGACY: SYNC GENERATION ----------

/**
 * Modo legacy: messages.create() síncrono.
 *
 * @deprecated Usar generateWithSonnetStream para max_tokens > 5000.
 * Mantenido para compatibilidad retro con generadores existentes
 * mientras se migran progresivamente al patrón chunked.
 */
export async function generateWithSonnet(
  req: GenerationRequest
): Promise<GenerationResult> {
  const start = Date.now();
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: req.max_tokens ?? 16000,
    temperature: req.temperature ?? 0.7,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });

  const content = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return buildResult(start, content, response.usage, response.stop_reason);
}

// ---------- NUEVO: STREAMING + CACHING ----------

/**
 * Modo recomendado para informes largos (max_tokens >= 5000).
 *
 * Usa messages.stream() que mantiene TCP vivo con server-sent events,
 * evitando idle timeouts en redes intermedias durante generaciones largas.
 *
 * Si cache_system=true, marca el system prompt como ephemeral cache.
 * En llamadas paralelas/seriales con mismo system, las posteriores
 * facturan a $0.30/Mtok (cache read) en lugar de $3/Mtok.
 */
export async function generateWithSonnetStream(
  req: GenerationRequest
): Promise<GenerationResult> {
  const start = Date.now();
  const client = getClient();

  // Construir system con o sin cache_control
  const systemBlock = req.cache_system
    ? [
        {
          type: 'text' as const,
          text: req.system,
          cache_control: { type: 'ephemeral' as const },
        },
      ]
    : req.system;

  // Stream API: el SDK acumula los chunks y devuelve el mensaje final
  const stream = client.messages.stream({
    model: MODEL_ID,
    max_tokens: req.max_tokens ?? 8000,
    temperature: req.temperature ?? 0.7,
    system: systemBlock,
    messages: [{ role: 'user', content: req.user }],
  });

  // .finalMessage() bloquea hasta que el stream termina, devolviendo
  // el Message completo con usage y stop_reason. Internamente itera
  // los SSE chunks manteniendo la conexión.
  const finalMessage = await stream.finalMessage();

  const content = finalMessage.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return buildResult(start, content, finalMessage.usage, finalMessage.stop_reason);
}

// ---------- HELPERS ----------

function buildResult(
  start: number,
  content: string,
  usage: Anthropic.Messages.Usage,
  stopReason: string | null
): GenerationResult {
  const tokens_in = usage.input_tokens;
  const tokens_out = usage.output_tokens;
  const tokens_cache_read = usage.cache_read_input_tokens ?? 0;
  const tokens_cache_write = usage.cache_creation_input_tokens ?? 0;

  // Coste = input regular + output + cache write + cache read
  const cost =
    (tokens_in * SONNET_45_INPUT_PER_MTOK +
      tokens_out * SONNET_45_OUTPUT_PER_MTOK +
      tokens_cache_write * SONNET_45_CACHE_WRITE_PER_MTOK +
      tokens_cache_read * SONNET_45_CACHE_READ_PER_MTOK) /
    1_000_000;

  return {
    content,
    tokens_in,
    tokens_out,
    tokens_cache_read,
    tokens_cache_write,
    model_used: MODEL_ID,
    cost_usd: cost,
    duration_ms: Date.now() - start,
    stop_reason: stopReason,
  };
}
