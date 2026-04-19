/**
 * Cálculo de Prakriti (constitución ayurvédica) desde carta natal sidérea.
 *
 * En Ayurveda védica, los 3 doshas (Vata, Pitta, Kapha) describen tendencias
 * físicas y mentales. Se heredan del momento de concepción/nacimiento y se
 * leen de la posición de los planetas en signos y nakshatras.
 *
 * Metodología (fuente: "Ayurvedic Astrology" de David Frawley):
 *  - Cada planeta tiene una dosha intrínseca
 *  - Cada signo tiene una dosha dominante
 *  - Cada nakshatra tiene una dosha dominante
 *  - Se suman pesos por planeta y se normaliza
 *  - La Luna pondera más (constitución mental)
 *  - El Ascendente pondera más (constitución física)
 */

import type { NatalChart } from '@/lib/astronomy/planets';
import type { ZodiacSlug } from '@/lib/types/astrodorado';
import { NAKSHATRAS, type Dosha } from './nakshatras';

// ============================================================
// Tablas de doshas (tradición clásica)
// ============================================================

// Dosha dominante por signo zodiacal sidéreo
const SIGN_DOSHA: Record<ZodiacSlug, Dosha> = {
  aries: 'Pitta',
  tauro: 'Kapha',
  geminis: 'Vata',
  cancer: 'Kapha',
  leo: 'Pitta',
  virgo: 'Vata',
  libra: 'Vata',
  escorpio: 'Pitta',
  sagitario: 'Pitta',
  capricornio: 'Vata',
  acuario: 'Vata',
  piscis: 'Kapha',
};

// Dosha intrínseca de cada graha (planeta védico)
const PLANET_DOSHA: Record<string, Dosha> = {
  sun: 'Pitta',
  moon: 'Kapha',       // Luna llena = Kapha, Luna nueva = Vata. Default Kapha
  mercury: 'Vata',     // tri-dosha pero Vata predomina
  venus: 'Kapha',
  mars: 'Pitta',
  jupiter: 'Kapha',
  saturn: 'Vata',
  rahu: 'Vata',
  ketu: 'Pitta',
};

// ============================================================
// Cálculo
// ============================================================

export interface PrakritiResult {
  vata: number;   // 0-100 (% del total)
  pitta: number;
  kapha: number;
  dominant: Dosha;
  secondary: Dosha;
  constitution_label: string;  // ej: "Vata-Pitta"
  description_es: string;
}

interface PlanetDoshaContribution {
  planet: string;
  weight: number;
  doshas: Dosha[];
}

function contributionsOf(
  planet: string,
  sign: ZodiacSlug,
  nakshatraIndex: number | null,
  weight: number,
): PlanetDoshaContribution {
  const doshas: Dosha[] = [];
  // 1. Dosha del signo donde está (todos los 12 signos están cubiertos)
  doshas.push(SIGN_DOSHA[sign]);
  // 2. Dosha intrínseca del planeta (todos cubiertos)
  const planetDosha = PLANET_DOSHA[planet];
  if (planetDosha) {
    doshas.push(planetDosha);
  }
  // 3. Dosha del nakshatra (solo para Luna, validamos rango)
  if (nakshatraIndex !== null && nakshatraIndex >= 0 && nakshatraIndex < NAKSHATRAS.length) {
    doshas.push(NAKSHATRAS[nakshatraIndex]!.dosha);
  }
  return { planet, weight, doshas };
}

export function calculatePrakriti(chart: NatalChart): PrakritiResult {
  const contributions: PlanetDoshaContribution[] = [
    // Luna: el factor más importante en Jyotish — peso 2.5
    contributionsOf('moon', chart.moon.sign_sidereal, chart.moon.nakshatra.index, 2.5),
    // Ascendente: peso 2 (físico)
    ...(chart.ascendant
      ? [contributionsOf('ascendant', chart.ascendant.sign_sidereal, null, 2.0)]
      : []),
    // Sol: peso 1.5 (identidad)
    contributionsOf('sun', chart.sun.sign_sidereal, null, 1.5),
    // Resto de planetas: peso 1
    contributionsOf('mercury', chart.mercury.sign_sidereal, null, 1.0),
    contributionsOf('venus', chart.venus.sign_sidereal, null, 1.0),
    contributionsOf('mars', chart.mars.sign_sidereal, null, 1.0),
    contributionsOf('jupiter', chart.jupiter.sign_sidereal, null, 1.0),
    contributionsOf('saturn', chart.saturn.sign_sidereal, null, 1.0),
    // Rahu/Ketu: peso 0.5 (puntos sombra)
    contributionsOf('rahu', chart.rahu.sign_sidereal, null, 0.5),
    contributionsOf('ketu', chart.ketu.sign_sidereal, null, 0.5),
  ];

  const scores = { Vata: 0, Pitta: 0, Kapha: 0 };
  for (const c of contributions) {
    const perDosha = c.weight / c.doshas.length;
    for (const d of c.doshas) {
      scores[d] += perDosha;
    }
  }
  const total = scores.Vata + scores.Pitta + scores.Kapha;
  const vata = Math.round((scores.Vata / total) * 100);
  const pitta = Math.round((scores.Pitta / total) * 100);
  const kapha = 100 - vata - pitta; // evitar drift por redondeo

  const unsortedPairs: [Dosha, number][] = [
    ['Vata', vata],
    ['Pitta', pitta],
    ['Kapha', kapha],
  ];
  const sorted = unsortedPairs.sort((a, b) => b[1] - a[1]);

  // sorted siempre tiene exactamente 3 elementos (lo construimos arriba)
  const first = sorted[0]!;
  const second = sorted[1]!;
  const dominant = first[0];
  const secondary = second[0];
  const gap = first[1] - second[1];

  let constitution_label: string;
  if (gap < 8) {
    constitution_label = `${dominant}-${secondary}`;
  } else {
    constitution_label = `${dominant} dominante`;
  }

  const description_es = buildDescription(vata, pitta, kapha, dominant, secondary, gap);

  return { vata, pitta, kapha, dominant, secondary, constitution_label, description_es };
}

function buildDescription(
  v: number, p: number, k: number,
  dominant: Dosha, secondary: Dosha, gap: number,
): string {
  const parts: string[] = [];
  parts.push(`Tu constitución es ${v}% Vata, ${p}% Pitta y ${k}% Kapha. `);
  if (gap < 8) {
    parts.push(`Eres una naturaleza ${dominant}-${secondary} (ambas doshas comparten la dominancia). `);
  } else {
    parts.push(`${dominant} es tu dosha claramente dominante. `);
  }
  const doshaTraits: Record<Dosha, string> = {
    Vata: 'Te mueve el aire y el éter: inquietud creativa, mente rápida, cuerpo seco y ágil.',
    Pitta: 'Te mueve el fuego: determinación, calor digestivo fuerte, carisma magnético.',
    Kapha: 'Te mueve la tierra y el agua: estabilidad, dulzura, memoria profunda.',
  };
  parts.push(doshaTraits[dominant]);
  return parts.join('');
}
