// ============================================================
// lib/demo-character.ts - Alma Suarez Montes (personaje publico demo)
// Usado en /ejemplos/[productType] para que los visitantes vean
// ejemplos completos sin necesidad de comprar.
// ============================================================

export const DEMO_CHARACTER = {
  id: '87e1eb01-3302-c54b-8979-c58ec03e1f42',
  full_name: 'Alma Suarez Montes',
  display_name: 'Alma',
  pronoun: 'ella',
  birth_date: '1985-03-15',
  birth_time: '07:30',
  birth_place: 'Madrid, Espana',
  birth_lat: 40.4168,
  birth_lon: -3.7038,
  birth_year: 1985,
  birth_year_chinese: 'Buey de Madera',
  hebrew_name: 'Nishama Sarah',
  narrative_hook: 'Doctora de 40 anos que siente una llamada profunda hacia la psicologia y las tradiciones misticas. Buscando entender por que siente que esta en el lugar equivocado profesionalmente.',
  astro: {
    sun_sign: 'piscis',
    sun_degree: 24.8,
    moon_sign: 'cancer',
    moon_degree: 12.3,
    rising_sign: 'capricornio',
    rising_degree: 8.7,
    dominant_element: 'agua',
    dominant_modality: 'mutable',
  },
} as const;

export type DemoCharacter = typeof DEMO_CHARACTER;
