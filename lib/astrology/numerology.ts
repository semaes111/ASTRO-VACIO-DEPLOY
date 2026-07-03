/**
 * Numerología pitagórica DETERMINISTA — patrón compute-then-narrate.
 *
 * Cumple el Protocolo de Veracidad (CLAUDE-MASTER.md §1.3): estas cifras se
 * calculan en código verificable, NO las inventa el LLM. Funciones puras:
 * misma entrada → misma salida, reproducible.
 *
 * Validado contra datos reales ("Sergio Martínez Escobar", 30/06/1973):
 *   Camino 11 · Expresión 8 · Alma 11 · Personalidad 6 · Año Personal 2026 = 1
 */

const VOWELS: ReadonlySet<string> = new Set(['A', 'E', 'I', 'O', 'U']);

export interface NumerologyResult {
  lifePath: number;
  expression: number;
  soulUrge: number;
  personality: number;
  personalYear: number;
  targetYear: number;
}

/** Reduce un entero a un solo dígito, conservando los números maestros 11/22/33. */
export function reduceNumber(n: number, keepMasters = true): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 9) {
    if (keepMasters && (x === 11 || x === 22 || x === 33)) return x;
    x = String(x)
      .split('')
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return x;
}

/** Valor pitagórico: A=1..I=9, J=1..R=9, S=1..Z=8. */
function letterValue(ch: string): number {
  return ((ch.charCodeAt(0) - 65) % 9) + 1;
}

/** Normaliza a A-Z puro: elimina diacríticos (í→i, ñ→n) y pasa a mayúsculas. */
function lettersOnly(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function nameSum(name: string, filter: 'all' | 'vowels' | 'consonants'): number {
  let total = 0;
  for (const ch of lettersOnly(name)) {
    const isVowel = VOWELS.has(ch);
    if (filter === 'vowels' && !isVowel) continue;
    if (filter === 'consonants' && isVowel) continue;
    total += letterValue(ch);
  }
  return total;
}

/** Camino de Vida: reduce mes, día y año por separado (conservando maestros), suma y reduce. */
function lifePathFromDate(year: number, month: number, day: number): number {
  const parts = [reduceNumber(month), reduceNumber(day), reduceNumber(year)];
  return reduceNumber(parts.reduce((a, b) => a + b, 0));
}

/** Año Personal: reduce(mes) + reduce(día) + reduce(añoObjetivo), reducido. */
function personalYearNumber(month: number, day: number, targetYear: number): number {
  return reduceNumber(reduceNumber(month) + reduceNumber(day) + reduceNumber(targetYear));
}

/**
 * Calcula los cinco números nucleares.
 * @param birthDate ISO 'YYYY-MM-DD'
 * @param targetYear año para el "Año Personal" (por defecto, el año UTC actual)
 */
export function computeNumerology(
  fullName: string,
  birthDate: string,
  targetYear: number = new Date().getUTCFullYear(),
): NumerologyResult {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) throw new Error(`Fecha de nacimiento inválida: ${birthDate}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return {
    lifePath: lifePathFromDate(year, month, day),
    expression: reduceNumber(nameSum(fullName, 'all')),
    soulUrge: reduceNumber(nameSum(fullName, 'vowels')),
    personality: reduceNumber(nameSum(fullName, 'consonants')),
    personalYear: personalYearNumber(month, day, targetYear),
    targetYear,
  };
}
