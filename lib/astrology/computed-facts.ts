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
import { computeTransits } from '@/lib/astronomy/transits';
import { computeSolarReturn } from '@/lib/astronomy/solar-return';
import { computeIChing } from '@/lib/astrology/iching';

/** Productos cuya narrativa depende de tránsitos reales datados (§1.3). */
const TRANSIT_PRODUCTS = new Set(['revolucion-solar', 'neg-financiero-anual', 'amistad-karmica']);

export function buildComputedFacts(slug: string, fullName: string, birthDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) return '';
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (slug === 'numerologia') {
    const n = computeNumerology(fullName, birthDate);
    const karmic =
      n.karmicLessons.length > 0
        ? n.karmicLessons.join(', ')
        : 'ninguna (el nombre contiene los 9 dígitos; kármicamente completo)';
    const gridStr = Object.entries(n.pythagoreanGrid)
      .filter(([, c]) => c > 0)
      .map(([d, c]) => `${d}×${c}`)
      .join(', ');
    return [
      'DATOS CALCULADOS — numerología pitagórica. Usa estos valores EXACTOS, NO los recalcules:',
      `- Camino de Vida: ${n.lifePath}`,
      `- Expresión / Destino: ${n.expression}`,
      `- Impulso del Alma: ${n.soulUrge}`,
      `- Personalidad: ${n.personality}`,
      `- Año Personal ${n.targetYear}: ${n.personalYear}`,
      `- Lecciones Kármicas (dígitos ausentes en el nombre): ${karmic}`,
      `- Cuadrado Pitagórico (frecuencia de dígitos en la fecha): ${gridStr}; dígito rector: ${n.pythagoreanRuler}`,
      `- Consigna del próximo ciclo (Año Personal ${n.targetYear + 1}): ${n.nextCycleYear}`,
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

  if (TRANSIT_PRODUCTS.has(slug)) {
    const birth = new Date(Date.UTC(year, month - 1, day, 12));
    const from = new Date();
    const to = new Date(from.getTime() + 365 * 86400000);
    // Significativos: Júpiter/Saturno (timing personal) siempre; exteriores solo si son muy exactos.
    const sig = computeTransits(birth, from, to)
      .filter((c) => c.transiting === 'Júpiter' || c.transiting === 'Saturno' || c.orb <= 0.5)
      .slice(0, 16);
    if (sig.length === 0) return '';
    return [
      'DATOS CALCULADOS — tránsitos reales datados del año (efemérides astronómicas). Usa estas fechas y aspectos EXACTOS, NO inventes otros ni cambies las fechas:',
      ...sig.map(
        (c) => `- ${c.date}: ${c.transiting} ${c.aspectSymbol} ${c.natalPoint} natal (orbe ${c.orb}°)`,
      ),
    ].join('\n');
  }

  if (slug === 'oraculo-360') {
    const birth = new Date(Date.UTC(year, month - 1, day, 12));
    const targetYear = new Date().getUTCFullYear();
    const n = computeNumerology(fullName, birthDate);
    const z = computeChineseZodiac(year, month, day);
    const sr = computeSolarReturn(birth, targetYear);
    const from = new Date();
    const to = new Date(from.getTime() + 365 * 86400000);
    const tr = computeTransits(birth, from, to)
      .filter((c) => c.transiting === 'Júpiter' || c.transiting === 'Saturno' || c.orb <= 0.4)
      .slice(0, 12);
    const ich = computeIChing(fullName, birthDate);
    return [
      'DATOS CALCULADOS — INFORME INTEGRAL. Usa TODOS estos valores EXACTOS, NO recalcules ni inventes ninguno:',
      '[NUMEROLOGÍA]',
      `- Camino de Vida ${n.lifePath} · Expresión ${n.expression} · Alma ${n.soulUrge} · Personalidad ${n.personality}`,
      `- Año Personal ${n.targetYear}: ${n.personalYear} · Cuadrado Pitagórico rector ${n.pythagoreanRuler} · Consigna próximo ciclo ${n.nextCycleYear}`,
      '[ZODIACO CHINO]',
      `- ${z.animal} de ${z.element} (${z.polarity}); pilar de año ${z.yearPillar}`,
      `[REVOLUCIÓN SOLAR ${targetYear}]`,
      `- Retorno solar exacto: ${sr.moment.toISOString()} (el Sol vuelve a ${sr.natalSunLongitude.toFixed(2)}° tropicales)`,
      `- Luna de la Revolución Solar en ${sr.chart.moon.sign_tropical}`,
      '[TRÁNSITOS DATADOS DEL AÑO]',
      ...tr.map(
        (c) => `- ${c.date}: ${c.transiting} ${c.aspectSymbol} ${c.natalPoint} natal (orbe ${c.orb}°)`,
      ),
      '[ORÁCULO I CHING]',
      `- Hexagrama ${ich.number}: ${ich.name} (${ich.upperTrigram} sobre ${ich.lowerTrigram}), línea cambiante ${ich.changingLine}`,
    ].join('\n');
  }

  if (slug === 'iching') {
    const h = computeIChing(fullName, birthDate);
    return [
      'DATOS CALCULADOS — I Ching. El hexagrama está SEMBRADO de forma determinista desde los datos natales (misma carta → mismo hexagrama). Usa EXACTAMENTE este hexagrama, NO elijas ni inventes otro:',
      `- Hexagrama ${h.number}: ${h.name}`,
      `- Trigrama superior: ${h.upperTrigram} · Trigrama inferior: ${h.lowerTrigram}`,
      `- Línea cambiante: ${h.changingLine}`,
    ].join('\n');
  }

  return '';
}
