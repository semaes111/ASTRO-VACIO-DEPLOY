/**
 * Algoritmo Vimshottari Dasha — sistema de ciclos planetarios védicos.
 *
 * Fuente: Brihat Parashara Hora Shastra, cap. 46.
 *
 * Idea central: la vida humana se divide en 9 mahadashas (períodos planetarios)
 * que suman 120 años. La secuencia y duración es fija; lo que varía es el
 * planeta con el que arranca tu vida, determinado por el nakshatra donde
 * estaba la Luna al nacer.
 *
 * Cada mahadasha se subdivide en 9 antardashas (sub-períodos) con las mismas
 * proporciones del ciclo completo.
 */

export interface DashaPeriod {
  planet: string;
  years: number;
  start: Date;
  end: Date;
}

export interface DashaSnapshot {
  mahadasha: DashaPeriod & { progress_pct: number; years_remaining: number };
  antardasha: DashaPeriod & { progress_pct: number; days_remaining: number };
  full_timeline: DashaPeriod[];  // los 9 mahadashas de la vida (120 años)
  birth_moon_dasha_lord: string;
  years_consumed_at_birth: number;
  fraction_of_nakshatra_consumed: number;
}

// ============================================================
// Datos del sistema Vimshottari (orden cíclico y duraciones)
// ============================================================
const VIMSHOTTARI_ORDER = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];

const VIMSHOTTARI_YEARS: Record<string, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

// ============================================================
// Cálculo
// ============================================================

/**
 * Calcula la cadena de 9 mahadashas a partir de los datos lunares natales.
 * @param birthDate fecha/hora de nacimiento UTC
 * @param moonNakshatraDashaLord planeta regente del nakshatra donde está la Luna natal
 * @param degreeWithinNakshatra grados dentro del nakshatra (0-13.333)
 */
function buildTimeline(
  birthDate: Date,
  moonNakshatraDashaLord: string,
  degreeWithinNakshatra: number,
): { timeline: DashaPeriod[]; yearsConsumedAtBirth: number; fraction: number } {
  const nakshatraSize = 360 / 27; // 13.333333
  const fraction = degreeWithinNakshatra / nakshatraSize; // 0..1

  const startIdx = VIMSHOTTARI_ORDER.indexOf(moonNakshatraDashaLord);
  if (startIdx === -1) {
    throw new Error(`Planeta no válido para Vimshottari: ${moonNakshatraDashaLord}`);
  }

  const yearsOfFirstDasha = VIMSHOTTARI_YEARS[moonNakshatraDashaLord]!;
  const yearsConsumedAtBirth = fraction * yearsOfFirstDasha;

  // Fecha teórica en la que comenzó el primer mahadasha
  const firstDashaStart = new Date(birthDate.getTime() - yearsConsumedAtBirth * YEAR_MS);

  const timeline: DashaPeriod[] = [];
  let cursor = firstDashaStart;

  for (let i = 0; i < 9; i++) {
    const planet = VIMSHOTTARI_ORDER[(startIdx + i) % 9]!;
    const years = VIMSHOTTARI_YEARS[planet]!;
    const end = new Date(cursor.getTime() + years * YEAR_MS);
    timeline.push({ planet, years, start: new Date(cursor), end });
    cursor = end;
  }

  return { timeline, yearsConsumedAtBirth, fraction };
}

/**
 * Encuentra el mahadasha activo en una fecha dada.
 */
function findActiveDasha(timeline: DashaPeriod[], targetDate: Date): DashaPeriod | null {
  for (const d of timeline) {
    if (targetDate >= d.start && targetDate < d.end) {
      return d;
    }
  }
  return null;
}

/**
 * Calcula las 9 antardashas (sub-períodos) dentro de un mahadasha.
 * La antardasha empieza con el mismo planeta que el mahadasha y sigue
 * el orden Vimshottari. Cada antardasha dura:
 *   years_antar_planet / 120 * years_of_mahadasha
 */
function buildAntardashas(maha: DashaPeriod): DashaPeriod[] {
  const startIdx = VIMSHOTTARI_ORDER.indexOf(maha.planet);
  const antardashas: DashaPeriod[] = [];
  let cursor = maha.start;

  for (let i = 0; i < 9; i++) {
    const planet = VIMSHOTTARI_ORDER[(startIdx + i) % 9]!;
    const antarYears = (VIMSHOTTARI_YEARS[planet]! * maha.years) / 120;
    const end = new Date(cursor.getTime() + antarYears * YEAR_MS);
    antardashas.push({ planet, years: antarYears, start: new Date(cursor), end });
    cursor = end;
  }

  return antardashas;
}

/**
 * Función pública principal.
 * @returns snapshot completo con mahadasha + antardasha activos en targetDate
 */
export function calculateDashas(
  birthDate: Date,
  moonNakshatraDashaLord: string,
  degreeWithinNakshatra: number,
  targetDate: Date = new Date(),
): DashaSnapshot {
  const { timeline, yearsConsumedAtBirth, fraction } = buildTimeline(
    birthDate, moonNakshatraDashaLord, degreeWithinNakshatra,
  );

  const activeMaha = findActiveDasha(timeline, targetDate);
  if (!activeMaha) {
    throw new Error(`No se encontró mahadasha para fecha ${targetDate.toISOString()}`);
  }

  const antardashas = buildAntardashas(activeMaha);
  const activeAntar = findActiveDasha(antardashas, targetDate);
  if (!activeAntar) {
    throw new Error(`No se encontró antardasha en ${activeMaha.planet} mahadasha`);
  }

  const mahaElapsedMs = targetDate.getTime() - activeMaha.start.getTime();
  const mahaTotalMs = activeMaha.end.getTime() - activeMaha.start.getTime();
  const mahaProgressPct = Math.round((mahaElapsedMs / mahaTotalMs) * 100 * 10) / 10;
  const mahaYearsRemaining = (activeMaha.end.getTime() - targetDate.getTime()) / YEAR_MS;

  const antarElapsedMs = targetDate.getTime() - activeAntar.start.getTime();
  const antarTotalMs = activeAntar.end.getTime() - activeAntar.start.getTime();
  const antarProgressPct = Math.round((antarElapsedMs / antarTotalMs) * 100 * 10) / 10;
  const antarDaysRemaining = (activeAntar.end.getTime() - targetDate.getTime()) / (86400 * 1000);

  return {
    mahadasha: {
      ...activeMaha,
      progress_pct: mahaProgressPct,
      years_remaining: Math.round(mahaYearsRemaining * 10) / 10,
    },
    antardasha: {
      ...activeAntar,
      progress_pct: antarProgressPct,
      days_remaining: Math.round(antarDaysRemaining),
    },
    full_timeline: timeline,
    birth_moon_dasha_lord: moonNakshatraDashaLord,
    years_consumed_at_birth: Math.round(yearsConsumedAtBirth * 100) / 100,
    fraction_of_nakshatra_consumed: Math.round(fraction * 1000) / 1000,
  };
}

// ============================================================
// Descripciones humanas de los mahadashas
// ============================================================
export const MAHADASHA_THEMES: Record<string, { titulo: string; positive: string; challenge: string }> = {
  Ketu: {
    titulo: 'Ketu: el tiempo del desapego',
    positive: 'Despertar espiritual, moksha, profundidad interior, liberación de ataduras materiales.',
    challenge: 'Desorientación, pérdidas súbitas, aislamiento si no se canaliza hacia dentro.',
  },
  Venus: {
    titulo: 'Venus: el tiempo del placer y el arte',
    positive: 'Abundancia material, amor, belleza, creatividad artística, relaciones significativas.',
    challenge: 'Sobreindulgencia, apego al lujo, pérdida de propósito si solo busca gratificación.',
  },
  Sun: {
    titulo: 'Sol: el tiempo del propósito',
    positive: 'Afirmación de identidad, liderazgo, reconocimiento público, ambición saludable.',
    challenge: 'Ego inflado, conflictos con autoridades, agotamiento si fuerza el ritmo.',
  },
  Moon: {
    titulo: 'Luna: el tiempo de las emociones y la nutrición',
    positive: 'Conexión emocional profunda, cuidado del hogar, intuición, vida familiar nutritiva.',
    challenge: 'Altibajos emocionales, dependencia afectiva, dificultad para tomar decisiones.',
  },
  Mars: {
    titulo: 'Marte: el tiempo de la acción',
    positive: 'Coraje, impulso, proyectos nuevos, salud vital, deporte, propósito agresivo.',
    challenge: 'Impaciencia, conflictos, accidentes, quemarse por exceso de fuego.',
  },
  Rahu: {
    titulo: 'Rahu: el tiempo de la obsesión magnificada',
    positive: 'Poder mundano, innovación, éxito inesperado, atracción magnética, pensamiento fuera de la caja.',
    challenge: 'Obsesiones, deseos ilusorios, caídas súbitas tras éxitos rápidos, adicciones.',
  },
  Jupiter: {
    titulo: 'Júpiter: el tiempo de la expansión',
    positive: 'Sabiduría, maestros, abundancia, hijos, viajes espirituales, reconocimiento moral.',
    challenge: 'Exceso, arrogancia intelectual, dogmatismo, sobrepeso.',
  },
  Saturn: {
    titulo: 'Saturno: el tiempo de la maestría por la disciplina',
    positive: 'Estructura, responsabilidad asumida, éxito duradero, sabiduría del tiempo.',
    challenge: 'Limitación, soledad, depresión si se resiste el trabajo interior, retrasos.',
  },
  Mercury: {
    titulo: 'Mercurio: el tiempo del intelecto',
    positive: 'Comunicación, aprendizaje, negocios, contactos, flexibilidad mental.',
    challenge: 'Dispersión, ansiedad mental, superficialidad si no profundiza.',
  },
};
