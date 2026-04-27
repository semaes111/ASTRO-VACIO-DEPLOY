/**
 * Template Loader — caché en memoria de templates HTML.
 *
 * Motivación:
 *   Los templates HTML pesan 50-500 KB. Un worker típico tarda 10-30s en
 *   generar un informe con Claude Sonnet. Cargar el template desde Supabase
 *   en cada llamada añade 100-300ms de latencia innecesaria.
 *   Este módulo los mantiene en memoria durante la vida del proceso Next.js,
 *   con una política LRU simple y TTL para evitar stale data post-ingesta.
 *
 * Uso:
 *
 *   import { loadTemplate } from '@/lib/generators/_shared/template-loader';
 *
 *   const template = await loadTemplate('evento-vehiculo');
 *   // → ReportTemplateRow con html_template y data_schema listos para el prompt
 *
 * Invariantes:
 *   - NO devuelve templates inactivos (la view ya filtra).
 *   - NO lanza si no existe: devuelve null. El worker decide cómo manejarlo.
 *   - Cache-aside: si dos requests piden el mismo slug a la vez, solo una
 *     llega a Supabase; el resto espera la misma promesa.
 *   - La cache es por proceso, no global — en Vercel serverless cada función
 *     tiene su propio warmup. En VPS/Dokploy (un solo proceso Next) es
 *     efectiva de verdad.
 *
 * Configuración:
 *   TEMPLATE_CACHE_TTL_MS   — default 10 min (600_000)
 *   TEMPLATE_CACHE_MAX_SIZE — default 30 slugs
 */
import { getActiveTemplate } from '@/lib/supabase/report-templates';
import type { ReportTemplateRow } from '@/lib/types/report-templates';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const TTL_MS = Number(process.env.TEMPLATE_CACHE_TTL_MS ?? 600_000);
const MAX_SIZE = Number(process.env.TEMPLATE_CACHE_MAX_SIZE ?? 30);

interface CacheEntry {
  value: ReportTemplateRow;
  expiresAt: number;
  hits: number;
}

// ---------------------------------------------------------------------------
// Estado (por proceso)
// ---------------------------------------------------------------------------

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ReportTemplateRow | null>>();

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Carga un template activo del slug. Usa cache si hay hit fresco. Si hay
 * miss o expired, consulta Supabase. Si dos llamadas concurrentes piden el
 * mismo slug, comparten la misma promesa (cache-aside pattern).
 *
 * @param slug   ID único del producto (ej: "evento-vehiculo").
 * @param opts.force  Si true, ignora la cache y refresca desde Supabase.
 * @returns La fila del template, o `null` si el slug no tiene template activo.
 */
export async function loadTemplate(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<ReportTemplateRow | null> {
  if (!slug) {
    throw new Error('loadTemplate: slug requerido');
  }

  const now = Date.now();

  // 1) Cache hit fresco
  if (!opts.force) {
    const entry = cache.get(slug);
    if (entry && entry.expiresAt > now) {
      entry.hits += 1;
      return entry.value;
    }
  }

  // 2) Hay una llamada concurrente en vuelo → esperarla
  const pending = inflight.get(slug);
  if (pending && !opts.force) {
    return pending;
  }

  // 3) Lanzamos fetch real
  const promise = (async () => {
    try {
      const value = await getActiveTemplate(slug);
      if (value) {
        writeCache(slug, value);
      } else {
        // Miss en DB: no cachear. Evitamos caché negativa para no esconder
        // ingestas recientes (el worker verá el null y fallará con claridad).
        cache.delete(slug);
      }
      return value;
    } finally {
      inflight.delete(slug);
    }
  })();

  inflight.set(slug, promise);
  return promise;
}

/**
 * Invalida una entrada concreta. Usar después de ingestar una nueva versión
 * del template desde un script CLI, o desde un hook post-upsert.
 */
export function invalidateTemplate(slug: string): void {
  cache.delete(slug);
}

/**
 * Vacía toda la cache. Útil en tests y en una llamada de diagnóstico
 * administrativa.
 */
export function clearTemplateCache(): void {
  cache.clear();
  inflight.clear();
}

/**
 * Estadísticas de la cache — sirven para endpoints de health/debug.
 */
export function getTemplateCacheStats(): {
  size: number;
  maxSize: number;
  ttlMs: number;
  entries: Array<{ slug: string; hits: number; ageMs: number }>;
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([slug, entry]) => ({
    slug,
    hits: entry.hits,
    ageMs: now - (entry.expiresAt - TTL_MS),
  }));
  return {
    size: cache.size,
    maxSize: MAX_SIZE,
    ttlMs: TTL_MS,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Escribe una entrada en la cache aplicando política LRU si se supera el
 * límite. Implementación O(n) pero aceptable porque MAX_SIZE es pequeño
 * (< 50 slugs típicamente).
 */
function writeCache(slug: string, value: ReportTemplateRow): void {
  if (cache.size >= MAX_SIZE && !cache.has(slug)) {
    // Evict la entrada con menos hits. Empate: la más antigua.
    let evictSlug: string | null = null;
    let minHits = Number.POSITIVE_INFINITY;
    let minExpiresAt = Number.POSITIVE_INFINITY;
    for (const [k, v] of cache.entries()) {
      if (v.hits < minHits || (v.hits === minHits && v.expiresAt < minExpiresAt)) {
        minHits = v.hits;
        minExpiresAt = v.expiresAt;
        evictSlug = k;
      }
    }
    if (evictSlug) cache.delete(evictSlug);
  }

  cache.set(slug, {
    value,
    expiresAt: Date.now() + TTL_MS,
    hits: 0,
  });
}
