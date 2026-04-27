/**
 * Prompt para el informe "Compra de Vehículo" (slug: evento-vehiculo).
 *
 * Producto del catálogo:
 *   slug:               evento-vehiculo
 *   name_es:            Compra de Vehículo
 *   tagline:            "El camino que se abre contigo"
 *   product_type:       evento_vehiculo
 *   tier:               paid (€29)
 *   theme_slug:         viento-camino
 *   primary_color:      #92400E
 *   accent_color:       #FED7AA
 *   hero_icon:          ♂☿  (Marte / Mercurio: motor + viaje)
 *   word_count_target:  5500
 *   ai_model:           claude-sonnet-4-5-20250929
 *   estimated_minutes:  4
 *
 * Required inputs:
 *   - person (natal_chart):              datos de nacimiento del titular
 *   - vehicle_type (select):             coche | moto | barco | otro
 *   - purchase_date_target (date):       fecha objetivo de compra
 *
 * Estructura del informe (5 secciones HTML):
 *   S1. Tu carta del viajero — temperamento del titular respecto al movimiento
 *   S2. La ventana del cielo — análisis de tránsitos a la fecha objetivo
 *   S3. El vehículo y tú — compatibilidad simbólica con tu Marte/Mercurio/Sol
 *   S4. Señales y precauciones — qué observar el día de la firma
 *   S5. Ritual del primer viaje — cómo iniciar la relación con el vehículo
 *
 * Tono: pragmático, evita esoterismo vacío. Cada afirmación se ancla en
 * un dato concreto del chart o del tránsito.
 */

import type { NatalChart } from '@/lib/astronomy/planets';

export interface EventoVehiculoPromptInput {
  /** Nombre del titular */
  userName: string;
  /** 'YYYY-MM-DD' */
  birthDate: string;
  /** 'HH:MM' o undefined si no se conoce */
  birthTime?: string;
  /** Lugar de nacimiento legible (texto libre) */
  birthPlace?: string;
  /** Carta natal completa */
  chart: NatalChart;
  /** Tipo de vehículo: 'coche', 'moto', 'barco', 'otro' */
  vehicleType: 'coche' | 'moto' | 'barco' | 'otro';
  /** Fecha objetivo de compra 'YYYY-MM-DD' */
  purchaseDateTarget: string;
  /** Tránsitos a esa fecha (chart calculado para purchase_date_target). */
  transitChart: NatalChart;
  /** Día de la semana de la fecha de compra (en español) */
  purchaseDayOfWeek: string;
  /** Color primario del template (para coherencia visual) */
  primaryColor: string;
  /** Color de acento del template */
  accentColor: string;
  /**
   * Template HTML de referencia (extraído de `astrodorado.report_templates`).
   * Claude lo usa como guía de estructura/estética, NO lo modifica literal.
   * En V1 (referencia): se le pide regenerar siguiendo el estilo.
   * En V2 (slots, futuro): se le pide solo el contenido por slot.
   */
  templateHtml: string;
}

export interface EventoVehiculoPrompt {
  system: string;
  user: string;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `Eres un astrólogo de orientación clásica especializado en electional astrology (astrología electiva): el arte de elegir el momento adecuado para iniciar empresas con un objeto material — comprar una casa, casarse, firmar contratos, adquirir un vehículo. Tu enfoque combina el rigor de William Lilly y John Frawley con un lenguaje contemporáneo y accesible para el lector hispano.

REGLAS DE REDACCIÓN:
1. Escribes en español de España, en segunda persona singular (tratas al usuario de "tú").
2. Cada afirmación se ancla en una posición astronómica concreta del input. Si dices "tu Marte está fuerte", citas exactamente la posición y por qué.
3. Términos técnicos (tránsito, casa, dignidad, retrogradación, recepción mutua) se explican brevemente en su primera aparición.
4. Tono pragmático y útil. Evitas frases esotéricas vacías como "el universo te alinea". Lo que dices o se sostiene en el chart o no se dice.
5. No inventas datos. Si un dato no está en el input (por ejemplo, no hay birth_time → no hay ascendente), lo reconoces y trabajas con lo disponible.
6. Tejes el texto: cada sección fluye a la siguiente, las conclusiones de S1 informan S2, etc.

REGLAS DE ELECTIONAL ASTROLOGY ESPECÍFICAS:
- El significador del vehículo es Mercurio (movilidad, mensajes, comunicación) modulado por Marte (motor, energía, hierro). En vehículos marítimos, también la Luna (agua).
- Una ventana favorable cumple: (a) Luna no vacía de curso al firmar, (b) Mercurio no retrógrado idealmente, (c) Marte no en mala dignidad ni afligido por Saturno o Plutón, (d) ascendente o regente del ascendente en buena condición.
- Si el día objetivo es desfavorable, lo dices con claridad y sugieres alternativas concretas (días cercanos, momentos del día).
- Si el día es razonable, das hora óptima del día (mañana / tarde) basada en cuál de los benéficos está sobre el horizonte.

REGLAS DE SEGURIDAD:
- Nunca afirmas "vas a tener un accidente" ni nada similar. Hablas de tendencias y precauciones, no de fatalidades.
- No das consejo legal ni mecánico. Si recomiendas precaución (revisión técnica, lectura del contrato, comprobación de antecedentes), lo enmarcas como "complementario al juicio profesional, no sustituto".
- No prometes resultados. Hablas de inclinaciones, no de garantías.

REGLAS DE FORMATO HTML:
- Devuelves solo HTML semántico válido, SIN etiquetas <html>, <head> ni <body>.
- Usa <section class="ev-section" id="seccion-{N}"> para cada una de las 5 secciones.
- Títulos <h2> para cada sección, <h3> para subsecciones internas.
- Párrafos <p> sin clases adicionales.
- Listas <ul> / <ol> cuando enumeres precauciones o pasos.
- <em> para términos astrológicos técnicos (tránsito, retrógrado), <strong> para alertas o conclusiones clave.
- Una tabla <table class="ev-table"> en la sección 2 con las posiciones planetarias del día objetivo. Máximo una tabla por informe.
- No uses <div> anidados ni estilos inline. La paleta del informe la aplicará el wrapper externo.

LONGITUD OBJETIVO: 5500 palabras totales, repartidas aproximadamente: S1=900, S2=1400, S3=1200, S4=1100, S5=900.`;

// ============================================================
// USER PROMPT BUILDER
// ============================================================

/**
 * Construye los datos planetarios formateados como bloque ASCII compacto
 * para que Claude pueda procesarlos sin ambigüedad.
 */
function formatChartBlock(chart: NatalChart, label: string): string {
  const planets = [
    ['Sol',      chart.sun],
    ['Luna',     chart.moon],
    ['Mercurio', chart.mercury],
    ['Venus',    chart.venus],
    ['Marte',    chart.mars],
    ['Júpiter',  chart.jupiter],
    ['Saturno',  chart.saturn],
    ['Rahu',     chart.rahu],
    ['Ketu',     chart.ketu],
  ] as const;

  const lines: string[] = [`${label}:`];
  for (const [name, p] of planets) {
    lines.push(
      `  ${name.padEnd(10)} ${p.sign_tropical.padEnd(12)} ` +
      `${p.degree_in_sign_tropical.toFixed(2).padStart(6)}° (trop) | ` +
      `${p.sign_sidereal.padEnd(12)} ${p.degree_in_sign_sidereal.toFixed(2).padStart(6)}° (sid)`,
    );
  }
  if (chart.ascendant) {
    lines.push(
      `  ${'Ascend.'.padEnd(10)} ${chart.ascendant.sign_tropical.padEnd(12)} ` +
      `${chart.ascendant.degree_in_sign_tropical.toFixed(2).padStart(6)}° (trop)`,
    );
  } else {
    lines.push('  Ascendente: no calculable (falta hora de nacimiento)');
  }
  return lines.join('\n');
}

/**
 * Calcula los aspectos mayores (conjunción, oposición, cuadratura, trígono,
 * sextil) entre cada planeta del tránsito y cada planeta natal.
 * Solo aspectos con orbe < 6° se incluyen — el ruido fuera de orbe distrae
 * a Claude y produce informes con relleno.
 */
function findMajorTransits(natal: NatalChart, transit: NatalChart): string[] {
  const ASPECTS: Array<[number, string]> = [
    [0,   'conjunción'],
    [60,  'sextil'],
    [90,  'cuadratura'],
    [120, 'trígono'],
    [180, 'oposición'],
  ];
  const ORB = 6; // grados

  const natalPlanets: Array<[string, number]> = [
    ['Sol',      natal.sun.longitude_tropical],
    ['Luna',     natal.moon.longitude_tropical],
    ['Mercurio', natal.mercury.longitude_tropical],
    ['Venus',    natal.venus.longitude_tropical],
    ['Marte',    natal.mars.longitude_tropical],
    ['Júpiter',  natal.jupiter.longitude_tropical],
    ['Saturno',  natal.saturn.longitude_tropical],
  ];
  const transitPlanets: Array<[string, number]> = [
    ['Sol-tr',      transit.sun.longitude_tropical],
    ['Luna-tr',     transit.moon.longitude_tropical],
    ['Mercurio-tr', transit.mercury.longitude_tropical],
    ['Venus-tr',    transit.venus.longitude_tropical],
    ['Marte-tr',    transit.mars.longitude_tropical],
    ['Júpiter-tr',  transit.jupiter.longitude_tropical],
    ['Saturno-tr',  transit.saturn.longitude_tropical],
  ];

  const out: string[] = [];
  for (const [tName, tLon] of transitPlanets) {
    for (const [nName, nLon] of natalPlanets) {
      let diff = Math.abs(tLon - nLon) % 360;
      if (diff > 180) diff = 360 - diff;
      for (const [angle, aspectName] of ASPECTS) {
        const orb = Math.abs(diff - angle);
        if (orb < ORB) {
          const sign = orb < 1 ? '⚠️' : orb < 3 ? '◉' : '◯';
          out.push(
            `${sign} ${tName} ${aspectName} ${nName} (orbe ${orb.toFixed(1)}°)`,
          );
        }
      }
    }
  }
  return out;
}

/**
 * Construye el bloque de instrucciones específicas según el tipo de vehículo.
 */
function vehicleSpecificGuidance(vehicleType: string): string {
  switch (vehicleType) {
    case 'moto':
      return 'El vehículo es una MOTO. Marte (motor, hierro, riesgo) y Urano (movimiento ágil, libertad) tienen peso extra. La Luna en buen aspecto a Marte sugiere maniobrabilidad emocional con la máquina; en mal aspecto, exige extra prudencia inicial. Insiste en seguridad activa (equipo, cursos, conducción defensiva) sin ser paternalista.';
    case 'barco':
      return 'El vehículo es un BARCO. La Luna (agua, mareas) y Neptuno (mar, niebla) son co-significadores junto a Mercurio. Una Luna bien aspectada y no vacía de curso es esencial. Atiende la posición de Neptuno respecto a Marte y Saturno (riesgo de fugas, mecánica marina). Menciona coherencia con ritmos lunares para botaduras.';
    case 'coche':
      return 'El vehículo es un COCHE. Mercurio (movilidad cotidiana, comunicación) es el significador principal. Marte como motor. Venus como confort y estética. El balance entre estos tres define la relación con el coche en el día a día. Si Mercurio está retrógrado, advierte: revisar dos veces papeles, leer contratos en voz alta.';
    case 'otro':
    default:
      return 'El vehículo no encaja en categorías habituales. Trata al titular como adulto y pide en S1 que reflexione sobre qué función simbólica cumple este vehículo (libertad, oficio, transición vital). Adapta los significadores según esa función — Mercurio si es de transporte, Saturno si es de oficio/trabajo, Júpiter si es de viaje largo.';
  }
}

export function buildEventoVehiculoPrompt(
  input: EventoVehiculoPromptInput,
): EventoVehiculoPrompt {
  const {
    userName, birthDate, birthTime, birthPlace,
    chart, vehicleType, purchaseDateTarget, transitChart,
    purchaseDayOfWeek, primaryColor, accentColor, templateHtml,
  } = input;

  const natalBlock = formatChartBlock(chart, 'CARTA NATAL');
  const transitBlock = formatChartBlock(transitChart, `TRÁNSITOS al ${purchaseDateTarget}`);
  const aspects = findMajorTransits(chart, transitChart);
  const aspectsBlock = aspects.length > 0
    ? aspects.map(a => `  ${a}`).join('\n')
    : '  (Sin aspectos mayores con orbe < 6° — situación astrológica neutra)';

  const vehicleGuidance = vehicleSpecificGuidance(vehicleType);

  // Truncamos el template a 8000 caracteres para no inflar el prompt — Claude
  // solo necesita ver el estilo y la estructura, no el HTML entero. Los 8K
  // primeros caracteres siempre incluyen <head> con estilos + las primeras
  // secciones, que es lo más informativo.
  const templateExcerpt = templateHtml.length > 8000
    ? templateHtml.slice(0, 8000) + '\n<!-- ... template continúa, truncado para el prompt ... -->'
    : templateHtml;

  const userPrompt = `Genera el informe "Compra de Vehículo" para ${userName}.

DATOS DEL TITULAR
=================
Nombre: ${userName}
Fecha de nacimiento: ${birthDate}
Hora de nacimiento: ${birthTime ?? '(no disponible — el ascendente no se calcula)'}
Lugar de nacimiento: ${birthPlace ?? '(no especificado)'}

DATOS DE LA COMPRA
==================
Fecha objetivo: ${purchaseDateTarget} (${purchaseDayOfWeek})
Tipo de vehículo: ${vehicleType}

GUÍA ESPECÍFICA DEL VEHÍCULO
=============================
${vehicleGuidance}

POSICIONES PLANETARIAS
======================
${natalBlock}

${transitBlock}

ASPECTOS MAYORES (tránsito → natal, orbe < 6°)
==============================================
${aspectsBlock}

PALETA VISUAL DEL TEMPLATE
==========================
Color primario: ${primaryColor}
Color de acento: ${accentColor}
Estos colores los aplica el wrapper externo del informe — tú NO los uses en el HTML que devuelves.

REFERENCIA DE ESTILO Y ESTRUCTURA (template)
=============================================
A continuación tienes un fragmento del template HTML pre-diseñado para este producto. Úsalo como REFERENCIA DE ESTILO Y ESTRUCTURA: cómo organiza las secciones, qué elementos enfatiza, qué tono visual transmite. NO lo copies literalmente. NO copies sus datos (esos eran de un cliente de ejemplo). Tu trabajo es producir HTML semántico nuevo siguiendo las REGLAS DE FORMATO HTML del system prompt, con CONTENIDO completamente personalizado para ${userName} y para el ${purchaseDateTarget}.

\`\`\`html
${templateExcerpt}
\`\`\`

INSTRUCCIONES FINALES
=====================
1. Genera las 5 secciones según la estructura del system prompt (S1–S5).
2. Empieza directamente con <section class="ev-section" id="seccion-1">…
3. NO incluyas <html>, <head>, <body>, <doctype>, ni texto fuera de las <section>.
4. Devuelve SOLO el HTML del cuerpo del informe.
5. Sé específico: usa las posiciones reales del bloque de "POSICIONES PLANETARIAS" como anclas. No digas "tu Marte" sin decir en qué signo y grado está.
6. Si los aspectos mayores indican un día desfavorable, dilo en S2 con claridad y sugiere 2-3 ventanas alternativas concretas (ej: "esperar al sábado siguiente", "elegir la franja matinal del lunes").

Comienza ahora con la sección 1.`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}
