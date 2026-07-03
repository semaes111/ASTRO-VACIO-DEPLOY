/**
 * POST /api/cron/daily-horoscope — Generador del horóscopo diario.
 *
 * Diseño:
 *   - UNA sola llamada a DeepSeek V4 Flash (task 'narrative' via lib/ai/router)
 *     que devuelve un array JSON con las 12 lecturas. Más barato, más rápido
 *     y atómico que 12 llamadas independientes (~$0.002/día).
 *   - Escribe vía la vista pública insertable `astrodorado_daily_readings`
 *     (PostgREST no expone el esquema astrodorado; patrón de la casa).
 *   - Fecha en UTC: misma convención que el lector
 *     (getReadingBySignAndDate default = toISOString().split('T')[0]).
 *   - Idempotente: si el día ya tiene 12 lecturas y no llega ?force=1,
 *     responde already_generated sin regenerar.
 *   - Tras insertar, revalida las 12 páginas /[sign] (ISR 6h) para que el
 *     contenido nuevo sea visible de inmediato.
 *
 * Disparo:
 *   pg_cron 'astrodorado-daily-horoscope' a las 00:05 UTC via net.http_post
 *   con Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (patrón idéntico
 *   al resto de jobs del proyecto).
 *
 * Seguridad:
 *   Bearer debe coincidir con SUPABASE_SERVICE_ROLE_KEY (presente en el
 *   runtime de producción de Vercel; ya lo usan checkout/webhook).
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateForTaskStream } from '@/lib/ai/router';
import { ensureDeepSeekKey } from '@/lib/ai/ensure-deepseek-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Tipos y validación
// ---------------------------------------------------------------------------

interface ZodiacSignRow {
  slug: string;
  name_es: string;
  ruling_planet: string | null;
  element: string | null;
}

interface ReadingGenerated {
  sign: string;
  energy_general: string;
  featured_area: string;
  advice: string;
  dominant_planet: string;
  compatibility: string;
  costar_phrase: string;
  vip_reading: string;
  nivel_amor: number;
  nivel_fortuna: number;
  nivel_salud: number;
  nivel_trabajo: number;
  nivel_energia: number;
  lucky_number: number;
  lucky_color: string;
}

const NIVELES = [
  'nivel_amor',
  'nivel_fortuna',
  'nivel_salud',
  'nivel_trabajo',
  'nivel_energia',
] as const;

function clampNivel(v: unknown): number {
  const n = typeof v === 'number' ? Math.round(v) : Number.parseInt(String(v), 10);
  if (Number.isNaN(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function asReading(raw: unknown, validSlugs: Set<string>): ReadingGenerated | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const sign = String(r.sign ?? '').toLowerCase().trim();
  if (!validSlugs.has(sign)) return null;

  const texto = (k: string, fallback: string): string => {
    const v = r[k];
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;
  };

  const luckyRaw = Number.parseInt(String(r.lucky_number ?? ''), 10);

  return {
    sign,
    energy_general: texto('energy_general', 'Energía en equilibrio.'),
    featured_area: texto('featured_area', 'general'),
    advice: texto('advice', 'Confía en tu intuición.'),
    dominant_planet: texto('dominant_planet', 'Sol'),
    compatibility: texto('compatibility', 'leo'),
    costar_phrase: texto('costar_phrase', 'El cosmos observa.'),
    vip_reading: texto('vip_reading', ''),
    nivel_amor: clampNivel(r.nivel_amor),
    nivel_fortuna: clampNivel(r.nivel_fortuna),
    nivel_salud: clampNivel(r.nivel_salud),
    nivel_trabajo: clampNivel(r.nivel_trabajo),
    nivel_energia: clampNivel(r.nivel_energia),
    lucky_number: Number.isNaN(luckyRaw) ? 7 : Math.min(99, Math.max(1, luckyRaw)),
    lucky_color: texto('lucky_color', 'dorado'),
  };
}

/** Extrae el array JSON aunque el modelo lo envuelva en ```json ... ``` */
function parseJsonArray(content: string): unknown[] {
  const limpio = content
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const inicio = limpio.indexOf('[');
  const fin = limpio.lastIndexOf(']');
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error('La respuesta del modelo no contiene un array JSON');
  }
  const parsed: unknown = JSON.parse(limpio.slice(inicio, fin + 1));
  if (!Array.isArray(parsed)) throw new Error('El JSON parseado no es un array');
  return parsed;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres el astrólogo jefe de AstroDorado, un servicio premium de astrología en español.
Escribes horóscopos diarios con un tono elegante, evocador y directo — nunca genérico ni relleno.
Estilo de referencia para costar_phrase: frases cortas y punzantes al estilo Co-Star.
Respondes EXCLUSIVAMENTE con JSON válido, sin markdown, sin comentarios, sin texto adicional.`;

function buildUserPrompt(fecha: string, signos: ZodiacSignRow[]): string {
  const lista = signos
    .map((s) => `- ${s.slug} (${s.name_es}, regente ${s.ruling_planet ?? '—'}, elemento ${s.element ?? '—'})`)
    .join('\n');

  return `Genera el horóscopo diario del ${fecha} para los 12 signos.

SIGNOS (usa exactamente estos slugs en el campo "sign"):
${lista}

Devuelve un ARRAY JSON de exactamente 12 objetos, uno por signo, con este shape exacto:
{
  "sign": "slug del signo",
  "energy_general": "2-3 frases sobre la energía del día para este signo",
  "featured_area": "una palabra: amor | trabajo | salud | fortuna | creatividad | comunicacion | familia | introspeccion",
  "advice": "1-2 frases de consejo accionable",
  "dominant_planet": "planeta dominante del día para el signo",
  "compatibility": "slug del signo más compatible hoy",
  "costar_phrase": "frase corta y punzante, máximo 12 palabras",
  "vip_reading": "4-6 frases de lectura profunda y personal (versión premium)",
  "nivel_amor": entero 1-5,
  "nivel_fortuna": entero 1-5,
  "nivel_salud": entero 1-5,
  "nivel_trabajo": entero 1-5,
  "nivel_energia": entero 1-5,
  "lucky_number": entero 1-99,
  "lucky_color": "un color en español"
}

Reglas: español de España, sin repetir estructuras entre signos, niveles variados y coherentes con el texto. SOLO el array JSON.`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1) Autenticación: Bearer == service role key (patrón pg_cron de la casa)
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Puente de secreto: carga DEEPSEEK_API_KEY desde Vault si falta en el env
  await ensureDeepSeekKey();

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  // 2) Fecha UTC — misma convención que getReadingBySignAndDate
  const fecha = new Date().toISOString().split('T')[0]!;

  const supabase = createAdminClient();

  // 3) Signos desde la vista pública
  const { data: signosData, error: signosError } = await supabase
    .from('astrodorado_zodiac_signs')
    .select('slug, name_es, ruling_planet, element')
    .order('id', { ascending: true });

  if (signosError || !signosData || signosData.length === 0) {
    return NextResponse.json(
      { error: 'zodiac_signs_unavailable', detail: signosError?.message },
      { status: 500 },
    );
  }
  const signos = signosData as ZodiacSignRow[];
  const validSlugs = new Set(signos.map((s) => s.slug));

  // 4) Idempotencia
  const { count } = await supabase
    .from('astrodorado_daily_readings')
    .select('id', { count: 'exact', head: true })
    .eq('date', fecha);

  if ((count ?? 0) >= signos.length && !force) {
    return NextResponse.json({ status: 'already_generated', date: fecha, readings: count });
  }

  // 5) Generación — UNA llamada para los 12 signos
  // Streaming obligatorio: learning del repo — llamadas no-streaming con
  // max_tokens > 2000 mueren por idle-timeout de red (SSE mantiene TCP vivo).
  const gen = await generateForTaskStream({
    task: 'narrative',
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(fecha, signos),
    max_tokens: 6000,
    temperature: 0.9,
  });

  // 6) Parseo y validación
  const crudos = parseJsonArray(gen.content);
  const lecturas: ReadingGenerated[] = [];
  for (const raw of crudos) {
    const lectura = asReading(raw, validSlugs);
    if (lectura) lecturas.push(lectura);
  }
  const slugsGenerados = new Set(lecturas.map((l) => l.sign));
  const faltantes = signos.filter((s) => !slugsGenerados.has(s.slug)).map((s) => s.slug);
  if (faltantes.length > 0) {
    return NextResponse.json(
      { error: 'incomplete_generation', missing: faltantes, parsed: lecturas.length },
      { status: 502 },
    );
  }

  // 7) Escritura idempotente: limpiar el día y reinsertar
  //    (dos constraints UNIQUE(date,sign) impiden duplicados en cualquier caso)
  const { error: delError } = await supabase
    .from('astrodorado_daily_readings')
    .delete()
    .eq('date', fecha);
  if (delError) {
    return NextResponse.json({ error: 'delete_failed', detail: delError.message }, { status: 500 });
  }

  // Prorrateo documentado: tokens/coste de la llamada única repartidos entre
  // las 12 filas para que SUM() sobre el día devuelva el total real.
  const n = lecturas.length;
  const filas = lecturas.map((l, i) => ({
    date: fecha,
    ...l,
    model_used: gen.model_used,
    tokens_in: Math.round(gen.tokens_in / n) + (i === 0 ? gen.tokens_in % n : 0),
    tokens_out: Math.round(gen.tokens_out / n) + (i === 0 ? gen.tokens_out % n : 0),
    generation_cost_usd: Number((gen.cost_usd / n).toFixed(8)),
  }));

  const { error: insError } = await supabase
    .from('astrodorado_daily_readings')
    .insert(filas);
  if (insError) {
    return NextResponse.json({ error: 'insert_failed', detail: insError.message }, { status: 500 });
  }

  // 8) Revalidación inmediata de las 12 páginas ISR
  for (const s of signos) {
    revalidatePath(`/${s.slug}`);
  }

  return NextResponse.json({
    status: 'generated',
    date: fecha,
    readings: filas.length,
    model_used: gen.model_used,
    tokens_in: gen.tokens_in,
    tokens_out: gen.tokens_out,
    cost_usd: gen.cost_usd,
    duration_ms: gen.duration_ms,
  });
}
