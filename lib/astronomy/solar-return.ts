/**
 * Revolución Solar DETERMINISTA — patrón compute-then-narrate (§1.3).
 *
 * La Revolución Solar de un año es la carta del instante EXACTO en que el Sol
 * vuelve a la longitud eclíptica que tenía al nacer. Se calcula con efemérides
 * reales (astronomy-engine): búsqueda binaria del cruce solar + carta natal en
 * ese momento. Nada de esto lo puede inventar el LLM.
 *
 * Validado contra el PDF integral de Sergio: Sol natal = Sol RS = 98.7734°,
 * retorno el 30 jun 2026 ~15:11 CEST.
 */
import * as Astronomy from 'astronomy-engine';
import { bodyLongitudeTropical, computeNatalChart, type NatalChart } from '@/lib/astronomy/planets';

export interface SolarReturn {
  /** Instante exacto del retorno solar (UTC). */
  moment: Date;
  /** Longitud del Sol natal a la que retorna (grados tropicales). */
  natalSunLongitude: number;
  /** Residual del ajuste en el momento hallado (grados; debe ser ~0). */
  residual: number;
  /** Carta completa calculada para el instante del retorno. */
  chart: NatalChart;
}

/** Diferencia angular con signo en [-180, 180]. */
function signedDelta(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d === -180) d = 180;
  return d;
}

/**
 * Calcula la Revolución Solar del año indicado.
 * @param birthDate fecha/hora de nacimiento (fija el Sol natal)
 * @param targetYear año del cumpleaños cuya Revolución Solar se quiere
 * @param latitude/longitude lugar donde se domifica la RS (por defecto, el natal)
 */
export function computeSolarReturn(
  birthDate: Date,
  targetYear: number,
  latitude?: number,
  longitude?: number,
): SolarReturn {
  const natalSun = bodyLongitudeTropical(Astronomy.Body.Sun, birthDate);

  // Ventana de búsqueda: ±2 días alrededor del aniversario en targetYear.
  const anniversary = new Date(
    Date.UTC(
      targetYear,
      birthDate.getUTCMonth(),
      birthDate.getUTCDate(),
      birthDate.getUTCHours(),
      birthDate.getUTCMinutes(),
    ),
  );
  let lo = new Date(anniversary.getTime() - 2 * 86400000);
  let hi = new Date(anniversary.getTime() + 2 * 86400000);

  // El Sol avanza ~1°/día: signedDelta(sol(t) - natalSun) cruza 0 una vez en la ventana.
  const deltaAt = (d: Date): number => signedDelta(bodyLongitudeTropical(Astronomy.Body.Sun, d), natalSun);

  // Asegurar cambio de signo en [lo, hi]; si no, ampliar la ventana.
  let dLo = deltaAt(lo);
  let dHi = deltaAt(hi);
  let guard = 0;
  while (dLo * dHi > 0 && guard < 6) {
    lo = new Date(lo.getTime() - 86400000);
    hi = new Date(hi.getTime() + 86400000);
    dLo = deltaAt(lo);
    dHi = deltaAt(hi);
    guard++;
  }

  // Bisección hasta precisión de segundos.
  let mid = lo;
  for (let i = 0; i < 60; i++) {
    mid = new Date((lo.getTime() + hi.getTime()) / 2);
    const dMid = deltaAt(mid);
    if (Math.abs(dMid) < 1e-7 || hi.getTime() - lo.getTime() < 1000) break;
    if (dLo * dMid <= 0) {
      hi = mid;
      dHi = dMid;
    } else {
      lo = mid;
      dLo = dMid;
    }
  }

  return {
    moment: mid,
    natalSunLongitude: natalSun,
    residual: Math.abs(deltaAt(mid)),
    chart: computeNatalChart(mid, latitude, longitude),
  };
}
