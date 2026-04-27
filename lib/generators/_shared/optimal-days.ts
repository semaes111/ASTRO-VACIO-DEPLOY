/**
 * `lib/generators/_shared/optimal-days.ts`
 *
 * Helper pure que evalúa una ventana de fechas y devuelve los N días más
 * favorables y los N más desfavorables para iniciar una empresa que dependa
 * de electional astrology (mudanza, compra de vehículo, firma, viaje, etc.).
 *
 * No es específico de ningún producto. Cada worker decide qué ventana pasarle
 * y cómo presentar los resultados al usuario.
 *
 * Algoritmo de scoring (auditable, sin mística):
 *
 *   +5  Júpiter conjunción/trígono/sextil a Sol o Luna natal (orbe < 6°)
 *   +3  Venus   conjunción/trígono/sextil a Sol o Luna natal (orbe < 6°)
 *   -5  Saturno cuadratura/oposición  a Sol o Luna natal (orbe < 6°)
 *   -3  Marte   cuadratura/oposición  a Sol o Luna natal (orbe < 6°)
 *   -4  Mercurio retrógrado (detectado comparando posición t vs t-1)
 *   -2  Luna en último grado del signo (proxy aproximado de void of course)
 *   -2  Luna llena (orbe < 6° de oposición Sol-Luna del día)
 *   +1  Luna en signo afín al Sol natal (mismo elemento o trígono)
 *
 * Cada aspecto se pondera por (6 - orbe) / 6 — un aspecto exacto vale el
 * peso completo, uno con orbe 5° vale ~17%.
 *
 * Coste de cómputo: ~30 ms × N días. Para una ventana de 90 días, ~2.7 s.
 *
 * NOTA SOBRE LA LUNA VACÍA DE CURSO:
 *   La detección rigurosa requiere conocer la duración de cada signo lunar
 *   (~2.5 días) y todos los aspectos previstos hasta el cambio de signo.
 *   Esa lógica vive en otra capa (futura). Aquí usamos como proxy el último
 *   grado del signo (29°): si la Luna está allí, hay alta probabilidad de
 *   estar vacía de curso. Es conservador — penaliza algunos días que en
 *   realidad están bien, pero nunca aprueba un día realmente vacío.
 */

import { computeNatalChart, type NatalChart } from '@/lib/astronomy/planets';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface OptimalDaysWindow {
  /** Fecha de inicio inclusiva 'YYYY-MM-DD'. */
  start: string;
  /** Fecha de fin inclusiva 'YYYY-MM-DD'. */
  end: string;
  /** Cuántos días favorables devolver (default 5). */
  topN?: number;
  /** Cuántos días desfavorables devolver (default 3). */
  topNAvoid?: number;
  /**
   * Día objetivo del usuario, si lo hay. Se EXCLUYE de los resultados para
   * que las "alternativas" no incluyan el día que ya está siendo analizado
   * en otra sección del informe. Formato 'YYYY-MM-DD'.
   */
  excludeDate?: string;
  /**
   * Hora local (0-23) del día para evaluar el chart. Default 12 (mediodía).
   * Para electional astrology generalista mediodía es razonable; el matiz
   * fino de "hora óptima" lo decide otra capa.
   */
  hourLocal?: number;
  /**
   * Offset horario respecto a UTC en horas. Default +1 (CET España invierno).
   * Si la mudanza es en verano, pasar 2.
   */
  tzOffsetHours?: number;
  /**
   * Coordenadas para calcular ascendente del día. Si no se pasan, no se
   * calcula ascendente diario y el scoring no lo usa (queda igualmente válido).
   */
  latitude?: number;
  longitude?: number;
}

export interface OptimalDay {
  /** Fecha 'YYYY-MM-DD'. */
  date: string;
  /** Día de la semana en español ('lunes', 'martes', etc.). */
  day_of_week: string;
  /**
   * Score numérico. Positivo = favorable, negativo = desfavorable, 0 = neutro.
   * No tiene unidad astronómica — solo es ordenable.
   */
  score: number;
  /**
   * Lista de razones legibles que justifican el score. Cada string es una
   * frase corta sobre un aspecto concreto. El prompt al LLM las usa para
   * que pueda redactar la justificación al usuario.
   */
  reasons: string[];
}

export interface OptimalDaysResult {
  /** Cuántos días se evaluaron. */
  evaluated: number;
  /** Días con score más alto, en orden descendente. */
  topFavorable: OptimalDay[];
  /** Días con score más bajo, en orden ascendente (más negativos primero). */
  topUnfavorable: OptimalDay[];
}

// ---------------------------------------------------------------------------
// Constantes astronómicas y heurísticas
// ---------------------------------------------------------------------------

/** Aspectos mayores y su peso angular. */
const ASPECTS = [
  { angle: 0,   name: 'conjunción',  flavor: 'neutral' as const },
  { angle: 60,  name: 'sextil',      flavor: 'soft' as const },
  { angle: 90,  name: 'cuadratura',  flavor: 'hard' as const },
  { angle: 120, name: 'trígono',     flavor: 'soft' as const },
  { angle: 180, name: 'oposición',   flavor: 'hard' as const },
] as const;

const ORB_LIMIT = 6;

const DAY_OF_WEEK_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
] as const;

/**
 * Signos del zodíaco afines al Sol según elemento.
 * Útil para el bonus +1 cuando la Luna del día cae en signo afín.
 */
const ELEMENTS: Record<string, string[]> = {
  // fuego
  aries:        ['aries', 'leo', 'sagitario'],
  leo:          ['aries', 'leo', 'sagitario'],
  sagitario:    ['aries', 'leo', 'sagitario'],
  // tierra
  tauro:        ['tauro', 'virgo', 'capricornio'],
  virgo:        ['tauro', 'virgo', 'capricornio'],
  capricornio:  ['tauro', 'virgo', 'capricornio'],
  // aire
  geminis:      ['geminis', 'libra', 'acuario'],
  libra:        ['geminis', 'libra', 'acuario'],
  acuario:      ['geminis', 'libra', 'acuario'],
  // agua
  cancer:       ['cancer', 'escorpio', 'piscis'],
  escorpio:     ['cancer', 'escorpio', 'piscis'],
  piscis:       ['cancer', 'escorpio', 'piscis'],
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function angularSeparation(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function aspectMatch(
  separation: number,
): { name: string; flavor: 'soft' | 'hard' | 'neutral'; orb: number } | null {
  for (const asp of ASPECTS) {
    const orb = Math.abs(separation - asp.angle);
    if (orb < ORB_LIMIT) {
      return { name: asp.name, flavor: asp.flavor, orb };
    }
  }
  return null;
}

/** Peso por orbe: aspecto exacto vale 1, orbe ORB_LIMIT vale 0. */
function orbWeight(orb: number): number {
  return Math.max(0, (ORB_LIMIT - orb) / ORB_LIMIT);
}

/**
 * Construye un Date UTC a partir de fecha local + hora local + offset.
 * Muy similar al de `birth-data.ts` pero sin el escape extra.
 */
function buildLocalDateUTC(
  dateStr: string,
  hourLocal: number,
  tzOffsetHours: number,
): Date {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const Y = parseInt(yStr ?? '2000', 10);
  const M = parseInt(mStr ?? '1', 10);
  const D = parseInt(dStr ?? '1', 10);
  return new Date(Date.UTC(Y, M - 1, D, hourLocal - tzOffsetHours, 0));
}

/**
 * Itera los días entre `start` y `end` (inclusive ambos) en formato YYYY-MM-DD.
 */
function* iterateDays(start: string, end: string): Generator<string> {
  const startD = new Date(`${start}T12:00:00Z`);
  const endD = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
    throw new Error(`iterateDays: fechas inválidas ${start} → ${end}`);
  }
  if (endD < startD) {
    throw new Error(`iterateDays: end (${end}) anterior a start (${start})`);
  }
  for (
    let cur = new Date(startD);
    cur.getTime() <= endD.getTime();
    cur.setUTCDate(cur.getUTCDate() + 1)
  ) {
    yield cur.toISOString().slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Scoring de un día concreto
// ---------------------------------------------------------------------------

interface DayScoreInput {
  natal: NatalChart;
  transit: NatalChart;
  /**
   * Posición de Mercurio del día anterior, para detectar movimiento
   * retrógrado comparando longitudes consecutivas.
   */
  mercuryPrevDayLongitude: number | null;
}

interface DayScoreOutput {
  score: number;
  reasons: string[];
}

/**
 * Calcula el score de un día dado su transit chart y el chart natal.
 * Auditable: cada delta de score se acompaña de una razón legible.
 */
function scoreDay(input: DayScoreInput): DayScoreOutput {
  const { natal, transit, mercuryPrevDayLongitude } = input;
  let score = 0;
  const reasons: string[] = [];

  // ───────────────────────────────────────────────────────────
  // 1. Aspectos benéficos: Júpiter y Venus a luminares natales
  // ───────────────────────────────────────────────────────────
  const benefics: Array<['Júpiter' | 'Venus', number]> = [
    ['Júpiter', transit.jupiter.longitude_tropical],
    ['Venus',   transit.venus.longitude_tropical],
  ];
  const luminaries: Array<['Sol' | 'Luna', number]> = [
    ['Sol',  natal.sun.longitude_tropical],
    ['Luna', natal.moon.longitude_tropical],
  ];

  for (const [bName, bLon] of benefics) {
    for (const [lName, lLon] of luminaries) {
      const sep = angularSeparation(bLon, lLon);
      const asp = aspectMatch(sep);
      if (!asp) continue;
      // Solo soft + conjunción cuentan como bonus (no nos importa
      // cuadratura/oposición de benéficos).
      if (asp.flavor === 'hard') continue;
      const baseWeight = bName === 'Júpiter' ? 5 : 3;
      const delta = baseWeight * orbWeight(asp.orb);
      score += delta;
      reasons.push(
        `+${delta.toFixed(1)} ${bName} ${asp.name} ${lName} natal (orbe ${asp.orb.toFixed(1)}°)`,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // 2. Aspectos maléficos: Saturno y Marte a luminares natales
  // ───────────────────────────────────────────────────────────
  const malefics: Array<['Saturno' | 'Marte', number]> = [
    ['Saturno', transit.saturn.longitude_tropical],
    ['Marte',   transit.mars.longitude_tropical],
  ];

  for (const [mName, mLon] of malefics) {
    for (const [lName, lLon] of luminaries) {
      const sep = angularSeparation(mLon, lLon);
      const asp = aspectMatch(sep);
      if (!asp) continue;
      // Solo hard cuenta como penalización.
      if (asp.flavor !== 'hard') continue;
      const baseWeight = mName === 'Saturno' ? 5 : 3;
      const delta = baseWeight * orbWeight(asp.orb);
      score -= delta;
      reasons.push(
        `−${delta.toFixed(1)} ${mName} ${asp.name} ${lName} natal (orbe ${asp.orb.toFixed(1)}°)`,
      );
    }
  }

  // ───────────────────────────────────────────────────────────
  // 3. Mercurio retrógrado (proxy: longitud disminuye día a día)
  // ───────────────────────────────────────────────────────────
  if (mercuryPrevDayLongitude !== null) {
    const today = transit.mercury.longitude_tropical;
    let delta = today - mercuryPrevDayLongitude;
    // Manejar wrap 359° → 0° (no es retro)
    if (delta < -180) delta += 360;
    if (delta > 180) delta -= 360;
    if (delta < 0) {
      score -= 4;
      reasons.push('−4.0 Mercurio retrógrado');
    }
  }

  // ───────────────────────────────────────────────────────────
  // 4. Luna en último grado del signo (proxy de void of course)
  // ───────────────────────────────────────────────────────────
  if (transit.moon.degree_in_sign_tropical >= 29) {
    score -= 2;
    reasons.push('−2.0 Luna en último grado de signo (probable void of course)');
  }

  // ───────────────────────────────────────────────────────────
  // 5. Luna llena (Sol y Luna del día en oposición exacta)
  // ───────────────────────────────────────────────────────────
  const sunMoonSep = angularSeparation(
    transit.sun.longitude_tropical,
    transit.moon.longitude_tropical,
  );
  if (Math.abs(sunMoonSep - 180) < 6) {
    const orb = Math.abs(sunMoonSep - 180);
    const delta = 2 * orbWeight(orb);
    score -= delta;
    reasons.push(`−${delta.toFixed(1)} Luna llena (orbe ${orb.toFixed(1)}°)`);
  }

  // ───────────────────────────────────────────────────────────
  // 6. Bonus: Luna del día en signo afín al Sol natal (elemento)
  // ───────────────────────────────────────────────────────────
  const sunNatalSign = natal.sun.sign_tropical.toLowerCase();
  const moonTransitSign = transit.moon.sign_tropical.toLowerCase();
  const affineSigns = ELEMENTS[sunNatalSign];
  if (affineSigns && affineSigns.includes(moonTransitSign)) {
    score += 1;
    reasons.push(`+1.0 Luna en ${transit.moon.sign_tropical} (afín a ${natal.sun.sign_tropical} natal)`);
  }

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Evalúa la ventana y devuelve los topN días favorables y topNAvoid
 * desfavorables.
 *
 * @param natal Carta natal del titular (ya calculada).
 * @param window Configuración de la ventana de evaluación.
 * @returns Estructura con los días seleccionados y sus razones.
 */
export function findOptimalDays(
  natal: NatalChart,
  window: OptimalDaysWindow,
): OptimalDaysResult {
  const topN = window.topN ?? 5;
  const topNAvoid = window.topNAvoid ?? 3;
  const hourLocal = window.hourLocal ?? 12;
  const tzOffset = window.tzOffsetHours ?? 1;
  const lat = window.latitude;
  const lng = window.longitude;
  const excludeDate = window.excludeDate ?? null;

  // Recoger todos los días + cargar Mercurio del día anterior al primer día
  // (para detectar retrogradación desde la primera iteración).
  const allDates: string[] = Array.from(iterateDays(window.start, window.end));
  if (allDates.length === 0) {
    return { evaluated: 0, topFavorable: [], topUnfavorable: [] };
  }

  // Mercury anterior al primer día (lookback 1 día)
  const firstDateUTC = buildLocalDateUTC(allDates[0]!, hourLocal, tzOffset);
  const lookbackDate = new Date(firstDateUTC.getTime() - 24 * 3600 * 1000);
  const lookbackChart = computeNatalChart(lookbackDate, lat, lng);
  let mercuryPrev: number = lookbackChart.mercury.longitude_tropical;

  const allScored: OptimalDay[] = [];

  for (const dateStr of allDates) {
    const dateUTC = buildLocalDateUTC(dateStr, hourLocal, tzOffset);
    const transit = computeNatalChart(dateUTC, lat, lng);

    const { score, reasons } = scoreDay({
      natal,
      transit,
      mercuryPrevDayLongitude: mercuryPrev,
    });

    if (excludeDate !== dateStr) {
      const dow = DAY_OF_WEEK_ES[dateUTC.getUTCDay()] ?? '?';
      allScored.push({
        date: dateStr,
        day_of_week: dow,
        score: Math.round(score * 10) / 10,
        reasons,
      });
    }

    mercuryPrev = transit.mercury.longitude_tropical;
  }

  // Ordenar y tomar top
  const byScoreDesc = [...allScored].sort((a, b) => b.score - a.score);
  const byScoreAsc  = [...allScored].sort((a, b) => a.score - b.score);

  const topFavorable = byScoreDesc.slice(0, topN).filter((d) => d.score > 0);
  const topUnfavorable = byScoreAsc.slice(0, topNAvoid).filter((d) => d.score < 0);

  return {
    evaluated: allScored.length,
    topFavorable,
    topUnfavorable,
  };
}

/**
 * Construye una ventana razonable centrada en una fecha objetivo. Si la
 * fecha objetivo está cerca (dentro de 30 días desde hoy), la ventana es
 * `[hoy, fechaObjetivo + extendDays]`. Si está más lejos, la ventana es
 * `[fechaObjetivo - 30, fechaObjetivo + extendDays]`.
 *
 * Útil para que cada worker decida la ventana sin reimplementarlo.
 */
export function buildWindowAroundTarget(
  targetDate: string,
  options: { extendDaysAfter?: number; today?: Date } = {},
): { start: string; end: string } {
  const extendAfter = options.extendDaysAfter ?? 60;
  const today = options.today ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const targetUTC = new Date(`${targetDate}T12:00:00Z`);
  if (Number.isNaN(targetUTC.getTime())) {
    throw new Error(`buildWindowAroundTarget: fecha inválida '${targetDate}'`);
  }
  const daysUntilTarget = Math.round(
    (targetUTC.getTime() - today.getTime()) / (24 * 3600 * 1000),
  );

  const endUTC = new Date(targetUTC.getTime() + extendAfter * 24 * 3600 * 1000);
  const endStr = endUTC.toISOString().slice(0, 10);

  if (daysUntilTarget < 30) {
    // Target cercano: ventana desde hoy
    return { start: todayStr, end: endStr };
  }
  // Target lejano: ventana desde 30 días antes
  const startUTC = new Date(targetUTC.getTime() - 30 * 24 * 3600 * 1000);
  return { start: startUTC.toISOString().slice(0, 10), end: endStr };
}
