// ============================================================
// lib/ai/deepseek.ts - Wrapper de DeepSeek V4 Flash para generación
//
// SOPORTA 2 MODOS (misma firma que sonnet.ts para drop-in replacement):
//   1. generateWithDeepSeek()        → sync (drop-in para legacy)
//   2. generateWithDeepSeekStream()  → streaming (recomendado, chunked)
//
// Streaming:
//   Aunque DeepSeek no requiere streaming para max_tokens altos como
//   Anthropic, lo usamos para mantener TCP vivo y consistencia con
//   sonnet.ts. La firma es idéntica, así que los generadores no notan
//   la diferencia.
//
// Prompt caching (DeepSeek):
//   AUTOMÁTICO basado en disco. Cuando una request comparte prefijo
//   con una request previa reciente, DeepSeek detecta el match y
//   factura el prefijo a precio reducido (cache hit). NO requiere
//   marcar el bloque con cache_control como Anthropic.
//
//   El response.usage devuelve:
//     - prompt_cache_hit_tokens: tokens que ya estaban cacheados
//     - prompt_cache_miss_tokens: tokens nuevos (= cache write implícito)
//
//   Patrón ideal: 6 chunks paralelos con MISMO system → 1 cache miss
//   en la primera, 5 cache hits en las siguientes a $0.003/Mtok.
//
// Modelo: deepseek-v4-flash
//   - 1M context window
//   - 384K max output (no nos preocupa truncamiento)
//   - $0.14/Mtok input miss, $0.003/Mtok input hit, $0.28/Mtok output
//   - OpenAI-compatible API (usamos SDK 'openai')
//
// Ref: https://api-docs.deepseek.com/quick_start/pricing
// ============================================================

import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';

// ---------- TYPES (misma firma que sonnet.ts) ----------

export interface GenerationRequest {
  /** System prompt (instrucciones permanentes del bot) */
  system: string;
  /** User message (datos específicos de esta llamada) */
  user: string;
  /** Default 8000. V4 Flash soporta hasta 384k pero no necesitamos. */
  max_tokens?: number;
  /** 0..1, default 0.7. */
  temperature?: number;
  /**
   * Compat con sonnet.ts. En DeepSeek el caching es AUTOMÁTICO,
   * este flag se ignora pero se acepta para misma firma. Si en el
   * futuro DeepSeek expone control manual, usaremos este flag.
   */
  cache_system?: boolean;
}

export interface GenerationResult {
  content: string;
  tokens_in: number;
  tokens_out: number;
  /** Tokens leídos desde cache (cache hit, precio reducido $0.003/Mtok). */
  tokens_cache_read: number;
  /**
   * Tokens escritos en cache (cache miss). En DeepSeek esto es implícito:
   * todos los tokens nuevos potencialmente cacheables. NO hay recargo
   * adicional como en Anthropic — se factura al precio normal de input.
   * Mantenemos el campo para shape compatible con GenerationResult.
   */
  tokens_cache_write: number;
  model_used: string;
  /** Coste en USD calculado con tarifas DeepSeek V4 Flash. */
  cost_usd: number;
  duration_ms: number;
  /** stop_reason: 'stop' | 'length' | 'content_filter' | etc. */
  stop_reason: string | null;
}

// ---------- PRICING (DeepSeek V4 Flash, USD per million tokens) ----------
// Verificado contra https://api-docs.deepseek.com/quick_start/pricing
// el 2026-05-07. Ajustar si DeepSeek modifica tarifas.

const V4_FLASH_INPUT_MISS_PER_MTOK = 0.14;
const V4_FLASH_INPUT_HIT_PER_MTOK = 0.003;
const V4_FLASH_OUTPUT_PER_MTOK = 0.28;

/**
 * Modelo activo. Apuntamos directamente a v4-flash en vez de deepseek-chat
 * porque deepseek-chat es alias legacy programado para deprecación
 * el 2026-07-24. Migración futureproof.
 */
const MODEL_ID = 'deepseek-v4-flash';

// ---------- CLIENT (singleton) ----------

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY env var is required');
    }
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
      // 13min: igual que sonnet.ts. Streaming protege idle timeout
      // intermedio; este timeout es solo para detectar API muerta.
      timeout: 13 * 60 * 1000,
    });
  }
  return _client;
}

// ---------- LEGACY: SYNC GENERATION ----------

/**
 * Modo legacy: chat.completions.create() síncrono.
 *
 * Drop-in replacement para generateWithSonnet(). Misma firma, mismo shape
 * de respuesta. Los generadores que lo usan (ayurveda, evento-mudanza)
 * solo cambian el import.
 */
export async function generateWithDeepSeek(
  req: GenerationRequest,
): Promise<GenerationResult> {
  const start = Date.now();
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL_ID,
    max_tokens: req.max_tokens ?? 8000,
    temperature: req.temperature ?? 0.7,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    stream: false,
  });

  return buildResultFromCompletion(start, response);
}

// ---------- NUEVO: STREAMING ----------

/**
 * Modo streaming. Drop-in replacement para generateWithSonnetStream().
 *
 * Mantiene TCP vivo durante la generación con server-sent events.
 * Acumula los chunks en cliente y devuelve el resultado final con usage.
 */
export async function generateWithDeepSeekStream(
  req: GenerationRequest,
): Promise<GenerationResult> {
  const start = Date.now();
  const client = getClient();

  const stream = await client.chat.completions.create({
    model: MODEL_ID,
    max_tokens: req.max_tokens ?? 8000,
    temperature: req.temperature ?? 0.7,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
    stream: true,
    // include_usage: true asegura que el chunk final incluya usage stats
    // (DeepSeek lo soporta como OpenAI-compatible)
    stream_options: { include_usage: true },
  });

  // Acumular content y capturar el último chunk con usage
  let fullContent = '';
  let stopReason: string | null = null;
  let finalUsage: ChatCompletionChunk['usage'] = undefined;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (delta?.content) {
      fullContent += delta.content;
    }
    const finishReason = chunk.choices[0]?.finish_reason;
    if (finishReason) {
      stopReason = finishReason;
    }
    // El chunk con usage llega después del último chunk con content.
    // Solo el último chunk (con choices vacío y stream_options.include_usage)
    // tiene usage poblado.
    if (chunk.usage) {
      finalUsage = chunk.usage;
    }
  }

  if (!finalUsage) {
    // Edge case: DeepSeek devolvió stream sin usage final. Estimamos
    // 0 cache para no romper, pero loggeamos. Esto NO debería pasar
    // si include_usage:true funciona correctamente.
    console.warn('[deepseek] stream sin usage final; estimando 0 cache');
    finalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
  }

  return buildResultFromUsage(start, fullContent, finalUsage, stopReason);
}

// ---------- HELPERS ----------

function buildResultFromCompletion(
  start: number,
  response: ChatCompletion,
): GenerationResult {
  const choice = response.choices[0];
  if (!choice) {
    throw new Error('[deepseek] respuesta sin choices');
  }
  const content = choice.message.content ?? '';
  const stopReason = choice.finish_reason ?? null;
  return buildResultFromUsage(start, content, response.usage, stopReason);
}

function buildResultFromUsage(
  start: number,
  content: string,
  usage:
    | { prompt_tokens?: number; completion_tokens?: number; [k: string]: unknown }
    | null
    | undefined,
  stopReason: string | null,
): GenerationResult {
  const promptTokens = (usage?.prompt_tokens as number | undefined) ?? 0;
  const completionTokens =
    (usage?.completion_tokens as number | undefined) ?? 0;
  // Campos específicos DeepSeek (no en spec OpenAI estándar)
  const cacheHit =
    (usage?.prompt_cache_hit_tokens as number | undefined) ?? 0;
  const cacheMiss =
    (usage?.prompt_cache_miss_tokens as number | undefined) ?? 0;

  // Si DeepSeek no devuelve los campos cache_*, todos los tokens van
  // como miss (sin caching). En la práctica, V4 Flash siempre los
  // devuelve gracias al implicit caching.
  const tokens_in = promptTokens;
  const tokens_out = completionTokens;
  const tokens_cache_read = cacheHit;
  // tokens_cache_write en DeepSeek = miss (input no cacheado).
  // Lo guardamos en el shape de GenerationResult para compat con sonnet.
  const tokens_cache_write = cacheMiss;

  // Si los campos cache no están, asumir 100% miss (peor caso, conservador)
  const effectiveMiss = cacheMiss > 0 ? cacheMiss : tokens_in - cacheHit;

  // Coste = miss × $0.14 + hit × $0.003 + output × $0.28 (todos /1M)
  const cost =
    (effectiveMiss * V4_FLASH_INPUT_MISS_PER_MTOK +
      cacheHit * V4_FLASH_INPUT_HIT_PER_MTOK +
      tokens_out * V4_FLASH_OUTPUT_PER_MTOK) /
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
