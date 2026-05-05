/**
 * lib/generators/evento-vehiculo/prompt.ts
 *
 * Genera el system prompt + user prompts (uno por sección) para
 * el informe "Compra de Vehículo" usando chunked generation.
 *
 * MODO CHUNKED (nuevo, recomendado):
 *   buildEventoVehiculoChunkedPrompts(input) → {
 *     systemShared: <system + datos comunes, cacheable>,
 *     perSection: [
 *       { id: 's1', user: '...' },
 *       { id: 's2', user: '...' },
 *       ...
 *     ]
 *   }
 *   El generador llama a Sonnet 6 veces en paralelo con system idéntico
 *   (cache hit en 5 de las 6) y user específico por sección.
 *
 * MODO LEGACY (deprecated, mantenido para compat):
 *   buildEventoVehiculoPrompt(input) → { system, user }
 *   1 llamada que pide las 6 secciones de golpe. Lento y frágil.
 */

import type { NatalChart } from '@/lib/astro/types';

// ============================================================
// TIPOS PÚBLICOS
// ============================================================

export interface EventoVehiculoPromptInput {
  userName: string;
  birthDate: string;
  birthTime: string | null;
  birthPlace: string | null;
  chart: NatalChart;
  vehicleType: string;
  purchaseDateTarget: string;
  transitChart: NatalChart;
  purchaseDayOfWeek: string;
  alternativeDays: Array<{
    iso_date: string;
    day_of_week: string;
    score: number;
    reasons: string[];
  }>;
  daysToAvoid: Array<{
    iso_date: string;
    day_of_week: string;
    reasons: string[];
  }>;
  primaryColor: string;
  accentColor: string;
  templateHtml: string;
}

export interface EventoVehiculoPrompt {
  system: string;
  user: string;
}

export type SectionId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6';

export interface ChunkedPromptSection {
  id: SectionId;
  user: string;
}

export interface EventoVehiculoChunkedPrompts {
  /** System prompt + datos comunes. Idéntico para las 6 llamadas → cacheable. */
  systemShared: string;
  /** 6 user prompts específicos, uno por sección. */
  perSection: ChunkedPromptSection[];
}

// ============================================================
// SYSTEM PROMPT BASE (instrucciones de redacción y formato)
// ============================================================

const SYSTEM_BASE = `Eres un astrólogo de orientación clásica especializado en electional astrology (astrología electiva): el arte de elegir el momento adecuado para iniciar empresas con un objeto material — comprar una casa, casarse, firmar contratos, adquirir un vehículo. Tu enfoque combina el rigor de William Lilly y John Frawley con un lenguaje contemporáneo y accesible para el lector hispano.

REGLAS DE REDACCIÓN:
1. Escribes en español de España, en segunda persona singular (tratas al usuario de "tú").
2. Cada afirmación se ancla en una posición astronómica concreta del input. Si dices "tu Marte está fuerte", citas exactamente la posición y por qué.
3. Términos técnicos (tránsito, casa, dignidad, retrogradación, recepción mutua) se explican brevemente en su primera aparición.
4. Tono pragmático y útil. Evitas frases esotéricas vacías como "el universo te alinea". Lo que dices o se sostiene en el chart o no se dice.
5. No inventas datos. Si un dato no está en el input (por ejemplo, no hay birth_time → no hay ascendente), lo reconoces y trabajas con lo disponible.

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
- Devuelves SOLO HTML semántico válido, SIN etiquetas <html>, <head> ni <body>.
- Devuelves UNA sola <section class="ev-section" id="seccion-{N}">…</section> por respuesta.
- Títulos <h2> para la sección, <h3> para subsecciones internas.
- Párrafos <p> sin clases adicionales.
- Listas <ul> / <ol> cuando enumeres precauciones o pasos.
- <em> para términos astrológicos técnicos (tránsito, retrógrado), <strong> para alertas o conclusiones clave.
- Tablas <table class="ev-table"> SOLO cuando se te pida explícitamente (S2 con posiciones planetarias, S6 con días alternativos).
- No uses <div> anidados ni estilos inline. La paleta visual la aplicará el wrapper externo.

CRÍTICO:
- Tu respuesta debe empezar EXACTAMENTE por <section class="ev-section" id="seccion-{N}"> y terminar EXACTAMENTE por </section>.
- NO incluyas otras secciones aunque las menciones (no rompas el chunked).
- NO incluyas comentarios fuera de la sección, ni ningún texto ANTES de <section o DESPUÉS de </section>.`;

// ============================================================
// HELPERS PRIVADOS (formateo de datos astronómicos)
// ============================================================

function formatChartBlock(chart: NatalChart, label: string): string {
  const lines: string[] = [`${label}:`];
  for (const p of chart.planets) {
    const retro = p.retrograde ? ' Rx' : '';
    const houseStr = p.house ? ` · casa ${p.house}` : '';
    lines.push(
      `  ${p.name.padEnd(10)} ${p.sign.padEnd(11)} ${p.degree.toFixed(2).padStart(6)}°${retro}${houseStr}`,
    );
  }
  if (chart.ascendant !== null && chart.ascendant !== undefined) {
    lines.push(`  Ascendente ${chart.ascendantSign ?? ''} ${chart.ascendant.toFixed(2)}°`);
  }
  return lines.join('\n');
}

const ORB_TIGHT = 6;

function findMajorTransits(natal: NatalChart, transit: NatalChart): string[] {
  const aspectTypes = [
    { name: 'conjunción', deg: 0 },
    { name: 'oposición', deg: 180 },
    { name: 'cuadratura', deg: 90 },
    { name: 'trígono', deg: 120 },
    { name: 'sextil', deg: 60 },
  ];
  const result: string[] = [];
  for (const tp of transit.planets) {
    for (const np of natal.planets) {
      const tLong = signToAbsolute(tp.sign, tp.degree);
      const nLong = signToAbsolute(np.sign, np.degree);
      let diff = Math.abs(tLong - nLong);
      if (diff > 180) diff = 360 - diff;
      for (const at of aspectTypes) {
        const orb = Math.abs(diff - at.deg);
        if (orb < ORB_TIGHT) {
          const valencia = ['cuadratura', 'oposición'].includes(at.name)
            ? 'tensión'
            : ['trígono', 'sextil'].includes(at.name)
              ? 'apoyo'
              : 'mezcla';
          result.push(`${tp.name} en tránsito ${at.name} (orbe ${orb.toFixed(1)}°) a tu ${np.name} natal — ${valencia}`);
        }
      }
    }
  }
  return result;
}

const SIGN_ORDER = [
  'Aries','Tauro','Géminis','Cáncer','Leo','Virgo','Libra','Escorpio','Sagitario','Capricornio','Acuario','Piscis',
];
function signToAbsolute(sign: string, degree: number): number {
  const idx = SIGN_ORDER.indexOf(sign);
  return idx * 30 + degree;
}

function vehicleSpecificGuidance(vehicleType: string): string {
  const lower = vehicleType.toLowerCase();
  if (lower.includes('moto')) return 'Vehículo de tracción individual con exposición física directa: Marte tiene peso especial. La protección y la prudencia (S4) deben enfatizarse.';
  if (lower.includes('barco') || lower.includes('velero') || lower.includes('lancha')) return 'Vehículo marítimo: Luna y Neptuno cobran peso especial junto a Mercurio y Marte. Considerar fases lunares y signo de la Luna.';
  if (lower.includes('eléctrico') || lower.includes('electrico')) return 'Vehículo eléctrico: Urano (innovación, electricidad) modula a Mercurio. Evaluar si hay aspectos uránicos al día objetivo.';
  if (lower.includes('comercial') || lower.includes('furgoneta') || lower.includes('camión')) return 'Vehículo de uso comercial: Júpiter (expansión, beneficio profesional) y la casa 10 (carrera) cobran peso adicional.';
  return 'Vehículo de uso personal estándar: el análisis se centra en Mercurio, Marte y aspectos de la Luna del día.';
}

function formatOptimalDaysBlock(
  alternativeDays: EventoVehiculoPromptInput['alternativeDays'],
  daysToAvoid: EventoVehiculoPromptInput['daysToAvoid'],
): string {
  const altLines = alternativeDays.length === 0
    ? ['  (Sin alternativas mejores en ±90 días — el día objetivo es de los más favorables)']
    : alternativeDays.slice(0, 8).map((d, i) => {
        const reasons = d.reasons.slice(0, 3).join('; ');
        return `  ${(i + 1).toString().padStart(2)}. ${d.iso_date} (${d.day_of_week}) — score ${d.score.toFixed(2)} — ${reasons}`;
      });
  const avoidLines = daysToAvoid.length === 0
    ? ['  (Sin días claramente prohibidos en la ventana — usar el juicio del astrólogo)']
    : daysToAvoid.slice(0, 5).map((d, i) => {
        const reasons = d.reasons.slice(0, 2).join('; ');
        return `  ${(i + 1).toString().padStart(2)}. ${d.iso_date} (${d.day_of_week}) — ${reasons}`;
      });
  return `DÍAS FAVORABLES (alternativas):\n${altLines.join('\n')}\n\nDÍAS A EVITAR:\n${avoidLines.join('\n')}`;
}

// ============================================================
// BLOQUE COMÚN DE DATOS (compartido entre las 6 secciones)
// ============================================================

function buildSharedDataBlock(input: EventoVehiculoPromptInput): string {
  const {
    userName, birthDate, birthTime, birthPlace,
    chart, vehicleType, purchaseDateTarget, transitChart,
    purchaseDayOfWeek, alternativeDays, daysToAvoid,
    primaryColor, accentColor, templateHtml,
  } = input;

  const natalBlock = formatChartBlock(chart, 'CARTA NATAL');
  const transitBlock = formatChartBlock(transitChart, `TRÁNSITOS al ${purchaseDateTarget}`);
  const aspects = findMajorTransits(chart, transitChart);
  const aspectsBlock = aspects.length > 0
    ? aspects.map((a) => `  ${a}`).join('\n')
    : '  (Sin aspectos mayores con orbe < 6° — situación astrológica neutra)';
  const vehicleGuidance = vehicleSpecificGuidance(vehicleType);

  // Truncamos a 4K en el modo chunked (vs 8K en sync) - cada llamada paga el
  // input share aunque sea cached. Reduciendo aquí, el cache es más barato.
  const templateExcerpt = templateHtml.length > 4000
    ? templateHtml.slice(0, 4000) + '\n<!-- ... template continúa, truncado ... -->'
    : templateHtml;

  return `===========================================
DATOS DEL CLIENTE Y DEL EVENTO (compartidos)
===========================================

DATOS DEL TITULAR
-----------------
Nombre: ${userName}
Fecha de nacimiento: ${birthDate}
Hora de nacimiento: ${birthTime ?? '(no disponible — el ascendente no se calcula)'}
Lugar de nacimiento: ${birthPlace ?? '(no especificado)'}

DATOS DE LA COMPRA
------------------
Fecha objetivo: ${purchaseDateTarget} (${purchaseDayOfWeek})
Tipo de vehículo: ${vehicleType}

GUÍA ESPECÍFICA DEL VEHÍCULO
----------------------------
${vehicleGuidance}

POSICIONES PLANETARIAS
----------------------
${natalBlock}

${transitBlock}

ASPECTOS MAYORES (tránsito → natal, orbe < 6°)
----------------------------------------------
${aspectsBlock}

DÍAS ALTERNATIVOS (pre-calculados — usar SOLO estos en S6)
----------------------------------------------------------
${formatOptimalDaysBlock(alternativeDays, daysToAvoid)}

PALETA VISUAL DEL TEMPLATE (aplicada por wrapper externo, NO usar en HTML)
-------------------------------------------------------------------------
Color primario: ${primaryColor}
Color de acento: ${accentColor}

REFERENCIA DE ESTILO Y ESTRUCTURA (template, fragmento)
-------------------------------------------------------
\`\`\`html
${templateExcerpt}
\`\`\`
`;
}

// ============================================================
// PROMPTS POR SECCIÓN
// ============================================================

const SECTION_DEFINITIONS: Record<SectionId, { title: string; words: number; instruction: string }> = {
  s1: {
    title: 'Tu carta del viajero',
    words: 900,
    instruction: `Escribe SOLO la sección 1 ("Tu carta del viajero") sobre el TEMPERAMENTO DEL TITULAR respecto al movimiento, los traslados y la relación con vehículos. Debes:
- Analizar la posición de Marte natal (motor, energía, agresividad/prudencia al volante).
- Analizar la posición de Mercurio natal (movilidad, comunicación en ruta, atención).
- Analizar Casa 3 (trayectos cortos) y Casa 9 (trayectos largos) si hay datos de hora de nacimiento.
- Cerrar con una caracterización honesta del titular como "tipo de viajero/conductor".
- Estructura: <h2> de la sección, 4-6 párrafos, opcional <h3> para subsecciones.`,
  },
  s2: {
    title: 'La ventana del cielo',
    words: 1400,
    instruction: `Escribe SOLO la sección 2 ("La ventana del cielo") sobre el ANÁLISIS DEL DÍA OBJETIVO. Debes:
- Presentar UNA tabla <table class="ev-table"> con las posiciones planetarias del día objetivo (Sol, Luna, Mercurio, Venus, Marte, Júpiter, Saturno, columnas: planeta, signo, grado, retrógrado).
- Evaluar si el día objetivo es FAVORABLE / NEUTRO / DESFAVORABLE basándote en los criterios de electional astrology (Luna VOC, Mercurio Rx, Marte afligido, etc.).
- Si hay aspectos mayores (orbe < 6°) entre tránsito y natal, comentarlos: cuáles ayudan, cuáles tensan.
- Si el día es desfavorable, decirlo CLARAMENTE en negrita <strong>.
- Si el día es razonable, sugerir mañana o tarde según cuál benefico esté sobre el horizonte.
- Estructura: <h2>, tabla, 5-8 párrafos.`,
  },
  s3: {
    title: 'El vehículo y tú',
    words: 1200,
    instruction: `Escribe SOLO la sección 3 ("El vehículo y tú") sobre la COMPATIBILIDAD SIMBÓLICA del vehículo con la carta del titular. Debes:
- Tomar el TIPO DE VEHÍCULO indicado en datos comunes y mapearlo simbólicamente (Marte si es deportivo, Saturno si es vehículo de carga, Luna si es marítimo, Urano si es eléctrico, Júpiter si es comercial).
- Analizar cómo encaja con el Marte y Mercurio del titular.
- Reflexionar sobre el tipo de "vínculo" que se establece entre titular y vehículo (transporte funcional, identidad, símbolo de estatus, espacio íntimo móvil).
- Cerrar con una nota de "personalidad del vehículo según los astros" — sin caer en banalidad.
- Estructura: <h2>, 4-5 párrafos. Sin tablas.`,
  },
  s4: {
    title: 'Señales y precauciones',
    words: 1100,
    instruction: `Escribe SOLO la sección 4 ("Señales y precauciones") sobre QUÉ OBSERVAR EL DÍA DE LA FIRMA o entrega. Debes:
- Listar 3-5 PRECAUCIONES concretas en formato <ul> o <ol> basadas en la combinación natal+tránsito.
- Discutir la luna del día (vacía de curso, fase) y qué implica para la transacción.
- Mencionar Mercurio retrógrado si está activo (revisar contrato, leer letra pequeña, comprobar km, antecedentes del coche).
- Discutir aspectos al ascendente o a Saturno (si hay datos).
- IMPORTANTE: enmarcar siempre como "precaución astrológica complementaria al juicio profesional, no sustituto" — no dar consejo legal ni mecánico.
- Estructura: <h2>, 3-4 párrafos + 1 lista <ul> con precauciones.`,
  },
  s5: {
    title: 'Ritual del primer viaje',
    words: 900,
    instruction: `Escribe SOLO la sección 5 ("Ritual del primer viaje") sobre CÓMO INICIAR LA RELACIÓN con el vehículo de manera consciente. Debes:
- Sugerir un pequeño ritual (no esotérico denso, sino simbólico y respetuoso) para el primer viaje: limpieza simbólica, primera ruta consciente, etc.
- Incorporar elementos de la carta del titular (si Venus está fuerte, ritual estético; si Luna está fuerte, ritual emocional; etc.).
- Sugerir 2-3 hábitos de cuidado mensuales en sintonía con el ritmo lunar o planetario.
- Mantener el tono pragmático: nada de incienso ni sahumerios, sino gestos de presencia y atención.
- Estructura: <h2>, 3-4 párrafos + lista <ul> opcional con los hábitos mensuales.`,
  },
  s6: {
    title: 'Calendario alternativo',
    words: 500,
    instruction: `Escribe SOLO la sección 6 ("Calendario alternativo") con DÍAS ÓPTIMOS ALTERNATIVOS en ±90 días.

REGLAS CRÍTICAS:
- Los días vienen pre-calculados en el bloque DÍAS ALTERNATIVOS de los datos comunes. NO inventes días — usa SOLO los listados ahí.
- Si en S2 determinaste que el día objetivo era razonable, ENMARCA esta sección como "por si la logística (concesionario, financiación, vacaciones) te obliga a moverla". NO presiones para cambiar.
- Si en S2 el día era desfavorable, sí adviertes claramente y enmarcas las alternativas como recomendación más fuerte.

ESTRUCTURA OBLIGATORIA:
1. <h2>Calendario alternativo</h2>
2. 1-2 párrafos de introducción (encuadre).
3. Tabla <table class="ev-table"> con días favorables: # | fecha | día semana | hora aproximada óptima si deducible | justificación astrológica concreta.
4. Lista <ul> o tabla pequeña con DÍAS A EVITAR (si la lista no está vacía).
5. Cierre: 1 párrafo con recomendación honesta basada en S2.`,
  },
};

// ============================================================
// API PÚBLICA: CHUNKED MODE (recomendado)
// ============================================================

/**
 * Construye system + 6 user prompts para chunked generation.
 *
 * Uso:
 *   const { systemShared, perSection } = buildEventoVehiculoChunkedPrompts(input);
 *   const results = await Promise.all(
 *     perSection.map((sec) =>
 *       generateWithSonnetStream({
 *         system: systemShared,
 *         user: sec.user,
 *         max_tokens: 2500,
 *         cache_system: true,
 *       })
 *     )
 *   );
 */
export function buildEventoVehiculoChunkedPrompts(
  input: EventoVehiculoPromptInput,
): EventoVehiculoChunkedPrompts {
  // System idéntico para las 6 → cacheable. El SDK Anthropic detecta
  // el match de prefijo y devuelve cache_read_input_tokens > 0 en
  // las 5 llamadas posteriores a la primera.
  const systemShared = `${SYSTEM_BASE}\n\n${buildSharedDataBlock(input)}`;

  const perSection: ChunkedPromptSection[] = (
    Object.entries(SECTION_DEFINITIONS) as Array<[SectionId, typeof SECTION_DEFINITIONS[SectionId]]>
  ).map(([id, def]) => ({
    id,
    user: `Sección ${id.toUpperCase()} — "${def.title}"
Longitud objetivo: ~${def.words} palabras.

${def.instruction}

EMPIEZA TU RESPUESTA EXACTAMENTE POR <section class="ev-section" id="seccion-${id.replace('s', '')}">
TERMINA TU RESPUESTA EXACTAMENTE POR </section>`,
  }));

  return { systemShared, perSection };
}

// ============================================================
// API PÚBLICA: LEGACY MODE (sync, deprecated pero mantenido)
// ============================================================

/**
 * @deprecated Usar buildEventoVehiculoChunkedPrompts() con generateWithSonnetStream.
 * Mantenido para no romper compat retro durante la migración progresiva.
 */
export function buildEventoVehiculoPrompt(
  input: EventoVehiculoPromptInput,
): EventoVehiculoPrompt {
  const dataBlock = buildSharedDataBlock(input);
  const userPrompt = `Genera el informe completo "Compra de Vehículo" para ${input.userName}.

${dataBlock}

INSTRUCCIONES FINALES
=====================
1. Genera las 6 secciones según la estructura del system prompt (S1–S6).
2. Empieza directamente con <section class="ev-section" id="seccion-1">…
3. NO incluyas <html>, <head>, <body>, <doctype>, ni texto fuera de las <section>.
4. Devuelve SOLO el HTML del cuerpo del informe.
5. Sé específico: usa las posiciones reales del bloque de "POSICIONES PLANETARIAS" como anclas.
6. Si los aspectos mayores indican un día desfavorable, dilo en S2 con claridad.
7. En S6, usa SOLO los días del bloque "DÍAS ALTERNATIVOS" (no inventes).

Comienza ahora con la sección 1.`;

  return {
    system: SYSTEM_BASE,
    user: userPrompt,
  };
}
