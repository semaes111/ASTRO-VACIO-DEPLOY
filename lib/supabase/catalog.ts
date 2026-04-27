/**
 * `lib/supabase/catalog.ts` — fetch del catálogo desde la DB con cache.
 *
 * Por qué este módulo:
 *   `lib/catalog.ts` es la versión ESTÁTICA (sincronizada manualmente).
 *   Para configuraciones que pueden cambiar sin redeploy (precios,
 *   is_active, is_featured, nuevos productos), el frontend pide a la DB.
 *   Para evitar 30+ fetches por request, cacheamos en memoria con TTL.
 *
 * Patrón:
 *   - Reutiliza la misma técnica que `template-loader.ts`:
 *     · Cache Map<key, {value, expiresAt, hits}>
 *     · Inflight dedup con `Map<key, Promise>`
 *     · TTL configurable por env var
 *
 * Uso:
 *
 *   import { getCatalogFromDB } from '@/lib/supabase/catalog';
 *   const products = await getCatalogFromDB();
 *   // → CatalogProduct[] con todos los productos activos
 *
 *   // Solo uno:
 *   const carta = await getProductFromDB('carta-natal');
 *
 * Cliente: usa `createAdminClient` (service_role) por consistencia con el
 * resto de helpers — funciona en Route Handlers, scripts CLI y Edge Functions.
 *
 * Configuración:
 *   CATALOG_CACHE_TTL_MS — default 5 min (300_000)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CatalogProduct,
  CategoryId,
  RequiredInput,
} from '@/lib/types/catalog';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS ?? 300_000);

const COLUMNS = [
  'slug',
  'name_es',
  'short_description',
  'price_eur',
  'product_type',
  'category',
  'tier',
  'is_bundle',
  'is_active',
  'is_featured',
  'display_order',
  'tagline',
  'theme_slug',
  'primary_color',
  'accent_color',
  'hero_icon',
  'icon_emoji',
  'generator_function',
  'word_count_target',
  'estimated_minutes',
  'has_public_example',
  'required_inputs',
].join(', ');

// ---------------------------------------------------------------------------
// Estado de cache (por proceso)
// ---------------------------------------------------------------------------

interface CacheEntry {
  value: CatalogProduct[];
  expiresAt: number;
  hits: number;
}

let listCache: CacheEntry | null = null;
let listInflight: Promise<CatalogProduct[]> | null = null;

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Devuelve TODOS los productos activos del catálogo, leídos de
 * `public.astrodorado_reports` (que ya filtra `is_active=true`).
 *
 * @param opts.force  Si true, ignora cache y refresca.
 */
export async function getCatalogFromDB(
  opts: { force?: boolean } = {},
): Promise<CatalogProduct[]> {
  const now = Date.now();

  // 1. Cache hit fresco
  if (!opts.force && listCache && listCache.expiresAt > now) {
    listCache.hits += 1;
    return listCache.value;
  }

  // 2. Inflight dedup
  if (listInflight && !opts.force) {
    return listInflight;
  }

  // 3. Fetch real
  listInflight = (async () => {
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('astrodorado_reports')
        .select(COLUMNS)
        .order('display_order', { ascending: true });

      if (error) {
        throw new Error(`getCatalogFromDB: ${error.message}`);
      }

      const products = (data ?? []).map(rowToProduct);
      listCache = {
        value: products,
        expiresAt: Date.now() + TTL_MS,
        hits: 0,
      };
      return products;
    } finally {
      listInflight = null;
    }
  })();

  return listInflight;
}

/**
 * Devuelve un solo producto por slug. Atajo sobre `getCatalogFromDB()`
 * (el cache es compartido — si la lista ya está cargada, no hay segundo fetch).
 */
export async function getProductFromDB(
  slug: string,
): Promise<CatalogProduct | null> {
  if (!slug) return null;
  const products = await getCatalogFromDB();
  return products.find((p) => p.slug === slug) ?? null;
}

/**
 * Devuelve los productos de una categoría concreta. Atajo igual que arriba.
 */
export async function getProductsByCategoryFromDB(
  category: CategoryId,
): Promise<CatalogProduct[]> {
  const products = await getCatalogFromDB();
  return products.filter((p) => p.category === category);
}

/**
 * Invalida el cache. Llamar:
 *   - Después de una migración que altere `astrodorado.reports`
 *   - En tests
 *   - En un endpoint admin después de un cambio manual de precios
 */
export function invalidateCatalogCache(): void {
  listCache = null;
  listInflight = null;
}

/**
 * Stats de cache para health/debug endpoints.
 */
export function getCatalogCacheStats(): {
  cached: boolean;
  hits: number;
  ageMs: number;
  ttlMs: number;
  productCount: number;
} {
  if (!listCache) {
    return {
      cached: false,
      hits: 0,
      ageMs: 0,
      ttlMs: TTL_MS,
      productCount: 0,
    };
  }
  return {
    cached: true,
    hits: listCache.hits,
    ageMs: Date.now() - (listCache.expiresAt - TTL_MS),
    ttlMs: TTL_MS,
    productCount: listCache.value.length,
  };
}

// ---------------------------------------------------------------------------
// Coerción row → CatalogProduct
// ---------------------------------------------------------------------------

/**
 * PostgREST devuelve `numeric` como string ("29.00") y `date` como string ISO.
 * Convertimos a los tipos TS esperados.
 *
 * Si la columna `required_inputs` no es ni array ni string parseable,
 * devolvemos array vacío y logueamos warning — no fallamos.
 */
function rowToProduct(row: Record<string, unknown>): CatalogProduct {
  const priceRaw = row.price_eur;
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : typeof priceRaw === 'string'
        ? Number.parseFloat(priceRaw)
        : 0;

  return {
    slug: String(row.slug),
    name_es: String(row.name_es),
    short_description: String(row.short_description ?? ''),
    price_eur: price,
    product_type: String(row.product_type) as CatalogProduct['product_type'],
    category: String(row.category) as CategoryId,
    tier: String(row.tier) as CatalogProduct['tier'],
    is_bundle: Boolean(row.is_bundle),
    is_active: Boolean(row.is_active),
    is_featured: Boolean(row.is_featured),
    display_order: Number(row.display_order ?? 999),
    tagline: String(row.tagline ?? ''),
    theme_slug: String(row.theme_slug ?? ''),
    primary_color: String(row.primary_color ?? '#000000'),
    accent_color: String(row.accent_color ?? '#FFFFFF'),
    hero_icon: String(row.hero_icon ?? ''),
    icon_emoji: String(row.icon_emoji ?? ''),
    generator_function: String(row.generator_function ?? ''),
    word_count_target: Number(row.word_count_target ?? 5000),
    estimated_minutes: Number(row.estimated_minutes ?? 5),
    has_public_example: Boolean(row.has_public_example),
    required_inputs: parseRequiredInputs(row.required_inputs),
  };
}

function parseRequiredInputs(raw: unknown): RequiredInput[] {
  if (Array.isArray(raw)) return raw as RequiredInput[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as RequiredInput[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
