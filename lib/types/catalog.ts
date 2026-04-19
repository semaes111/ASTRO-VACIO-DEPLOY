// Tipos del catalogo Grupo Venus - 4 reinos
// Generado por Fase A del plan Venus. Mantener sincronizado con astrodorado.reports

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

export interface CatalogProduct {
  slug: string;
  name_es: string;
  short_description: string;
  price_eur: number;
  product_type: ProductType;
  category: CategoryId;
  is_bundle: boolean;
  is_active: boolean;
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
}

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

// Constantes de ahorro para cada bundle (ahorro EUR vs suma individuales)
export const BUNDLE_SAVINGS: Record<string, { individuals_eur: number; bundle_eur: number; saving_eur: number; saving_pct: number }> = {
  'oraculo-360':    { individuals_eur: 141, bundle_eur: 99,  saving_eur: 42,  saving_pct: 29.8 },
  'relaciones-360': { individuals_eur: 191, bundle_eur: 99,  saving_eur: 92,  saving_pct: 48.2 },
  'eventos-360':    { individuals_eur: 238, bundle_eur: 89,  saving_eur: 149, saving_pct: 62.6 },
  'negocios-360':   { individuals_eur: 282, bundle_eur: 149, saving_eur: 133, saving_pct: 47.2 },
};