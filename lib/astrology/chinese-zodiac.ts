/**
 * Zodiaco chino / BaZi (pilar de año) DETERMINISTA — patrón compute-then-narrate.
 *
 * Cumple el Protocolo de Veracidad (CLAUDE-MASTER.md §1.3): animal, elemento,
 * polaridad y pilar de año se calculan en código, NO los deduce el LLM.
 *
 * Validado: 1988 → Dragón / Tierra / Yang · 1973 → Buey / Agua / Yin (Gui-Chou).
 *
 * Limitación honesta (§1.3): el año chino no empieza el 1 de enero sino en el
 * Año Nuevo chino (finales de enero / febrero). Para nacimientos en esa ventana,
 * `cnyCaveat = true` y el animal puede ser el del año anterior. La precisión total
 * (pilares de mes/día/hora) requiere el calendario solar completo (pipeline pyswisseph).
 */

const ANIMALS = [
  'Rata', 'Buey', 'Tigre', 'Conejo', 'Dragón', 'Serpiente',
  'Caballo', 'Cabra', 'Mono', 'Gallo', 'Perro', 'Cerdo',
] as const;

/** Troncos celestes (Tian Gan), en pinyin. */
const STEMS = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'] as const;

/** Elementos por pares de años (último dígito): 0-1 Metal, 2-3 Agua, 4-5 Madera, 6-7 Fuego, 8-9 Tierra. */
const ELEMENTS = ['Metal', 'Agua', 'Madera', 'Fuego', 'Tierra'] as const;

export interface ChineseZodiac {
  animal: string;
  element: string;
  polarity: 'Yin' | 'Yang';
  /** Pilar de año (tronco · rama), p.ej. "Gui · Buey". */
  yearPillar: string;
  /** true si el nacimiento cae en la ventana del Año Nuevo chino (animal potencialmente anterior). */
  cnyCaveat: boolean;
}

/** Acceso seguro con módulo (respeta noUncheckedIndexedAccess). */
function nth<T>(arr: readonly T[], i: number): T {
  const idx = ((i % arr.length) + arr.length) % arr.length;
  const v = arr[idx];
  if (v === undefined) throw new Error(`Índice fuera de rango: ${i}`);
  return v;
}

export function getChineseAnimal(year: number): string {
  return nth(ANIMALS, year - 4);
}

export function getChineseElement(year: number): string {
  const lastDigit = ((year % 10) + 10) % 10;
  return nth(ELEMENTS, Math.floor(lastDigit / 2));
}

export function getChinesePolarity(year: number): 'Yin' | 'Yang' {
  return year % 2 === 0 ? 'Yang' : 'Yin';
}

export function getYearPillar(year: number): string {
  return `${nth(STEMS, year - 4)} · ${getChineseAnimal(year)}`;
}

/**
 * @param year año gregoriano de nacimiento
 * @param month mes (1-12), opcional — necesario para detectar la ventana del Año Nuevo chino
 * @param day día (1-31), opcional
 */
export function computeChineseZodiac(year: number, month?: number, day?: number): ChineseZodiac {
  const inCnyWindow =
    month !== undefined && (month === 1 || (month === 2 && (day ?? 1) <= 20));
  return {
    animal: getChineseAnimal(year),
    element: getChineseElement(year),
    polarity: getChinesePolarity(year),
    yearPillar: getYearPillar(year),
    cnyCaveat: inCnyWindow,
  };
}
