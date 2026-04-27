// Tipos del catálogo Grupo Venus — 4 reinos
// Sincronizado con astrodorado.reports (30 productos a 22 abr 2026).
// Si el esquema de DB cambia, actualiza este archivo ANTES que cualquier consumidor.

export type CategoryId = 'oraculo' | 'relaciones' | 'eventos' | 'negocios';

export type ProductType =
  // Reino Oraculo
  | 'carta_natal'
  | 'revolucion_solar'
  | 'numerologia'
  | 'iching'
  | 'horoscopo_chino'
  | 'kabbalah'
  | 'ayurveda'
  | 'karma'
  | 'oraculo_360'
  // Reino Relaciones
  | 'pareja_sinastria'
  | 'pareja_destino'
  | 'familiar'
  | 'kamasutra_astro'
  | 'amistad_karmica'
  | 'relaciones_360'
  // Reino Eventos
  | 'evento_boda'
  | 'evento_firma_juicio'
  | 'evento_inmueble'
  | 'evento_vehiculo'
  | 'evento_viaje'
  | 'evento_mudanza'
  | 'evento_ritual'
  | 'eventos_360'
  // Reino Negocios
  | 'neg_carta_empresa'
  | 'neg_socios'
  | 'neg_inicio_proyecto'
  | 'neg_financiero_anual'
  | 'neg_contratacion'
  | 'neg_marca_timing'
  | 'negocios_360';

/** Tier del producto en la matriz comercial. Por ahora todos son `paid`. */
export type ProductTier = 'free' | 'paid';

// ---------------------------------------------------------------------------
// required_inputs — shape mixto en DB
// ---------------------------------------------------------------------------
// Hay dos formatos histtóricamente coexistentes en astrodorado.reports.required_inputs:
//
//   1. Legacy (los 7 productos del Reino Oráculo originales):
//        ["birth_date", "birth_time", "birth_place", "full_name"]
//
//   2. Nuevo (Ayurveda + 22 productos pre-launch):
//        [{ "name": "birth_date", "type": "date", "required": true }, ...]
//
// El consumidor (form builder, validación, route handler) debe manejar los
// dos casos. Para evitar logica defensiva repetida, exportamos un narrower:
// `normalizeRequiredInputs()`.

/** Forma legacy: solo el nombre del input. */
export type RequiredInputLegacy = string;

/** Forma nueva: objeto descriptivo con tipo y constraints. */
export interface RequiredInputObject {
  name: string;
  /**
   * Tipo del input. Coincide con tipos del frontend de formulario:
   *   - 'date', 'time', 'datetime': pickers temporales
   *   - 'text', 'integer', 'select': inputs primitivos
   *   - 'natal_chart': sub-formulario completo (date+time+place)
   *   - 'natal_chart_array': múltiples natal_charts (ej: socios)
   */
  type:
    | 'date'
    | 'time'
    | 'datetime'
    | 'text'
    | 'integer'
    | 'select'
    | 'natal_chart'
    | 'natal_chart_array';
  required: boolean;
  /** Etiqueta opcional para mostrar al usuario */
  label?: string;
  /** Para `type='select'` */
  options?: string[];
  /** Para `type='natal_chart_array'` */
  min?: number;
  max?: number;
}

export type RequiredInput = RequiredInputLegacy | RequiredInputObject;

/**
 * Normaliza required_inputs a la forma objeto, da igual de qué shape venga.
 * Útil para form builders que esperan siempre objetos.
 *
 * Para entradas legacy (string), infiere `type` heurísticamente:
 *   "birth_date" / "*_date" / "*_year"  → 'date' / 'integer'
 *   "birth_time" / "*_time"             → 'time'
 *   "birth_place" / "*_address"         → 'text'
 *   resto                               → 'text'
 */
export function normalizeRequiredInputs(
  inputs: RequiredInput[],
): RequiredInputObject[] {
  return inputs.map((it) => {
    if (typeof it === 'object') return it;
    return {
      name: it,
      type: inferTypeFromLegacyName(it),
      required: true,
    };
  });
}

function inferTypeFromLegacyName(name: string): RequiredInputObject['type'] {
  const lower = name.toLowerCase();
  if (lower.endsWith('_year')) return 'integer';
  if (lower.endsWith('_date') || lower === 'birth_date') return 'date';
  if (lower.endsWith('_time') || lower === 'birth_time') return 'time';
  return 'text';
}

// ---------------------------------------------------------------------------
// Categoría visual (los 4 reinos del Grupo Venus)
// ---------------------------------------------------------------------------

export interface CatalogCategory {
  id: CategoryId;
  name_es: string;
  tagline: string;
  description: string;
  primary_color: string;
  accent_color: string;
  hero_icon: string;
  input_schema_label: string;
  display_order: number;
}

// ---------------------------------------------------------------------------
// Producto del catálogo (1:1 con astrodorado.reports)
// ---------------------------------------------------------------------------

export interface CatalogProduct {
  slug: string;
  name_es: string;
  short_description: string;
  price_eur: number;
  product_type: ProductType;
  category: CategoryId;
  tier: ProductTier;
  is_bundle: boolean;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  tagline: string;
  theme_slug: string;
  primary_color: string;
  accent_color: string;
  hero_icon: string;
  icon_emoji: string;
  generator_function: string;
  word_count_target: number;
  estimated_minutes: number;
  has_public_example: boolean;
  required_inputs: RequiredInput[];
}

// ---------------------------------------------------------------------------
// Categorías (estáticas — la BD no las almacena, son metadata visual)
// ---------------------------------------------------------------------------

export const CATEGORIES: Record<CategoryId, CatalogCategory> = {
  oraculo: {
    id: 'oraculo',
    name_es: 'Oráculo',
    tagline: 'Descubre quién eres',
    description: 'Los informes del reino del autoconocimiento: tu carta natal y las 8 tradiciones que revelan tu identidad cósmica.',
    primary_color: '#7F77DD',
    accent_color: '#C4B5FD',
    hero_icon: '🔮',
    input_schema_label: 'Tus datos de nacimiento',
    display_order: 1,
  },
  relaciones: {
    id: 'relaciones',
    name_es: 'Relaciones',
    tagline: 'Con quién te complementas',
    description: 'Sinastría completa entre dos personas: pareja, familia, amistad y vínculos kármicos.',
    primary_color: '#D4537E',
    accent_color: '#F4C0D1',
    hero_icon: '💞',
    input_schema_label: 'Dos personas',
    display_order: 2,
  },
  eventos: {
    id: 'eventos',
    name_es: 'Eventos',
    tagline: 'Cuándo actuar',
    description: 'Astrología electiva (muhurta): la hora óptima para bodas, firmas, viajes y decisiones importantes.',
    primary_color: '#D85A30',
    accent_color: '#F5C4B3',
    hero_icon: '⚜',
    input_schema_label: 'Evento + fecha + lugar',
    display_order: 3,
  },
  negocios: {
    id: 'negocios',
    name_es: 'Negocios',
    tagline: 'Cómo prosperar',
    description: 'Astrología empresarial: carta de la empresa, compatibilidad de socios y timing estratégico.',
    primary_color: '#BA7517',
    accent_color: '#FAC775',
    hero_icon: '👑',
    input_schema_label: 'Empresa + socios',
    display_order: 4,
  },
};

// ---------------------------------------------------------------------------
// Bundles — savings calculados (sincronizado con la DB)
// ---------------------------------------------------------------------------

export interface BundleSaving {
  individuals_eur: number;
  bundle_eur: number;
  saving_eur: number;
  saving_pct: number;
}

export const BUNDLE_SAVINGS: Record<string, BundleSaving> = {
  'oraculo-360':    { individuals_eur: 141, bundle_eur: 99,  saving_eur: 42,  saving_pct: 29.8 },
  'relaciones-360': { individuals_eur: 191, bundle_eur: 99,  saving_eur: 92,  saving_pct: 48.2 },
  'eventos-360':    { individuals_eur: 238, bundle_eur: 89,  saving_eur: 149, saving_pct: 62.6 },
  'negocios-360':   { individuals_eur: 282, bundle_eur: 149, saving_eur: 133, saving_pct: 47.2 },
};
