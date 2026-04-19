/**
 * Cálculos astronómicos para generadores de AstroDorado.
 * Usa astronomy-engine (MIT, Don Cross) — pure JS, preciso a ~1 arcmin.
 *
 * Convención:
 *  - Tropical = zodíaco occidental (partiendo del equinoccio vernal)
 *  - Sidéreo  = zodíaco védico (ayanamsa Lahiri, para Ayurveda/Jyotish)
 *  - Longitudes en grados 0-360, medidas desde 0° Aries
 */

import * as Astronomy from 'astronomy-engine';
import type { ZodiacSlug } from '@/lib/types/astrodorado';

export interface PlanetPosition {
  longitude_tropical: number;
  longitude_sidereal: number;
  sign_tropical: ZodiacSlug;
  sign_sidereal: ZodiacSlug;
  degree_in_sign_tropical: number;
  degree_in_sign_sidereal: number;
}

export interface NakshatraPosition {
  index: number;
  name: string;
  pada: 1 | 2 | 3 | 4;
  degree_within: number;
  dasha_lord: string;
  degree_in_dasha_lord: number;
}

export interface NatalChart {
  birth_date: Date;
  latitude?: number;
  longitude?: number;
  ayanamsa_lahiri: number;
  sun: PlanetPosition;
  moon: PlanetPosition & { nakshatra: NakshatraPosition };
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
  rahu: PlanetPosition;
  ketu: PlanetPosition;
  ascendant?: PlanetPosition;
}

// ============================================================
// Tablas de referencia
// ============================================================
const ZODIAC_ORDER: ZodiacSlug[] = [
  'aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo',
  'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis',
];

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const NAKSHATRA_DASHA_LORDS = [
  'Ketu', 'Venus', 'Sun',         // 0-2: Ashwini, Bharani, Krittika
  'Moon', 'Mars', 'Rahu',         // 3-5: Rohini, Mrigashira, Ardra
  'Jupiter', 'Saturn', 'Mercury', // 6-8: Punarvasu, Pushya, Ashlesha
  'Ketu', 'Venus', 'Sun',         // 9-11: Magha, P.Phalguni, U.Phalguni
  'Moon', 'Mars', 'Rahu',         // 12-14: Hasta, Chitra, Swati
  'Jupiter', 'Saturn', 'Mercury', // 15-17: Vishakha, Anuradha, Jyeshtha
  'Ketu', 'Venus', 'Sun',         // 18-20: Mula, P.Ashadha, U.Ashadha
  'Moon', 'Mars', 'Rahu',         // 21-23: Shravana, Dhanishta, Shatabhisha
  'Jupiter', 'Saturn', 'Mercury', // 24-26: P.Bhadrapada, U.Bhadrapada, Revati
];

// ============================================================
// Utilidades de conversión
// ============================================================
function normalizeAngle(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/**
 * Ayanamsa Lahiri (diferencia entre zodíaco tropical y sidéreo indio).
 * Fórmula basada en J2000.0 + tasa de precesión estándar.
 * Precisión suficiente para uso astrológico (~1 arcmin).
 */
export function ayanamsaLahiri(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525.0;
  return 23.85225 + 0.0139611 * (t * 100);
}

/**
 * Signo zodiacal (tropical o sidéreo) desde longitud eclíptica.
 */
export function longitudeToZodiac(lon: number): { sign: ZodiacSlug; degree: number } {
  const n = normalizeAngle(lon);
  const index = Math.floor(n / 30);
  return {
    sign: ZODIAC_ORDER[index],
    degree: n - index * 30,
  };
}

/**
 * Nakshatra y pada desde longitud sidérea.
 * 27 nakshatras x 13°20' = 360°
 * Cada nakshatra tiene 4 padas de 3°20'.
 */
export function longitudeToNakshatra(longitudeSidereal: number): NakshatraPosition {
  const n = normalizeAngle(longitudeSidereal);
  const nakSize = 360 / 27;
  const padaSize = nakSize / 4;
  const index = Math.floor(n / nakSize);
  const within = n - index * nakSize;
  const pada = (Math.floor(within / padaSize) + 1) as 1 | 2 | 3 | 4;
  return {
    index,
    name: NAKSHATRA_NAMES[index],
    pada,
    degree_within: within,
    dasha_lord: NAKSHATRA_DASHA_LORDS[index],
    degree_in_dasha_lord: within,
  };
}

// ============================================================
// Cálculos planetarios
// ============================================================
function bodyLongitudeTropical(body: Astronomy.Body, date: Date): number {
  const vec = Astronomy.GeoVector(body, date, false);
  const ecl = Astronomy.Ecliptic(vec);
  return normalizeAngle(ecl.elon);
}

/**
 * Nodo lunar ascendente (Rahu) — Meeus cap. 47.
 */
function rahuLongitudeTropical(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525.0;
  const omega = 125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000;
  return normalizeAngle(omega);
}

/**
 * Ascendente (Lagna) — Meeus cap. 13.6.
 */
function computeAscendant(date: Date, latitude: number, longitude: number): number {
  const gstHours = Astronomy.SiderealTime(date);
  const lstDeg = normalizeAngle(gstHours * 15 + longitude);
  const epsilon = 23.4367;
  const H = (lstDeg * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const eps = (epsilon * Math.PI) / 180;
  const num = -Math.cos(H);
  const den = Math.sin(H) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
  let asc = Math.atan(num / den) * (180 / Math.PI);
  if (den < 0) asc += 180;
  return normalizeAngle(asc);
}

function makePlanetPosition(lonTropical: number, date: Date): PlanetPosition {
  const ayanamsa = ayanamsaLahiri(date);
  const lonSidereal = normalizeAngle(lonTropical - ayanamsa);
  const tropZod = longitudeToZodiac(lonTropical);
  const sidZod = longitudeToZodiac(lonSidereal);
  return {
    longitude_tropical: lonTropical,
    longitude_sidereal: lonSidereal,
    sign_tropical: tropZod.sign,
    sign_sidereal: sidZod.sign,
    degree_in_sign_tropical: tropZod.degree,
    degree_in_sign_sidereal: sidZod.degree,
  };
}

// ============================================================
// Función pública principal
// ============================================================
export function computeNatalChart(
  birthDate: Date,
  latitude?: number,
  longitude?: number,
): NatalChart {
  const ayanamsa = ayanamsaLahiri(birthDate);
  const moonLon = bodyLongitudeTropical(Astronomy.Body.Moon, birthDate);
  const moonSid = normalizeAngle(moonLon - ayanamsa);
  const rahuLon = rahuLongitudeTropical(birthDate);

  const chart: NatalChart = {
    birth_date: birthDate,
    latitude,
    longitude,
    ayanamsa_lahiri: ayanamsa,
    sun: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Sun, birthDate), birthDate),
    moon: {
      ...makePlanetPosition(moonLon, birthDate),
      nakshatra: longitudeToNakshatra(moonSid),
    },
    mercury: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Mercury, birthDate), birthDate),
    venus: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Venus, birthDate), birthDate),
    mars: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Mars, birthDate), birthDate),
    jupiter: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Jupiter, birthDate), birthDate),
    saturn: makePlanetPosition(bodyLongitudeTropical(Astronomy.Body.Saturn, birthDate), birthDate),
    rahu: makePlanetPosition(rahuLon, birthDate),
    ketu: makePlanetPosition(normalizeAngle(rahuLon + 180), birthDate),
  };

  if (latitude !== undefined && longitude !== undefined) {
    const ascDeg = computeAscendant(birthDate, latitude, longitude);
    chart.ascendant = makePlanetPosition(ascDeg, birthDate);
  }

  return chart;
}
