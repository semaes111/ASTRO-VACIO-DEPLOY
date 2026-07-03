/**
 * Construye el bloque "DATOS CALCULADOS" que se inyecta en el prompt del motor
 * genérico para los productos con núcleo computacional, aplicando el patrón
 * compute-then-narrate (§1.3): el LLM recibe los valores ya calculados y solo
 * los redacta; nunca los recalcula ni inventa.
 *
 * Devuelve '' para productos que no requieren cómputo determinista (los demás
 * ya reciben la carta natal real vía computeNatalChart).
 */
import { computeNumerology } from '@/lib/astrology/numerology';
import { computeChineseZodiac } from '@/lib/astrology/chinese-zodiac';

export function buildComputedFacts(slug: string, fullName: string, birthDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (slug === 'numerologia') {
    const n = computeNumerology(fullName, birthDate);
    return [
      'DATOS CALCULADOS — numerología pitagórica. Usa estos valores EXACTOS, NO los recalcules:',
      `- Camino de Vida: ${n.lifePath}`,
      `- Expresión / Destino: ${n.expression}`,
      `- Impulso del Alma: ${n.soulUrge}`,
      `- Personalidad: ${n.personality}`,
      `- Año Personal ${n.targetYear}: ${n.personalYear}`,
    ].join('\n');
  }

  if (slug === 'horoscopo-chino') {
    const z = computeChineseZodiac(year, month, day);
    const lines = [
      'DATOS CALCULADOS — zodiaco chino. Usa estos valores EXACTOS, NO los recalcules ni inventes otros:',
      `- Animal: ${z.animal}`,
      `- Elemento: ${z.element}`,
      `- Polaridad: ${z.polarity}`,
      `- Pilar del año (tronco · rama): ${z.yearPillar}`,
    ];
    if (z.cnyCaveat) {
      lines.push(
        '- NOTA: nacido cerca del Año Nuevo chino; si la fecha exacta es anterior al Año Nuevo de ese año, el animal es el del año previo. Menciónalo con elegancia.',
      );
    }
    lines.push(
      '- Pilares de mes/día/hora: explica el concepto pero NO inventes animales concretos para ellos (requieren el calendario solar completo).',
    );
    return lines.join('\n');
  }

  return '';
}
