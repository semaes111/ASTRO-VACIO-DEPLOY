// ============================================================
// lib/catalog.ts — Catálogo maestro (30 productos, sincronizado con DB)
// ============================================================
//
// Esta es la fuente de verdad ESTÁTICA usada para SSR/SSG inmediato sin
// fetch a Supabase. La fuente de verdad RUNTIME es `astrodorado.reports`
// (consumible vía `getCatalogFromDB()` en `lib/supabase/catalog.ts`).
//
// CUÁNDO USAR ESTE ARCHIVO:
//   - SEO meta tags / Open Graph en pages estáticas
//   - Renderizado del catálogo en el primer paint (sin loading state)
//   - Validación de slugs en build time
//
// CUÁNDO USAR LA VERSIÓN DB (`getCatalogFromDB()`):
//   - Precios mostrados al usuario en formularios y carrito (siempre frescos)
//   - Configuraciones que cambian sin redeploy (is_active, is_featured)
//   - Nuevos productos añadidos a DB sin push de código
//
// REGLA: si hay drift entre este archivo y la DB, la DB GANA siempre.
// Cuando se añadan productos nuevos a la DB, regenera este archivo
// ejecutando el SELECT del Paso 10 y volviéndolo a procesar.
//
// Última sincronización: 2026-04-22 — 30 productos
//   · 8 activos:    7 oráculo (carta-natal..oraculo-360) + ayurveda
//   · 22 pre-launch: karma + reinos relaciones/eventos/negocios completos

import type { CatalogProduct, ProductType } from '@/lib/types/catalog';

export const CATALOG: readonly CatalogProduct[] = [
  {
    slug: "carta-natal",
    name_es: "Carta Natal",
    short_description: "Tu mapa astrológico completo: Sol, Luna, Ascendente, 10 planetas y 12 casas interpretados desde la tradición helenística.",
    price_eur: 29.0,
    product_type: "carta_natal",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: true,
    display_order: 1,
    tagline: "La cartografía de tu alma",
    theme_slug: "grimorio-dorado",
    primary_color: "#7a5e0f",
    accent_color: "#d4af37",
    hero_icon: "zodiac-wheel",
    icon_emoji: "☉",
    generator_function: "generate-carta-natal",
    word_count_target: 6000,
    estimated_minutes: 5,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "birth_time",
        "birth_place",
        "full_name"
    ],
  },
  {
    slug: "revolucion-solar",
    name_es: "Revolución Solar",
    short_description: "Predicción anual detallada basada en el retorno del Sol a su posición natal: tema del año, casa regente y tránsitos mes a mes.",
    price_eur: 24.0,
    product_type: "revolucion_solar",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 2,
    tagline: "Tu año personal desde el cumpleaños",
    theme_slug: "sol-louis",
    primary_color: "#c79822",
    accent_color: "#f4c430",
    hero_icon: "sun-crown",
    icon_emoji: "✦",
    generator_function: "generate-revolucion-solar",
    word_count_target: 5000,
    estimated_minutes: 4,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "birth_time",
        "birth_place",
        "full_name",
        "revolution_year"
    ],
  },
  {
    slug: "numerologia",
    name_es: "Numerología",
    short_description: "Análisis pitagórico completo: número de Vida, Expresión, Alma, Personalidad, Destino, años personales y ciclos de 9 años.",
    price_eur: 19.0,
    product_type: "numerologia",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 3,
    tagline: "Las vibraciones de tu nombre y tu fecha",
    theme_slug: "tetraktys",
    primary_color: "#4a2d7a",
    accent_color: "#b89968",
    hero_icon: "tetraktys-pyramid",
    icon_emoji: "△",
    generator_function: "generate-numerologia",
    word_count_target: 4500,
    estimated_minutes: 4,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "full_name"
    ],
  },
  {
    slug: "iching",
    name_es: "I-Ching",
    short_description: "Lectura del Libro de las Mutaciones: tu hexagrama de nacimiento, las 6 líneas interpretadas y el hexagrama mutante.",
    price_eur: 22.0,
    product_type: "iching",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 4,
    tagline: "Tu hexagrama natal y el mutable",
    theme_slug: "bagua-bermellon",
    primary_color: "#c8102e",
    accent_color: "#7d0815",
    hero_icon: "bagua-octagon",
    icon_emoji: "☯",
    generator_function: "generate-iching",
    word_count_target: 5000,
    estimated_minutes: 4,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "birth_time",
        "full_name"
    ],
  },
  {
    slug: "horoscopo-chino",
    name_es: "Horóscopo Chino",
    short_description: "Análisis Bazi completo: tu animal zodiacal, pilares del año, mes, día y hora, balance de los cinco elementos y tus Diez Dioses.",
    price_eur: 22.0,
    product_type: "horoscopo_chino",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 5,
    tagline: "Los cuatro pilares del destino",
    theme_slug: "dragon-imperial",
    primary_color: "#9b1b1b",
    accent_color: "#d4a24c",
    hero_icon: "chinese-dragon",
    icon_emoji: "龍",
    generator_function: "generate-horoscopo-chino",
    word_count_target: 5500,
    estimated_minutes: 5,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "birth_time",
        "birth_place",
        "full_name"
    ],
  },
  {
    slug: "kabbalah",
    name_es: "Kabbalah",
    short_description: "Lectura cabalística con gematría, sefirá regente, ángel personal, tu letra hebrea de poder y tu tikkun del alma.",
    price_eur: 25.0,
    product_type: "kabbalah",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 6,
    tagline: "Tu sendero en el Árbol de la Vida",
    theme_slug: "sefirot-zafiro",
    primary_color: "#1e3a6b",
    accent_color: "#c9a848",
    hero_icon: "tree-of-life",
    icon_emoji: "אל",
    generator_function: "generate-kabbalah",
    word_count_target: 5500,
    estimated_minutes: 5,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "full_name",
        "hebrew_name"
    ],
  },
  {
    slug: "oraculo-360",
    name_es: "Oráculo 360",
    short_description: "El volumen completo de 400+ páginas que reúne los 6 informes individuales más un capítulo exclusivo de síntesis convergente.",
    price_eur: 99.0,
    product_type: "oraculo_360",
    category: "oraculo",
    tier: "paid",
    is_bundle: true,
    is_active: true,
    is_featured: true,
    display_order: 7,
    tagline: "Las seis tradiciones convergen en ti",
    theme_slug: "convergencia-360",
    primary_color: "#7a5e0f",
    accent_color: "#d4af37",
    hero_icon: "mandala-360",
    icon_emoji: "⊕",
    generator_function: "generate-oraculo-360",
    word_count_target: 30000,
    estimated_minutes: 25,
    has_public_example: true,
    required_inputs: [
        "birth_date",
        "birth_time",
        "birth_place",
        "full_name",
        "hebrew_name",
        "revolution_year"
    ],
  },
  {
    slug: "ayurveda",
    name_es: "Carta Ayurvédica",
    short_description: "Tu constitución védica: dosha predominante, nakshatras y ciclos planetarios según el jyotish.",
    price_eur: 27.0,
    product_type: "ayurveda",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: true,
    is_featured: false,
    display_order: 8,
    tagline: "Tu constitución védica revelada",
    theme_slug: "tetraktys-ambar",
    primary_color: "#C2410C",
    accent_color: "#FACC15",
    hero_icon: "🕉",
    icon_emoji: "🕉",
    generator_function: "generate_ayurveda",
    word_count_target: 6500,
    estimated_minutes: 5,
    has_public_example: false,
    required_inputs: [
        {
            "name": "birth_date",
            "type": "date",
            "required": true
        },
        {
            "name": "birth_time",
            "type": "time",
            "required": true
        },
        {
            "name": "birth_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "karma",
    name_es: "Estudio Kármico",
    short_description: "Nodos Lunares, Quirón y Lilith: tu huella de vidas pasadas y la lección de esta encarnación.",
    price_eur: 32.0,
    product_type: "karma",
    category: "oraculo",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 9,
    tagline: "La herida y la misión: tu huella kármica",
    theme_slug: "nodo-lunar-violeta",
    primary_color: "#6B21A8",
    accent_color: "#C4B5FD",
    hero_icon: "☉☽",
    icon_emoji: "⚖",
    generator_function: "generate_karma",
    word_count_target: 7000,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "birth_date",
            "type": "date",
            "required": true
        },
        {
            "name": "birth_time",
            "type": "time",
            "required": true
        },
        {
            "name": "birth_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "pareja-sinastria",
    name_es: "Compatibilidad de Pareja",
    short_description: "Sinastría completa: cómo se entrelazan vuestras cartas natales.",
    price_eur: 39.0,
    product_type: "pareja_sinastria",
    category: "relaciones",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 10,
    tagline: "Lo que dice el cielo cuando os miráis",
    theme_slug: "sinastria-rosa",
    primary_color: "#9F1239",
    accent_color: "#FDA4AF",
    hero_icon: "♀♂",
    icon_emoji: "💞",
    generator_function: "generate_pareja_sinastria",
    word_count_target: 7500,
    estimated_minutes: 7,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "label": "Tu nacimiento",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "label": "Tu pareja",
            "required": true
        }
    ],
  },
  {
    slug: "pareja-destino",
    name_es: "Destino de Pareja",
    short_description: "Vuestra sinastría + carta compuesta + tránsitos compartidos a 10 años.",
    price_eur: 49.0,
    product_type: "pareja_destino",
    category: "relaciones",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 11,
    tagline: "Vuestra historia escrita en los cielos",
    theme_slug: "destino-carmesi",
    primary_color: "#BE123C",
    accent_color: "#F43F5E",
    hero_icon: "∞",
    icon_emoji: "💞",
    generator_function: "generate_pareja_destino",
    word_count_target: 9000,
    estimated_minutes: 9,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "relationship_start",
            "type": "date",
            "label": "Fecha de inicio de la relación (opcional)",
            "required": false
        }
    ],
  },
  {
    slug: "familiar",
    name_es: "Vínculo Familiar",
    short_description: "Análisis astrológico del vínculo entre dos miembros de la familia.",
    price_eur: 39.0,
    product_type: "familiar",
    category: "relaciones",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 12,
    tagline: "Los hilos invisibles que os unen",
    theme_slug: "lazos-familia",
    primary_color: "#BE185D",
    accent_color: "#FBCFE8",
    hero_icon: "⚭",
    icon_emoji: "👨‍👩‍👧",
    generator_function: "generate_familiar",
    word_count_target: 7000,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "relationship_type",
            "type": "select",
            "options": [
                "padre-hijo",
                "madre-hijo",
                "hermanos",
                "abuelos-nietos",
                "otros"
            ],
            "required": true
        }
    ],
  },
  {
    slug: "kamasutra-astro",
    name_es: "Kamasutra Astro-Ayurvédico",
    short_description: "Vuestra química íntima: Venus, Marte, los 5 elementos y los doshas.",
    price_eur: 35.0,
    product_type: "kamasutra_astro",
    category: "relaciones",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 13,
    tagline: "La química que el cielo os dio",
    theme_slug: "tantra-dorado",
    primary_color: "#B91C1C",
    accent_color: "#FCA5A5",
    hero_icon: "𖤐",
    icon_emoji: "🔥",
    generator_function: "generate_kamasutra_astro",
    word_count_target: 6500,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        }
    ],
  },
  {
    slug: "amistad-karmica",
    name_es: "Amistad Kármica",
    short_description: "La verdad astrológica detrás de una amistad profunda.",
    price_eur: 29.0,
    product_type: "amistad_karmica",
    category: "relaciones",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 14,
    tagline: "Los amigos que el alma reconoce",
    theme_slug: "alma-amiga",
    primary_color: "#A21CAF",
    accent_color: "#F0ABFC",
    hero_icon: "☽☽",
    icon_emoji: "🤝",
    generator_function: "generate_amistad_karmica",
    word_count_target: 6000,
    estimated_minutes: 5,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        }
    ],
  },
  {
    slug: "evento-boda",
    name_es: "Boda (Muhurta)",
    short_description: "La fecha óptima para vuestra unión. Astrología electiva clásica.",
    price_eur: 45.0,
    product_type: "evento_boda",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 15,
    tagline: "El sí que el cielo bendice",
    theme_slug: "muhurta-ceremonial",
    primary_color: "#9A3412",
    accent_color: "#FDBA74",
    hero_icon: "☿♀",
    icon_emoji: "💍",
    generator_function: "generate_evento_boda",
    word_count_target: 7500,
    estimated_minutes: 7,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "event_date",
            "type": "date",
            "required": true
        },
        {
            "name": "event_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "evento-firma-juicio",
    name_es: "Firma o Juicio",
    short_description: "Día y hora óptimos para firmar contratos o afrontar trámites legales.",
    price_eur: 39.0,
    product_type: "evento_firma_juicio",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 16,
    tagline: "La palabra que tiene peso en los cielos",
    theme_slug: "tribunal-justicia",
    primary_color: "#7C2D12",
    accent_color: "#FED7AA",
    hero_icon: "♃♄",
    icon_emoji: "⚖",
    generator_function: "generate_evento_firma_juicio",
    word_count_target: 7000,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "event_date",
            "type": "date",
            "required": true
        },
        {
            "name": "event_place",
            "type": "text",
            "required": true
        },
        {
            "name": "event_subtype",
            "type": "select",
            "options": [
                "firma_notarial",
                "juicio",
                "contrato",
                "declaracion"
            ],
            "required": true
        }
    ],
  },
  {
    slug: "evento-inmueble",
    name_es: "Compra de Inmueble",
    short_description: "Astrología de la casa: ¿te conviene este hogar? ¿cuándo firmar?",
    price_eur: 42.0,
    product_type: "evento_inmueble",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 17,
    tagline: "El hogar que el alma reconoce",
    theme_slug: "hogar-tierra",
    primary_color: "#854D0E",
    accent_color: "#FDE047",
    hero_icon: "☄",
    icon_emoji: "🏡",
    generator_function: "generate_evento_inmueble",
    word_count_target: 7000,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "property_address",
            "type": "text",
            "required": true
        },
        {
            "name": "purchase_date_target",
            "type": "date",
            "required": true
        },
        {
            "name": "construction_date",
            "type": "date",
            "required": false
        }
    ],
  },
  {
    slug: "evento-vehiculo",
    name_es: "Compra de Vehículo",
    short_description: "Día y hora propicios para comprar o matricular tu vehículo.",
    price_eur: 29.0,
    product_type: "evento_vehiculo",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 18,
    tagline: "El camino que se abre contigo",
    theme_slug: "viento-camino",
    primary_color: "#92400E",
    accent_color: "#FED7AA",
    hero_icon: "♂☿",
    icon_emoji: "🚗",
    generator_function: "generate_evento_vehiculo",
    word_count_target: 5500,
    estimated_minutes: 4,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "vehicle_type",
            "type": "select",
            "options": [
                "coche",
                "moto",
                "barco",
                "otro"
            ],
            "required": true
        },
        {
            "name": "purchase_date_target",
            "type": "date",
            "required": true
        }
    ],
  },
  {
    slug: "evento-viaje",
    name_es: "Viaje",
    short_description: "Fechas propicias de partida y regreso + astrología del destino.",
    price_eur: 29.0,
    product_type: "evento_viaje",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 19,
    tagline: "El destino que el cielo te prepara",
    theme_slug: "ruta-cosmica",
    primary_color: "#A16207",
    accent_color: "#FEF08A",
    hero_icon: "♄☿",
    icon_emoji: "✈",
    generator_function: "generate_evento_viaje",
    word_count_target: 5500,
    estimated_minutes: 4,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "destination",
            "type": "text",
            "required": true
        },
        {
            "name": "departure_date",
            "type": "date",
            "required": true
        },
        {
            "name": "return_date",
            "type": "date",
            "required": false
        }
    ],
  },
  {
    slug: "evento-mudanza",
    name_es: "Mudanza",
    short_description: "El momento adecuado para dejar una casa y entrar en otra.",
    price_eur: 29.0,
    product_type: "evento_mudanza",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 20,
    tagline: "Cerrar y abrir puertas en armonía",
    theme_slug: "hogar-nuevo",
    primary_color: "#B45309",
    accent_color: "#FDBA74",
    hero_icon: "♂♃",
    icon_emoji: "📦",
    generator_function: "generate_evento_mudanza",
    word_count_target: 5500,
    estimated_minutes: 4,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "current_address",
            "type": "text",
            "required": true
        },
        {
            "name": "new_address",
            "type": "text",
            "required": true
        },
        {
            "name": "move_date_target",
            "type": "date",
            "required": true
        }
    ],
  },
  {
    slug: "evento-ritual",
    name_es: "Ritual Iniciático",
    short_description: "Momento óptimo para un ritual importante: iniciación, boda espiritual, votos.",
    price_eur: 35.0,
    product_type: "evento_ritual",
    category: "eventos",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 21,
    tagline: "El instante en que el Cielo y la Tierra se dan la mano",
    theme_slug: "ritual-iniciatico",
    primary_color: "#7E22CE",
    accent_color: "#D8B4FE",
    hero_icon: "☉☽",
    icon_emoji: "🔱",
    generator_function: "generate_evento_ritual",
    word_count_target: 6500,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "ritual_type",
            "type": "text",
            "required": true
        },
        {
            "name": "ritual_date_target",
            "type": "date",
            "required": true
        },
        {
            "name": "ritual_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "neg-carta-empresa",
    name_es: "Carta de la Empresa",
    short_description: "La identidad astrológica de tu negocio según su fecha de constitución.",
    price_eur: 59.0,
    product_type: "neg_carta_empresa",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 22,
    tagline: "La identidad cósmica de tu empresa",
    theme_slug: "corporate-ambar",
    primary_color: "#78350F",
    accent_color: "#FCD34D",
    hero_icon: "♃",
    icon_emoji: "🏛",
    generator_function: "generate_neg_carta_empresa",
    word_count_target: 8500,
    estimated_minutes: 8,
    has_public_example: false,
    required_inputs: [
        {
            "name": "company_name",
            "type": "text",
            "required": true
        },
        {
            "name": "founding_date",
            "type": "date",
            "required": true
        },
        {
            "name": "founding_time",
            "type": "time",
            "required": false
        },
        {
            "name": "founding_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "neg-socios",
    name_es: "Compatibilidad de Socios",
    short_description: "Sinastría entre socios: alineación, fricciones y complementariedad.",
    price_eur: 49.0,
    product_type: "neg_socios",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 23,
    tagline: "Los socios que el cielo aprueba",
    theme_slug: "sinastria-empresarial",
    primary_color: "#854D0E",
    accent_color: "#FDE68A",
    hero_icon: "♄♃",
    icon_emoji: "🤝",
    generator_function: "generate_neg_socios",
    word_count_target: 7500,
    estimated_minutes: 7,
    has_public_example: false,
    required_inputs: [
        {
            "name": "partner_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "partner_2",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "partner_3",
            "type": "natal_chart",
            "required": false
        },
        {
            "name": "business_context",
            "type": "text",
            "label": "Descripción del negocio",
            "required": true
        }
    ],
  },
  {
    slug: "neg-inicio-proyecto",
    name_es: "Inicio de Proyecto",
    short_description: "Momento óptimo para lanzar tu nuevo proyecto o producto al mercado.",
    price_eur: 45.0,
    product_type: "neg_inicio_proyecto",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 24,
    tagline: "El cielo decide cuándo es ahora",
    theme_slug: "lanzamiento-astro",
    primary_color: "#92400E",
    accent_color: "#FCD34D",
    hero_icon: "☉♃",
    icon_emoji: "🚀",
    generator_function: "generate_neg_inicio_proyecto",
    word_count_target: 7000,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "project_type",
            "type": "text",
            "required": true
        },
        {
            "name": "target_launch_date",
            "type": "date",
            "required": true
        },
        {
            "name": "project_description",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "neg-financiero-anual",
    name_es: "Análisis Financiero Anual",
    short_description: "Revolución Solar enfocada en el ciclo financiero y empresarial del año.",
    price_eur: 55.0,
    product_type: "neg_financiero_anual",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 25,
    tagline: "La brújula financiera del próximo año",
    theme_slug: "predictivo-financiero",
    primary_color: "#7C2D12",
    accent_color: "#FBBF24",
    hero_icon: "♃♄",
    icon_emoji: "📈",
    generator_function: "generate_neg_financiero_anual",
    word_count_target: 8000,
    estimated_minutes: 7,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "target_year",
            "type": "integer",
            "required": true
        },
        {
            "name": "business_context",
            "type": "text",
            "required": false
        }
    ],
  },
  {
    slug: "neg-contratacion",
    name_es: "Contratación Clave",
    short_description: "Sinastría empresarial para decisiones de contratación estratégica.",
    price_eur: 39.0,
    product_type: "neg_contratacion",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 26,
    tagline: "La persona que el cielo te presenta",
    theme_slug: "hires-astro",
    primary_color: "#A16207",
    accent_color: "#FEF08A",
    hero_icon: "☿♄",
    icon_emoji: "👔",
    generator_function: "generate_neg_contratacion",
    word_count_target: 6500,
    estimated_minutes: 6,
    has_public_example: false,
    required_inputs: [
        {
            "name": "founder",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "candidate",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "role",
            "type": "text",
            "required": true
        },
        {
            "name": "company_founding",
            "type": "date",
            "required": false
        }
    ],
  },
  {
    slug: "neg-marca-timing",
    name_es: "Timing de Marca",
    short_description: "Fechas óptimas para hitos de marca: rebrand, lanzamiento, campañas.",
    price_eur: 35.0,
    product_type: "neg_marca_timing",
    category: "negocios",
    tier: "paid",
    is_bundle: false,
    is_active: false,
    is_featured: false,
    display_order: 27,
    tagline: "El instante que hace visible tu marca",
    theme_slug: "marca-zodiaco",
    primary_color: "#B45309",
    accent_color: "#FDE047",
    hero_icon: "☿♀",
    icon_emoji: "✨",
    generator_function: "generate_neg_marca_timing",
    word_count_target: 6000,
    estimated_minutes: 5,
    has_public_example: false,
    required_inputs: [
        {
            "name": "company_founding",
            "type": "date",
            "required": true
        },
        {
            "name": "action_type",
            "type": "select",
            "options": [
                "rebrand",
                "campaña",
                "apertura",
                "evento",
                "cambio_visual"
            ],
            "required": true
        },
        {
            "name": "target_period",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "relaciones-360",
    name_es: "Relaciones 360",
    short_description: "El análisis de pareja más completo: los 5 informes convergiendo en un volumen.",
    price_eur: 99.0,
    product_type: "relaciones_360",
    category: "relaciones",
    tier: "paid",
    is_bundle: true,
    is_active: false,
    is_featured: true,
    display_order: 28,
    tagline: "Vuestra historia cósmica completa",
    theme_slug: "destino-carmesi-premium",
    primary_color: "#9F1239",
    accent_color: "#FDA4AF",
    hero_icon: "∞",
    icon_emoji: "💞",
    generator_function: "generate_relaciones_360",
    word_count_target: 22000,
    estimated_minutes: 15,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "relationship_start",
            "type": "date",
            "required": false
        }
    ],
  },
  {
    slug: "eventos-360",
    name_es: "Eventos 360",
    short_description: "El análisis de evento más completo: boda, inmueble, viaje o ritual al máximo detalle.",
    price_eur: 89.0,
    product_type: "eventos_360",
    category: "eventos",
    tier: "paid",
    is_bundle: true,
    is_active: false,
    is_featured: true,
    display_order: 29,
    tagline: "El instante supremo analizado",
    theme_slug: "muhurta-supremo",
    primary_color: "#7C2D12",
    accent_color: "#FDBA74",
    hero_icon: "☉☽",
    icon_emoji: "⚜",
    generator_function: "generate_eventos_360",
    word_count_target: 20000,
    estimated_minutes: 13,
    has_public_example: false,
    required_inputs: [
        {
            "name": "person_1",
            "type": "natal_chart",
            "required": true
        },
        {
            "name": "person_2",
            "type": "natal_chart",
            "required": false
        },
        {
            "name": "event_type",
            "type": "select",
            "options": [
                "boda",
                "inmueble",
                "firma",
                "vehiculo",
                "viaje",
                "mudanza",
                "ritual",
                "otro"
            ],
            "required": true
        },
        {
            "name": "event_date",
            "type": "date",
            "required": true
        },
        {
            "name": "event_place",
            "type": "text",
            "required": true
        }
    ],
  },
  {
    slug: "negocios-360",
    name_es: "Negocios 360",
    short_description: "El análisis empresarial más completo: la carta de la empresa y sus socios convergiendo.",
    price_eur: 149.0,
    product_type: "negocios_360",
    category: "negocios",
    tier: "paid",
    is_bundle: true,
    is_active: false,
    is_featured: true,
    display_order: 30,
    tagline: "El destino empresarial decodificado",
    theme_slug: "oro-empresarial",
    primary_color: "#78350F",
    accent_color: "#FBBF24",
    hero_icon: "♃♄",
    icon_emoji: "👑",
    generator_function: "generate_negocios_360",
    word_count_target: 25000,
    estimated_minutes: 18,
    has_public_example: false,
    required_inputs: [
        {
            "name": "company_name",
            "type": "text",
            "required": true
        },
        {
            "name": "founding_date",
            "type": "date",
            "required": true
        },
        {
            "name": "founding_time",
            "type": "time",
            "required": false
        },
        {
            "name": "founding_place",
            "type": "text",
            "required": true
        },
        {
            "max": 5,
            "min": 1,
            "name": "partners",
            "type": "natal_chart_array",
            "required": true
        }
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Selectores
// ---------------------------------------------------------------------------

/** Devuelve el producto con ese slug, o `undefined` si no existe. */
export function getCatalogProduct(slug: string): CatalogProduct | undefined {
  return CATALOG.find((p) => p.slug === slug);
}

/** Devuelve el producto con ese product_type, o `undefined`. */
export function getCatalogProductByType(
  productType: ProductType,
): CatalogProduct | undefined {
  return CATALOG.find((p) => p.product_type === productType);
}

/**
 * Devuelve solo los productos `is_active=true`. Util para menús públicos
 * y endpoints comerciales — los pre-launch no deben ser visibles al cliente.
 */
export function getActiveCatalogProducts(): readonly CatalogProduct[] {
  return CATALOG.filter((p) => p.is_active);
}

/** Devuelve todos los productos `is_featured=true`, en su display_order. */
export function getFeaturedCatalogProducts(): readonly CatalogProduct[] {
  return CATALOG.filter((p) => p.is_featured && p.is_active);
}

/** Devuelve los productos de una categoría concreta. */
export function getCatalogProductsByCategory(
  category: CatalogProduct['category'],
): readonly CatalogProduct[] {
  return CATALOG.filter((p) => p.category === category);
}

/** Devuelve solo los bundles. */
export function getBundleProducts(): readonly CatalogProduct[] {
  return CATALOG.filter((p) => p.is_bundle);
}

// ---------------------------------------------------------------------------
// Compatibilidad legacy (no romper imports existentes)
// ---------------------------------------------------------------------------

/**
 * @deprecated Importar desde `@/lib/types/catalog` (BUNDLE_SAVINGS).
 * Mantenido aquí para no romper imports existentes en componentes legacy.
 */
export const ORACULO_360_SAVINGS = 42;

/**
 * @deprecated Importar desde `@/lib/types/catalog` (BUNDLE_SAVINGS).
 */
export const ORACULO_360_SUM_INDIVIDUAL = 141;

/**
 * @deprecated Importar `ProductType` desde `@/lib/types/catalog`.
 * Re-export para no romper imports antiguos como
 * `import { ProductType } from '@/lib/catalog'`.
 */
export type { ProductType } from '@/lib/types/catalog';
