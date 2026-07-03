/**
 * Motor de TRÁNSITOS determinista — patrón compute-then-narrate (§1.3).
 *
 * Calcula, con efemérides reales (astronomy-engine), los contactos exactos y
 * DATADOS de los planetas lentos (Júpiter→Plutón) sobre los puntos natales a lo
 * largo de una ventana temporal. Reemplaza la invención de fechas por parte del
 * LLM en revolucion-solar, neg-financiero-anual y amistad-karmica.
 *
 * Cumple el Protocolo de Veracidad: las fechas de tránsito se calculan en código
 * verificable; el LLM solo las interpreta.
 */
import * as Astronomy from 'astronomy-engine';
import { bodyLongitudeTropical } from '@/lib/astronomy/planets';

interface NamedBody {
  name: string;
  body: Astronomy.Body;
}

/** Planetas lentos que producen tránsitos duraderos y datables. */
const TRANSIT_PLANETS: readonly NamedBody[] = [
  { name: 'Júpiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturno', body: Astronomy.Body.Saturn },
  { name: 'Urano', body: Astronomy.Body.Uranus },
  { name: 'Neptuno', body: Astronomy.Body.Neptune },
  { name: 'Plutón', body: Astronomy.Body.Pluto },
];

/** Puntos natales sobre los que se miden los tránsitos. */
const NATAL_BODIES: readonly NamedBody[] = [
  { name: 'Sol', body: Astronomy.Body.Sun },
  { name: 'Luna', body: Astronomy.Body.Moon },
  { name: 'Mercurio', body: Astronomy.Body.Mercury },
  { name: 'Venus', body: Astronomy.Body.Venus },
  { name: 'Marte', body: Astronomy.Body.Mars },
  { name: 'Júpiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturno', body: Astronomy.Body.Saturn },
  { name: 'Urano', body: Astronomy.Body.Uranus },
  { name: 'Neptuno', body: Astronomy.Body.Neptune },
  { name: 'Plutón', body: Astronomy.Body.Pluto },
];

interface AspectDef {
  name: string;
  angle: number;
  symbol: string;
}

const ASPECTS: readonly AspectDef[] = [
  { name: 'Conjunción', angle: 0, symbol: '☌' },
  { name: 'Sextil', angle: 60, symbol: '⚹' },
  { name: 'Cuadratura', angle: 90, symbol: '□' },
  { name: 'Trígono', angle: 120, symbol: '△' },
  { name: 'Oposición', angle: 180, symbol: '☍' },
];

/** Orbe máximo (grados) para registrar un contacto como "exacto". */
const ORB_MAX = 1.0;

export interface TransitContact {
  /** Fecha del contacto exacto, ISO 'YYYY-MM-DD'. */
  date: string;
  transiting: string;
  aspect: string;
  aspectSymbol: string;
  natalPoint: string;
  /** Orbe residual en el momento del contacto (grados). */
  orb: number;
}

/** Separación angular mínima (0-180) entre dos longitudes. */
function separation(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula los contactos de tránsito de planetas lentos sobre la carta natal.
 * @param birthDate fecha/hora de nacimiento (para fijar los puntos natales)
 * @param from inicio de la ventana de escaneo
 * @param to fin de la ventana de escaneo
 */
export function computeTransits(birthDate: Date, from: Date, to: Date): TransitContact[] {
  // Longitudes natales, fijas (se calculan una vez).
  const natalLon: number[] = NATAL_BODIES.map((n) => bodyLongitudeTropical(n.body, birthDate));

  const contacts: TransitContact[] = [];
  // Estado por combinación (tránsito × natal × aspecto): error previo, fecha y dirección.
  const state = new Map<string, { prevErr: number; prevDate: Date; descending: boolean }>();

  const DAY_MS = 86400000;
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    const day = new Date(t);
    const transitLon = TRANSIT_PLANETS.map((p) => bodyLongitudeTropical(p.body, day));

    for (let ti = 0; ti < TRANSIT_PLANETS.length; ti++) {
      const tLon = transitLon[ti];
      const tp = TRANSIT_PLANETS[ti];
      if (tLon === undefined || tp === undefined) continue;
      for (let ni = 0; ni < NATAL_BODIES.length; ni++) {
        const nLon = natalLon[ni];
        const np = NATAL_BODIES[ni];
        if (nLon === undefined || np === undefined) continue;
        // Evitar el auto-contacto trivial (mismo cuerpo, conjunción 0°) si es el mismo planeta y aspecto conjunción a sí mismo en la misma fecha natal: se permite (p.ej. retorno de Júpiter), no se filtra.
        const sep = separation(tLon, nLon);
        for (let ai = 0; ai < ASPECTS.length; ai++) {
          const asp = ASPECTS[ai];
          if (asp === undefined) continue;
          const err = Math.abs(sep - asp.angle);
          const key = `${ti}-${ni}-${ai}`;
          const st = state.get(key);
          if (st !== undefined) {
            const ascendingNow = err > st.prevErr;
            // Mínimo local: venía decreciendo y ahora crece → st.prevDate fue el contacto exacto.
            if (ascendingNow && st.descending && st.prevErr < ORB_MAX) {
              contacts.push({
                date: isoDate(st.prevDate),
                transiting: tp.name,
                aspect: asp.name,
                aspectSymbol: asp.symbol,
                natalPoint: np.name,
                orb: Math.round(st.prevErr * 100) / 100,
              });
            }
            state.set(key, { prevErr: err, prevDate: day, descending: !ascendingNow });
          } else {
            state.set(key, { prevErr: err, prevDate: day, descending: true });
          }
        }
      }
    }
  }

  contacts.sort((a, b) => a.date.localeCompare(b.date));
  return contacts;
}
