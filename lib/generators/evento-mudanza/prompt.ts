/**
 * Prompt para el informe "Mudanza" (slug: evento-mudanza).
 *
 * Producto del catálogo:
 *   slug:               evento-mudanza
 *   name_es:            Mudanza
 *   tagline:            "Cerrar y abrir puertas en armonía"
 *   product_type:       evento_mudanza
 *   tier:               paid (€29)
 *   theme_slug:         hogar-nuevo
 *   primary_color:      #B45309
 *   accent_color:       #FDBA74
 *   hero_icon:          ♂♃
 *   word_count_target:  5500
 *   ai_model:           claude-sonnet-4-5-20250929
 *   estimated_minutes:  4
 *
 * Required inputs:
 *   - person (natal_chart):     datos de nacimiento del titular
 *   - current_address (text):   dirección actual
 *   - new_address (text):       nueva dirección
 *   - move_date_target (date):  fecha objetivo de mudanza
 *
 * Estructura del informe (5 secciones HTML):
 *   S1. Tu carta y el hogar — la casa 4, la Luna, lo que para ti significa "casa"
 *   S2. La ventana del cielo — análisis de tránsitos a la fecha objetivo
 *   S3. Cerrando el hogar anterior — el ritual de despedida y los hilos kármicos del lugar
 *   S4. Abriendo la casa nueva — primera entrada, primera noche, los días siguientes
 *   S5. Calendario de transición:
 *        5.1 — Los 30 días alrededor de la fecha objetivo
 *        5.2 — Días alternativos óptimos + días a evitar en los 90 días siguientes
 */

import type { NatalChart } from '@/lib/astronomy/planets';
import type { OptimalDay } from '@/lib/generators/_shared/optimal-days';

export interface EventoMudanzaPromptInput {
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
  /** Dirección actual (texto libre) */
  currentAddress: string;
  /** Nueva dirección */
  newAddress: string;
  /** Fecha objetivo de mudanza 'YYYY-MM-DD' */
  moveDateTarget: string;
  /** Tránsitos a esa fecha (chart calculado para move_date_target) */
  transitChart: NatalChart;
  /** Día de la semana de la fecha de mudanza (en español) */
  moveDayOfWeek: string;
  /**
   * Cinco mejores días alternativos en una ventana ±90 días, calculados
   * por `findOptimalDays`. Si está vacío, el prompt omite la sección 5.2
   * de alternativas (caso edge: ventana sin días favorables claros).
   */
  alternativeDays: OptimalDay[];
  /**
   * Tres peores días en la misma ventana, para que el cliente los conozca
   * y los evite si tiene flexibilidad logística. Puede estar vacío.
   */
  daysToAvoid: OptimalDay[];
  /** Color primario del template */
  primaryColor: string;
  /** Color de acento del template */
  accentColor: string;
  /** Template HTML de referencia */
  templateHtml: string;
}

export interface EventoMudanzaPrompt {
  system: string;
  user: string;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `Eres un astrólogo de orientación clásica especializado en electional astrology aplicada al hogar (casa 4 en astrología tradicional). Tu enfoque combina el rigor de William Lilly y la astrología hindú del Vastu para mudanzas, fundaciones de casa y umbralidad. Tu voz es contemporánea pero anclada en la tradición — el lector debe sentir que hay siglos de oficio detrás de cada afirmación.

REGLAS DE REDACCIÓN:
1. Escribes en español de España, en segunda persona singular.
2. Cada afirmación se ancla en una posición astronómica concreta del input. Si dices "tu Luna pide…", citas la posición exacta y por qué.
3. Términos técnicos (tránsito, casa 4, IC, Luna void of course, recepción mutua) se explican brevemente en su primera aparición.
4. Reconoces que la mudanza es una transición psicológica, no solo logística. El cielo refleja el ritmo del proceso, no lo dicta.
5. Tono pragmático y serio. Evitas frases como "el universo te bendice esta mudanza". Solo dices lo que el chart sostiene.
6. No inventas datos. Si no hay birth_time → no hay ascendente ni IC → trabajas sin ellos y lo señalas.
7. Tejes el texto: cada sección informa la siguiente.

REGLAS DE ELECTIONAL ASTROLOGY APLICADAS A MUDANZA:
- El significador del hogar es la **Casa 4** (Imum Coeli, IC) y la **Luna** (raíces, base, alimento, sentimiento de pertenencia).
- Saturno es el ancla material (estructura, paredes, contratos), Júpiter es la expansión y la suerte de la nueva casa.
- Marte regente del hogar es alarma — exige cuidado con accidentes el día del traslado, conflictos con vecinos o problemas estructurales.
- Una ventana favorable cumple: (a) Luna no vacía de curso (void of course) en el momento de cruzar el umbral nuevo, (b) Luna en buen aspecto a Júpiter o Venus, (c) ningún tránsito severo de Saturno o Plutón sobre el IC natal del titular, (d) regente del IC natal en buena dignidad esencial.
- Si el día objetivo es desfavorable, lo dices con claridad y propones 2-3 alternativas concretas (días cercanos o franjas horarias).
- Si el día es razonable, das hora óptima del cruce de umbral basada en cuál de los benéficos está sobre el horizonte.

REGLAS ESPECÍFICAS DE MUDANZA:
- Distingues entre "salir de la casa antigua" y "entrar en la casa nueva" — son dos eventos astrológicos separados aunque ocurran el mismo día. Cada uno tiene su propia ventana óptima.
- "Primera noche durmiendo en la casa nueva" es astrológicamente más significativa que "el día del camión". El hogar se establece cuando la cabeza del titular toca la almohada por primera vez allí.
- Si hay tiempo entre cierre y apertura (ej: vacaciones intermedias, hotel), lo mencionas como "tiempo de umbral" — un período liminal con sus propias necesidades simbólicas.

REGLAS DE LA SECCIÓN 5 (CALENDARIO):
- La S5 tiene DOS sub-secciones obligatorias:
  · 5.1 — Los 30 días alrededor de la fecha objetivo del cliente (calendario inmediato).
  · 5.2 — Si necesita reconsiderar: los mejores días alternativos en los próximos 90 días + los días a evitar.
- En 5.2 NUNCA presionas al cliente para que cambie su fecha si el día objetivo es razonable. La sub-sección se presenta como "por si la logística externa te obliga a moverla". Si la fecha objetivo es desfavorable, sí adviertes claramente y enmarcas las alternativas como recomendación más fuerte.
- Las alternativas vienen pre-calculadas en el bloque DÍAS ALTERNATIVOS del user prompt — NO inventes días tú. Usa solo los listados.
- Cada alternativa debe ir acompañada de su justificación astrológica (las razones del scoring) traducidas a lenguaje claro y útil para el cliente.

REGLAS DE SEGURIDAD:
- Nunca afirmas "vas a tener accidentes en la mudanza" ni nada similar. Hablas de tendencias y precauciones.
- No das consejo legal sobre contratos de alquiler o compraventa.
- No das consejo arquitectónico ni de feng shui literal — la astrología no decide cómo distribuir muebles.
- Las recomendaciones son complementarias al juicio profesional (gestor inmobiliario, abogado), no sustitutas.

REGLAS DE FORMATO HTML:
- Devuelves solo HTML semántico válido, SIN <html>, <head> ni <body>.
- Usa <section class="emz-section" id="seccion-{N}"> para cada una de las 5 secciones.
- Títulos <h2> para cada sección, <h3> para subsecciones internas.
- Párrafos <p> sin clases adicionales.
- Listas <ul> / <ol> para enumeraciones.
- <em> para términos astrológicos técnicos, <strong> para alertas o conclusiones clave.
- Una tabla <table class="emz-table"> en la sección 5 con el calendario de los 30 días alrededor del traslado. Máximo una tabla por informe.
- No uses <div> anidados ni estilos inline.

LONGITUD OBJETIVO: 5800 palabras totales, repartidas: S1=900, S2=1300, S3=1100, S4=1100, S5=1400 (5.1=900 + 5.2=500).`;

// ============================================================
// USER PROMPT BUILDER
// ============================================================

/**
 * Bloque ASCII compacto con posiciones planetarias.
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
    // El IC es exactamente opuesto al MC (180°), pero como no calculamos
    // el MC explícitamente, lo dejamos para el modelo.
  } else {
    lines.push('  Ascendente / IC: no calculables (falta hora de nacimiento)');
  }
  return lines.join('\n');
}

/**
 * Aspectos mayores tránsito → natal con orbe < 6°.
 */
function findMajorTransits(natal: NatalChart, transit: NatalChart): string[] {
  const ASPECTS: Array<[number, string]> = [
    [0,   'conjunción'],
    [60,  'sextil'],
    [90,  'cuadratura'],
    [120, 'trígono'],
    [180, 'oposición'],
  ];
  const ORB = 6;

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
 * Formatea los días alternativos y a evitar para incluirlos en el user prompt.
 * Cada día se serializa con su fecha, día de la semana, score y razones —
 * el LLM tiene así material concreto para redactar la justificación al
 * cliente sin inventar nada.
 */
function formatOptimalDaysBlock(
  favorable: OptimalDay[],
  unfavorable: OptimalDay[],
): string {
  const lines: string[] = [];

  if (favorable.length === 0 && unfavorable.length === 0) {
    return '  (Ventana sin días favorables ni desfavorables destacados — ' +
      'omite la sección 5.2 o explícale al cliente que el período es estable.)';
  }

  if (favorable.length > 0) {
    lines.push(`  TOP ${favorable.length} DÍAS FAVORABLES (orden decreciente de score):`);
    for (const d of favorable) {
      lines.push(`  · ${d.date} (${d.day_of_week}) — score ${d.score.toFixed(1)}`);
      for (const r of d.reasons) {
        lines.push(`      · ${r}`);
      }
    }
  }

  if (unfavorable.length > 0) {
    lines.push('');
    lines.push(`  TOP ${unfavorable.length} DÍAS A EVITAR (orden creciente de score):`);
    for (const d of unfavorable) {
      lines.push(`  · ${d.date} (${d.day_of_week}) — score ${d.score.toFixed(1)}`);
      for (const r of d.reasons) {
        lines.push(`      · ${r}`);
      }
    }
  }

  return lines.join('\n');
}

export function buildEventoMudanzaPrompt(
  input: EventoMudanzaPromptInput,
): EventoMudanzaPrompt {
  const {
    userName, birthDate, birthTime, birthPlace,
    chart, currentAddress, newAddress, moveDateTarget,
    transitChart, moveDayOfWeek,
    alternativeDays, daysToAvoid,
    primaryColor, accentColor, templateHtml,
  } = input;

  const natalBlock = formatChartBlock(chart, 'CARTA NATAL');
  const transitBlock = formatChartBlock(transitChart, `TRÁNSITOS al ${moveDateTarget}`);
  const aspects = findMajorTransits(chart, transitChart);
  const aspectsBlock = aspects.length > 0
    ? aspects.map(a => `  ${a}`).join('\n')
    : '  (Sin aspectos mayores con orbe < 6°)';

  const templateExcerpt = templateHtml.length > 8000
    ? templateHtml.slice(0, 8000) + '\n<!-- ... template continúa, truncado ... -->'
    : templateHtml;

  const userPrompt = `Genera el informe "Mudanza" para ${userName}.

DATOS DEL TITULAR
=================
Nombre: ${userName}
Fecha de nacimiento: ${birthDate}
Hora de nacimiento: ${birthTime ?? '(no disponible — el ascendente y el IC no se calculan)'}
Lugar de nacimiento: ${birthPlace ?? '(no especificado)'}

DATOS DE LA MUDANZA
===================
Dirección actual: ${currentAddress}
Nueva dirección: ${newAddress}
Fecha objetivo: ${moveDateTarget} (${moveDayOfWeek})

POSICIONES PLANETARIAS
======================
${natalBlock}

${transitBlock}

ASPECTOS MAYORES (tránsito → natal, orbe < 6°)
==============================================
${aspectsBlock}

DÍAS ALTERNATIVOS (pre-calculados — usar SOLO estos en S5.2)
============================================================
${formatOptimalDaysBlock(alternativeDays, daysToAvoid)}

PALETA VISUAL DEL TEMPLATE
==========================
Color primario: ${primaryColor}
Color de acento: ${accentColor}
Estos colores los aplica el wrapper externo — NO los uses en el HTML que devuelves.

REFERENCIA DE ESTILO Y ESTRUCTURA (template)
=============================================
A continuación tienes un fragmento del template HTML pre-diseñado para este producto. Úsalo como REFERENCIA DE ESTILO Y ESTRUCTURA: cómo organiza secciones, qué tono visual transmite. NO lo copies literalmente. NO copies sus datos. Tu trabajo es producir HTML semántico nuevo siguiendo las REGLAS DE FORMATO HTML del system prompt, con CONTENIDO completamente personalizado para ${userName} y su mudanza del ${currentAddress} al ${newAddress} el ${moveDateTarget}.

\`\`\`html
${templateExcerpt}
\`\`\`

INSTRUCCIONES FINALES
=====================
1. Genera las 5 secciones según la estructura del system prompt (S1–S5).
2. Empieza directamente con <section class="emz-section" id="seccion-1">…
3. NO incluyas <html>, <head>, <body>, <doctype>, ni texto fuera de las <section>.
4. Devuelve SOLO el HTML del cuerpo del informe.
5. Sé específico: usa las posiciones reales del bloque de "POSICIONES PLANETARIAS" como anclas.
6. Distingue claramente entre el cierre del hogar antiguo (S3) y la apertura del nuevo (S4).
7. En S5, genera una tabla <table class="emz-table"> con un calendario de 30 días (15 antes + 15 después del traslado) marcando: días favorables (✦), neutros (·), desfavorables (✗). Justifica con 1 línea cada día clave.

Comienza ahora con la sección 1.`;

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
  };
}
