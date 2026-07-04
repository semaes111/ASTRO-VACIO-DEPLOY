/**
 * I Ching DETERMINISTA — patrón compute-then-narrate (§1.3).
 *
 * Siembra un hexagrama de forma REPRODUCIBLE desde los datos de nacimiento
 * (hash FNV-1a de nombre + fecha): misma carta → mismo hexagrama, siempre.
 * No es azar; es un espejo simbólico estable, como describe la tradición del
 * oráculo sembrado. El LLM interpreta el hexagrama dado; nunca lo elige.
 *
 * La tabla es la secuencia King Wen (1-64) con nombres en español y sus
 * trigramas superior/inferior (tradición Wilhelm/Baynes) — datos factuales.
 */

interface Hexagram {
  name: string;
  upper: string;
  lower: string;
}

// Secuencia King Wen 1..64: [nombre, trigrama superior, trigrama inferior]
const HEXAGRAMS: readonly Hexagram[] = [
  { name: 'Lo Creativo', upper: 'Cielo', lower: 'Cielo' },
  { name: 'Lo Receptivo', upper: 'Tierra', lower: 'Tierra' },
  { name: 'La Dificultad Inicial', upper: 'Agua', lower: 'Trueno' },
  { name: 'La Necedad Juvenil', upper: 'Montaña', lower: 'Agua' },
  { name: 'La Espera', upper: 'Agua', lower: 'Cielo' },
  { name: 'El Conflicto', upper: 'Cielo', lower: 'Agua' },
  { name: 'El Ejército', upper: 'Tierra', lower: 'Agua' },
  { name: 'La Solidaridad', upper: 'Agua', lower: 'Tierra' },
  { name: 'La Fuerza Domesticadora de lo Pequeño', upper: 'Viento', lower: 'Cielo' },
  { name: 'El Porte', upper: 'Cielo', lower: 'Lago' },
  { name: 'La Paz', upper: 'Tierra', lower: 'Cielo' },
  { name: 'El Estancamiento', upper: 'Cielo', lower: 'Tierra' },
  { name: 'Comunidad con los Hombres', upper: 'Cielo', lower: 'Fuego' },
  { name: 'La Posesión de lo Grande', upper: 'Fuego', lower: 'Cielo' },
  { name: 'La Modestia', upper: 'Tierra', lower: 'Montaña' },
  { name: 'El Entusiasmo', upper: 'Trueno', lower: 'Tierra' },
  { name: 'El Seguimiento', upper: 'Lago', lower: 'Trueno' },
  { name: 'El Trabajo en lo Echado a Perder', upper: 'Montaña', lower: 'Viento' },
  { name: 'El Acercamiento', upper: 'Tierra', lower: 'Lago' },
  { name: 'La Contemplación', upper: 'Viento', lower: 'Tierra' },
  { name: 'La Mordedura Tajante', upper: 'Fuego', lower: 'Trueno' },
  { name: 'La Gracia', upper: 'Montaña', lower: 'Fuego' },
  { name: 'La Desintegración', upper: 'Montaña', lower: 'Tierra' },
  { name: 'El Retorno', upper: 'Tierra', lower: 'Trueno' },
  { name: 'La Inocencia', upper: 'Cielo', lower: 'Trueno' },
  { name: 'La Fuerza Domesticadora de lo Grande', upper: 'Montaña', lower: 'Cielo' },
  { name: 'La Nutrición', upper: 'Montaña', lower: 'Trueno' },
  { name: 'La Preponderancia de lo Grande', upper: 'Lago', lower: 'Viento' },
  { name: 'Lo Abismal', upper: 'Agua', lower: 'Agua' },
  { name: 'Lo Adherente', upper: 'Fuego', lower: 'Fuego' },
  { name: 'El Influjo', upper: 'Lago', lower: 'Montaña' },
  { name: 'La Duración', upper: 'Trueno', lower: 'Viento' },
  { name: 'La Retirada', upper: 'Cielo', lower: 'Montaña' },
  { name: 'El Poder de lo Grande', upper: 'Trueno', lower: 'Cielo' },
  { name: 'El Progreso', upper: 'Fuego', lower: 'Tierra' },
  { name: 'El Oscurecimiento de la Luz', upper: 'Tierra', lower: 'Fuego' },
  { name: 'El Clan', upper: 'Viento', lower: 'Fuego' },
  { name: 'El Antagonismo', upper: 'Fuego', lower: 'Lago' },
  { name: 'El Impedimento', upper: 'Agua', lower: 'Montaña' },
  { name: 'La Liberación', upper: 'Trueno', lower: 'Agua' },
  { name: 'La Merma', upper: 'Montaña', lower: 'Lago' },
  { name: 'El Aumento', upper: 'Viento', lower: 'Trueno' },
  { name: 'El Desbordamiento', upper: 'Lago', lower: 'Cielo' },
  { name: 'El Ir al Encuentro', upper: 'Cielo', lower: 'Viento' },
  { name: 'La Reunión', upper: 'Lago', lower: 'Tierra' },
  { name: 'La Subida', upper: 'Tierra', lower: 'Viento' },
  { name: 'La Desazón', upper: 'Lago', lower: 'Agua' },
  { name: 'El Pozo de Agua', upper: 'Agua', lower: 'Viento' },
  { name: 'La Revolución', upper: 'Lago', lower: 'Fuego' },
  { name: 'El Caldero', upper: 'Fuego', lower: 'Viento' },
  { name: 'Lo Suscitativo', upper: 'Trueno', lower: 'Trueno' },
  { name: 'El Aquietamiento', upper: 'Montaña', lower: 'Montaña' },
  { name: 'La Evolución', upper: 'Viento', lower: 'Montaña' },
  { name: 'La Muchacha que se Casa', upper: 'Trueno', lower: 'Lago' },
  { name: 'La Plenitud', upper: 'Trueno', lower: 'Fuego' },
  { name: 'El Andariego', upper: 'Fuego', lower: 'Montaña' },
  { name: 'Lo Suave', upper: 'Viento', lower: 'Viento' },
  { name: 'Lo Sereno', upper: 'Lago', lower: 'Lago' },
  { name: 'La Disolución', upper: 'Viento', lower: 'Agua' },
  { name: 'La Restricción', upper: 'Agua', lower: 'Lago' },
  { name: 'La Verdad Interior', upper: 'Viento', lower: 'Lago' },
  { name: 'La Preponderancia de lo Pequeño', upper: 'Trueno', lower: 'Montaña' },
  { name: 'Después de la Consumación', upper: 'Agua', lower: 'Fuego' },
  { name: 'Antes de la Consumación', upper: 'Fuego', lower: 'Agua' },
];

export interface IChingReading {
  /** Número del hexagrama en la secuencia King Wen (1-64). */
  number: number;
  name: string;
  upperTrigram: string;
  lowerTrigram: string;
  /** Línea cambiante (1-6), también sembrada de forma determinista. */
  changingLine: number;
}

/** Hash determinista de 32 bits (FNV-1a) de una cadena. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Siembra el hexagrama del cliente desde sus datos de nacimiento.
 * @param birthDate ISO 'YYYY-MM-DD'
 */
export function computeIChing(fullName: string, birthDate: string): IChingReading {
  // Normaliza acentos (NFD → sin diacríticos) para que 'Martínez' y 'Martinez'
  // produzcan el MISMO hexagrama (reproducibilidad estable por persona, §1.3).
  const normalized = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const seed = fnv1a(`${normalized}|${birthDate}`);
  const index = seed % 64;
  const changingLine = (Math.floor(seed / 64) % 6) + 1;
  const hex = HEXAGRAMS[index];
  if (hex === undefined) throw new Error(`Hexagrama fuera de rango: ${index}`);
  return {
    number: index + 1,
    name: hex.name,
    upperTrigram: hex.upper,
    lowerTrigram: hex.lower,
    changingLine,
  };
}
