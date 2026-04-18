// ============================================================
// lib/catalog.ts - Catalogo maestro de los 7 productos
// ============================================================

export type ProductType =
  | 'carta_natal'
  | 'revolucion_solar'
  | 'numerologia'
  | 'iching'
  | 'horoscopo_chino'
  | 'kabbalah'
  | 'oraculo_360';

export interface CatalogProduct {
  slug: string;
  product_type: ProductType;
  tier: 'paid';
  name_es: string;
  tagline: string;
  short_description: string;
  long_description?: string;
  price_eur: number;
  theme_slug: string;
  primary_color: string;
  accent_color: string;
  hero_icon: string;
  word_count_target: number;
  ai_model: string;
  estimated_minutes: number;
  has_public_example: boolean;
  category: string;
  icon_emoji: string;
  is_featured: boolean;
  display_order: number;
  required_inputs: string[];
}

// Catalogo estatico (hardcode). La BD es la fuente de verdad runtime,
// pero esto permite render inmediato del catalogo sin fetch.
export const CATALOG: CatalogProduct[] = [
  {
    slug: 'carta-natal',
    product_type: 'carta_natal',
    tier: 'paid',
    name_es: 'Carta Natal',
    tagline: 'La cartografia de tu alma',
    short_description: 'Tu mapa astrologico completo: Sol, Luna, Ascendente, 10 planetas y 12 casas.',
    price_eur: 29,
    theme_slug: 'grimorio-dorado',
    primary_color: '#7a5e0f',
    accent_color: '#d4af37',
    hero_icon: 'zodiac-wheel',
    word_count_target: 6000,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 5,
    has_public_example: true,
    category: 'astrologia',
    icon_emoji: 'S',
    is_featured: true,
    display_order: 1,
    required_inputs: ['birth_date', 'birth_time', 'birth_place', 'full_name'],
  },
  {
    slug: 'revolucion-solar',
    product_type: 'revolucion_solar',
    tier: 'paid',
    name_es: 'Revolucion Solar',
    tagline: 'Tu ano personal desde el cumpleanos',
    short_description: 'Prediccion anual detallada basada en el retorno del Sol a su posicion natal.',
    price_eur: 24,
    theme_slug: 'sol-louis',
    primary_color: '#c79822',
    accent_color: '#f4c430',
    hero_icon: 'sun-crown',
    word_count_target: 5000,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 4,
    has_public_example: true,
    category: 'astrologia',
    icon_emoji: 'V',
    is_featured: false,
    display_order: 2,
    required_inputs: ['birth_date', 'birth_time', 'birth_place', 'full_name', 'revolution_year'],
  },
  {
    slug: 'numerologia',
    product_type: 'numerologia',
    tier: 'paid',
    name_es: 'Numerologia',
    tagline: 'Las vibraciones de tu nombre y tu fecha',
    short_description: 'Analisis pitagorico completo: numeros de Vida, Expresion, Alma, Personalidad, Destino.',
    price_eur: 19,
    theme_slug: 'tetraktys',
    primary_color: '#4a2d7a',
    accent_color: '#b89968',
    hero_icon: 'tetraktys-pyramid',
    word_count_target: 4500,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 4,
    has_public_example: true,
    category: 'numerologia',
    icon_emoji: 'T',
    is_featured: false,
    display_order: 3,
    required_inputs: ['birth_date', 'full_name'],
  },
  {
    slug: 'iching',
    product_type: 'iching',
    tier: 'paid',
    name_es: 'I-Ching',
    tagline: 'Tu hexagrama natal y el mutable',
    short_description: 'Lectura del Libro de las Mutaciones: hexagrama natal, 6 lineas interpretadas y hexagrama mutable.',
    price_eur: 22,
    theme_slug: 'bagua-bermellon',
    primary_color: '#c8102e',
    accent_color: '#7d0815',
    hero_icon: 'bagua-octagon',
    word_count_target: 5000,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 4,
    has_public_example: true,
    category: 'adivinatoria',
    icon_emoji: 'I',
    is_featured: false,
    display_order: 4,
    required_inputs: ['birth_date', 'birth_time', 'full_name'],
  },
  {
    slug: 'horoscopo-chino',
    product_type: 'horoscopo_chino',
    tier: 'paid',
    name_es: 'Horoscopo Chino',
    tagline: 'Los cuatro pilares del destino',
    short_description: 'Analisis Bazi completo: pilares del ano, mes, dia y hora, balance de los 5 elementos.',
    price_eur: 22,
    theme_slug: 'dragon-imperial',
    primary_color: '#9b1b1b',
    accent_color: '#d4a24c',
    hero_icon: 'chinese-dragon',
    word_count_target: 5500,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 5,
    has_public_example: true,
    category: 'oriental',
    icon_emoji: 'C',
    is_featured: false,
    display_order: 5,
    required_inputs: ['birth_date', 'birth_time', 'birth_place', 'full_name'],
  },
  {
    slug: 'kabbalah',
    product_type: 'kabbalah',
    tier: 'paid',
    name_es: 'Kabbalah',
    tagline: 'Tu sendero en el Arbol de la Vida',
    short_description: 'Lectura cabalistica con gematria, sefira regente, angel personal y tu tikkun del alma.',
    price_eur: 25,
    theme_slug: 'sefirot-zafiro',
    primary_color: '#1e3a6b',
    accent_color: '#c9a848',
    hero_icon: 'tree-of-life',
    word_count_target: 5500,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 5,
    has_public_example: true,
    category: 'mistica',
    icon_emoji: 'K',
    is_featured: false,
    display_order: 6,
    required_inputs: ['birth_date', 'full_name', 'hebrew_name'],
  },
  {
    slug: 'oraculo-360',
    product_type: 'oraculo_360',
    tier: 'paid',
    name_es: 'Oraculo 360',
    tagline: 'Las seis tradiciones convergen en ti',
    short_description: 'El volumen completo de 400+ paginas que reune los 6 informes + capitulo exclusivo de sintesis.',
    price_eur: 99,
    theme_slug: 'convergencia-360',
    primary_color: '#7a5e0f',
    accent_color: '#d4af37',
    hero_icon: 'mandala-360',
    word_count_target: 30000,
    ai_model: 'claude-sonnet-4-5-20250929',
    estimated_minutes: 25,
    has_public_example: true,
    category: 'premium',
    icon_emoji: 'O',
    is_featured: true,
    display_order: 7,
    required_inputs: ['birth_date', 'birth_time', 'birth_place', 'full_name', 'hebrew_name'],
  },
];

export const getCatalogProduct = (slug: string): CatalogProduct | undefined =>
  CATALOG.find((p) => p.slug === slug);

export const getCatalogProductByType = (productType: ProductType): CatalogProduct | undefined =>
  CATALOG.find((p) => p.product_type === productType);

export const ORACULO_360_SAVINGS = 42; // EUR de ahorro vs 141 EUR suma individuales (29.8 pct)
export const ORACULO_360_SUM_INDIVIDUAL = 141; // EUR suma de los 6 sueltos
