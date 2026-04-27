/**
 * Helpers compartidos para todos los generators que trabajen con datos
 * de nacimiento (birth_date / birth_time / birth_place).
 *
 * Estos helpers NO se han extraído del worker `lib/generators/ayurveda/`
 * para no tocarlo (Ayurveda mantiene sus copias internas, está estable).
 * Los nuevos workers (evento-vehiculo, pareja-destino, etc.) usan estos.
 *
 * Si algún día se decide consolidar Ayurveda en este patrón, será un
 * refactor opcional posterior — no parte de este PR.
 *
 * Convenciones:
 *  - Todos los timestamps son `Date` UTC, nunca strings.
 *  - Las longitudes/latitudes son grados decimales (positivo = N/E).
 *  - Los nombres de ciudades se normalizan con NFD para comparar sin tildes.
 */

// ---------------------------------------------------------------------------
// Geocoding pragmático para España
// ---------------------------------------------------------------------------

export interface CityCoords {
  /** Latitud en grados decimales. Positivo = N. */
  lat: number;
  /** Longitud en grados decimales. Positivo = E. */
  lng: number;
  /**
   * Offset horario respecto a UTC en horas. Para España peninsular es +1
   * (CET) en invierno y +2 (CEST) en verano. Como aproximación usamos +1
   * — un error de ±1h en la hora de nacimiento mueve el ascendente como
   * mucho ~15° (medio signo), aceptable para informes generalistas.
   *
   * Si el cliente pasa `tz_offset_hours` explícito en `input_data`, se usa
   * ese valor en su lugar y se ignora este default.
   */
  tz_offset_hours: number;
}

/**
 * Lookup de coordenadas para ciudades españolas comunes. Catálogo idéntico
 * al de `lib/generators/ayurveda/generate.ts` para mantener resultados
 * consistentes entre productos.
 *
 * Si necesitas añadir una ciudad nueva, hazlo aquí Y en Ayurveda.
 * Mejor opción a futuro: integrar geocoding real (Nominatim / Google Maps)
 * cuando el catálogo supere ~30 entradas.
 */
const CITY_COORDS: Record<string, CityCoords> = {
  madrid:    { lat: 40.4168, lng: -3.7038, tz_offset_hours: 1 },
  'el ejido':{ lat: 36.7759, lng: -2.8108, tz_offset_hours: 1 },
  almeria:   { lat: 36.8340, lng: -2.4637, tz_offset_hours: 1 },
  barcelona: { lat: 41.3851, lng:  2.1734, tz_offset_hours: 1 },
  sevilla:   { lat: 37.3891, lng: -5.9845, tz_offset_hours: 1 },
  valencia:  { lat: 39.4699, lng: -0.3763, tz_offset_hours: 1 },
  bilbao:    { lat: 43.2630, lng: -2.9350, tz_offset_hours: 1 },
  malaga:    { lat: 36.7213, lng: -4.4213, tz_offset_hours: 1 },
  granada:   { lat: 37.1773, lng: -3.5986, tz_offset_hours: 1 },
  zaragoza:  { lat: 41.6488, lng: -0.8891, tz_offset_hours: 1 },
};

/**
 * Resuelve coordenadas a partir del texto libre `birth_place`. Si no hay
 * match, hace fallback a Madrid. Acepta tildes y mayúsculas.
 */
export function lookupCity(placeName: string | null | undefined): CityCoords {
  const normalized = (placeName ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(city)) return coords;
  }
  // Default: Madrid (siempre está en el catálogo)
  return CITY_COORDS.madrid!;
}

// ---------------------------------------------------------------------------
// Conversión birth_date + birth_time + offset → Date UTC
// ---------------------------------------------------------------------------

/**
 * Construye el `Date` UTC del nacimiento a partir de date+time+offset.
 *
 * Inputs esperados:
 *  - `birthDate` formato 'YYYY-MM-DD' (de Postgres date)
 *  - `birthTime` formato 'HH:MM' o 'HH:MM:SS' o null (Postgres time)
 *  - `tzOffsetHours` offset en horas (1 = CET, 2 = CEST, etc.)
 *
 * Si `birthTime` es null, asumimos las 12:00 locales (centro del día,
 * minimiza el error en el ascendente cuando solo conocemos la fecha).
 *
 * @throws si birthDate no tiene formato esperado.
 */
export function buildBirthDateUTC(
  birthDate: string,
  birthTime: string | null | undefined,
  tzOffsetHours: number,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error(
      `buildBirthDateUTC: birthDate no tiene formato YYYY-MM-DD: '${birthDate}'`,
    );
  }
  const timeStr = birthTime ?? '12:00';
  const [hhStr = '12', mmStr = '00'] = timeStr.split(':');
  const [yStr = '2000', mStr = '01', dStr = '01'] = birthDate.split('-');

  const Y = parseInt(yStr, 10);
  const M = parseInt(mStr, 10);
  const D = parseInt(dStr, 10);
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);

  if (Number.isNaN(Y) || Number.isNaN(M) || Number.isNaN(D) ||
      Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(
      `buildBirthDateUTC: valores no numéricos en ${birthDate} ${timeStr}`,
    );
  }

  // Fecha local → UTC: restamos el offset horario
  const utcMs = Date.UTC(Y, M - 1, D, hh - tzOffsetHours, mm);
  return new Date(utcMs);
}

// ---------------------------------------------------------------------------
// Helpers de HTML
// ---------------------------------------------------------------------------

/**
 * Escapa caracteres especiales para evitar inyección dentro de atributos
 * o nodos HTML. Idéntico a la implementación de Ayurveda.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Cuenta palabras aproximadas en un HTML — útil para métricas y para
 * validar que Claude generó suficiente contenido (informes < 500 palabras
 * son sospechosos y suelen indicar fallo del modelo).
 */
export function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text.split(' ').length : 0;
}

// ---------------------------------------------------------------------------
// Resolución del input "person" para informes que aceptan
// natal_chart como input
// ---------------------------------------------------------------------------

/**
 * Datos de nacimiento normalizados que un worker necesita para generar
 * un informe. Los campos coinciden con `astrodorado.users` y con el shape
 * que el frontend envía en `input_data.person`.
 */
export interface ResolvedBirthData {
  /** Nombre del titular del informe (el cliente, o la persona objetivo). */
  name: string;
  /** Fecha de nacimiento 'YYYY-MM-DD'. */
  birth_date: string;
  /** Hora local de nacimiento 'HH:MM' o null. */
  birth_time: string | null;
  /** Texto libre del lugar de nacimiento (para el prompt). */
  birth_place: string | null;
  /** Coordenadas resueltas (explícitas si las pasó el frontend, si no via lookupCity). */
  coords: CityCoords;
  /** `Date` UTC ya construido. */
  birth_date_utc: Date;
}

/**
 * Resuelve los datos de nacimiento desde un objeto arbitrario `input_data`
 * (tal como llega del frontend). Acepta los siguientes shapes:
 *
 *   1. input_data.person = { name, birth_date, birth_time?, birth_place?,
 *                            latitude?, longitude?, tz_offset_hours? }
 *   2. input_data = { birth_date, birth_time?, ... }   (legacy / Ayurveda-like)
 *
 * Si el shape #1 está presente y completo, gana sobre #2.
 *
 * @throws si no hay birth_date suficiente para calcular un chart.
 */
export function resolveBirthData(
  inputData: Record<string, unknown>,
  fallbackName: string,
): ResolvedBirthData {
  const person = (inputData.person ?? {}) as Record<string, unknown>;

  // birth_date: prioridad person.birth_date → input_data.birth_date
  const birthDate =
    typeof person.birth_date === 'string' ? person.birth_date :
    typeof inputData.birth_date === 'string' ? inputData.birth_date :
    null;

  if (!birthDate) {
    throw new Error(
      'resolveBirthData: birth_date requerido en input_data.person.birth_date ' +
        'o input_data.birth_date',
    );
  }

  const birthTime =
    typeof person.birth_time === 'string' ? person.birth_time :
    typeof inputData.birth_time === 'string' ? inputData.birth_time :
    null;

  const birthPlace =
    typeof person.birth_place === 'string' ? person.birth_place :
    typeof inputData.birth_place === 'string' ? inputData.birth_place :
    null;

  const explicitLat =
    typeof person.latitude === 'number' ? person.latitude :
    typeof inputData.latitude === 'number' ? inputData.latitude :
    null;
  const explicitLng =
    typeof person.longitude === 'number' ? person.longitude :
    typeof inputData.longitude === 'number' ? inputData.longitude :
    null;
  const explicitTz =
    typeof person.tz_offset_hours === 'number' ? person.tz_offset_hours :
    typeof inputData.tz_offset_hours === 'number' ? inputData.tz_offset_hours :
    null;

  const coords: CityCoords =
    explicitLat !== null && explicitLng !== null
      ? { lat: explicitLat, lng: explicitLng, tz_offset_hours: explicitTz ?? 1 }
      : lookupCity(birthPlace);

  const birthDateUTC = buildBirthDateUTC(birthDate, birthTime, coords.tz_offset_hours);

  const name =
    (typeof person.name === 'string' && person.name.trim().length > 0
      ? person.name.trim()
      : typeof inputData.name === 'string' && (inputData.name as string).trim().length > 0
        ? (inputData.name as string).trim()
        : fallbackName);

  return {
    name,
    birth_date: birthDate,
    birth_time: birthTime,
    birth_place: birthPlace,
    coords,
    birth_date_utc: birthDateUTC,
  };
}
