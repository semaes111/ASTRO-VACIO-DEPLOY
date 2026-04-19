/**
 * Prompt para generar el informe "Carta Ayurvédica" con Claude Sonnet 4.5.
 *
 * Estructura: 8 secciones HTML semánticas con ~6000 palabras totales.
 * Idioma: español de España.
 * Tono: respeto a la tradición védica + lenguaje contemporáneo accesible.
 *
 * Seguridad: el prompt recuerda explícitamente no dar consejos médicos
 * que requieran diagnóstico profesional.
 */

import type { NatalChart } from '@/lib/astronomy/planets';
import type { PrakritiResult } from '@/lib/ayurveda/doshas';
import type { DashaSnapshot } from '@/lib/ayurveda/dashas';
import type { AmorcCyclesSnapshot } from '@/lib/types/life-cycles';
import { getNakshatraByIndex } from '@/lib/ayurveda/nakshatras';
import { MAHADASHA_THEMES } from '@/lib/ayurveda/dashas';

export interface AyurvedaPromptInput {
  userName: string;
  birthDate: string;       // 'YYYY-MM-DD'
  birthTime?: string;      // 'HH:MM' (opcional)
  birthPlace?: string;
  chart: NatalChart;
  prakriti: PrakritiResult;
  dashaInfo: DashaSnapshot;
  cycles: AmorcCyclesSnapshot | null;
}

export interface AyurvedaPrompt {
  system: string;
  user: string;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `Eres un Acharya védico moderno — un astrólogo ayurvédico formado en la tradición Jyotish de Brihat Parashara Hora Shastra y complementado con el enfoque integrativo de David Frawley y Dhanvantari. Tu voz es firme pero cálida, respetuosa con la tradición milenaria pero accesible para el lector contemporáneo de habla hispana.

REGLAS DE REDACCIÓN:
1. Escribes en español de España, siempre en segunda persona singular (tratas al usuario de "tú").
2. Usas términos sánscritos cuando son intraducibles (Prakriti, Nakshatra, Dasha, Vata/Pitta/Kapha, Dinacharya) pero los explicas en su primera aparición.
3. Evitas el lenguaje esotérico vacío: cada afirmación debe anclarse en la posición astronómica calculada o en la lógica ayurvédica clásica.
4. No inventas datos: si un dato no está en el input, no lo menciones.
5. Tejes el texto: cada sección fluye a la siguiente, no son párrafos desconectados.

REGLAS DE SEGURIDAD:
- Nunca das diagnóstico médico. Cuando mencionas tendencias corporales, añades "si persisten molestias, consulta con un profesional de la salud".
- No recomiendas dejar medicación ni tratamientos prescritos por un médico.
- Las gemas y hierbas son sugerencias tradicionales, no prescripciones.

REGLAS DE FORMATO HTML:
- Devuelves solo HTML semántico válido, sin etiquetas <html>, <head> ni <body>.
- Usa <section class="ayu-section" id="seccion-{N}"> para cada una de las 8 secciones.
- Títulos <h2> para cada sección, <h3> para subsecciones internas.
- Párrafos <p> sin clases adicionales.
- Listas <ul> / <ol> cuando corresponda.
- <em> para términos sánscritos, <strong> para énfasis importantes.
- Una tabla <table class="ayu-table"> por sección máximo, para datos comparativos.
- No uses <div> anidados ni estilos inline.

LONGITUD OBJETIVO: 6000 palabras totales, repartidas aproximadamente: S1=600, S2=900, S3=900, S4=700, S5=800, S6=700, S7=700, S8=700.`;

// ============================================================
// USER PROMPT BUILDER
// ============================================================
export function buildAyurvedaPrompt(input: AyurvedaPromptInput): AyurvedaPrompt {
  const { userName, birthDate, birthTime, birthPlace, chart, prakriti, dashaInfo, cycles } = input;
  const nak = getNakshatraByIndex(chart.moon.nakshatra.index);
  // MAHADASHA_THEMES cubre los 9 planetas Vimshottari, pero TS requiere el fallback.
  const mahaThemeDefault = { titulo: 'Período planetario', positive: 'Energía en desarrollo.', challenge: 'Requiere observación.' };
  const mahaTheme = MAHADASHA_THEMES[dashaInfo.mahadasha.planet] ?? mahaThemeDefault;
  const antarTheme = MAHADASHA_THEMES[dashaInfo.antardasha.planet] ?? mahaThemeDefault;

  const placementsBlock = `
CARTA NATAL SIDÉREA (sistema Lahiri):
- Ascendente (Lagna): ${chart.ascendant ? `${chart.ascendant.sign_sidereal} ${chart.ascendant.degree_in_sign_sidereal.toFixed(2)}°` : 'no calculado (falta hora o lugar)'}
- Sol: ${chart.sun.sign_sidereal} ${chart.sun.degree_in_sign_sidereal.toFixed(2)}°
- LUNA: ${chart.moon.sign_sidereal} ${chart.moon.degree_in_sign_sidereal.toFixed(2)}° en nakshatra ${nak.name} (pada ${chart.moon.nakshatra.pada}), dasha lord natal ${nak.dasha_lord}
- Mercurio: ${chart.mercury.sign_sidereal} ${chart.mercury.degree_in_sign_sidereal.toFixed(2)}°
- Venus: ${chart.venus.sign_sidereal} ${chart.venus.degree_in_sign_sidereal.toFixed(2)}°
- Marte: ${chart.mars.sign_sidereal} ${chart.mars.degree_in_sign_sidereal.toFixed(2)}°
- Júpiter: ${chart.jupiter.sign_sidereal} ${chart.jupiter.degree_in_sign_sidereal.toFixed(2)}°
- Saturno: ${chart.saturn.sign_sidereal} ${chart.saturn.degree_in_sign_sidereal.toFixed(2)}°
- Rahu: ${chart.rahu.sign_sidereal} ${chart.rahu.degree_in_sign_sidereal.toFixed(2)}°
- Ketu: ${chart.ketu.sign_sidereal} ${chart.ketu.degree_in_sign_sidereal.toFixed(2)}°
`.trim();

  const nakshatraBlock = `
DETALLES DEL NAKSHATRA NATAL (${nak.name}):
- Índice: ${nak.index} de 26 (contando desde Ashwini=0)
- Símbolo: ${nak.symbol}
- Deidad regente: ${nak.deity}
- Dasha lord: ${nak.dasha_lord}
- Gana (clase): ${nak.gana}
- Yoni (animal sagrado): ${nak.yoni}
- Varna: ${nak.varna}
- Guna: ${nak.guna}
- Dosha del nakshatra: ${nak.dosha}
- Naturaleza: ${nak.nature}
- Dirección: ${nak.direction}
- Esencia: ${nak.short_description_es}
`.trim();

  const prakritiBlock = `
PRAKRITI CALCULADA:
- Vata: ${prakriti.vata}%
- Pitta: ${prakriti.pitta}%
- Kapha: ${prakriti.kapha}%
- Dominante: ${prakriti.dominant}
- Secundaria: ${prakriti.secondary}
- Etiqueta: ${prakriti.constitution_label}
`.trim();

  const dashaBlock = `
DASHA ACTIVO (momento presente):
- MAHADASHA activo: ${dashaInfo.mahadasha.planet} (${dashaInfo.mahadasha.progress_pct}% recorrido, quedan ${dashaInfo.mahadasha.years_remaining} años)
  · Tema: ${mahaTheme.titulo}
  · Luz: ${mahaTheme.positive}
  · Sombra: ${mahaTheme.challenge}
- ANTARDASHA actual (sub-período dentro del mahadasha): ${dashaInfo.antardasha.planet} (${dashaInfo.antardasha.progress_pct}% recorrido, quedan ${dashaInfo.antardasha.days_remaining} días)
  · Tema: ${antarTheme.titulo}
  · Luz: ${antarTheme.positive}
  · Sombra: ${antarTheme.challenge}
- Nacimiento con ${dashaInfo.years_consumed_at_birth} años ya consumidos del primer mahadasha (${dashaInfo.birth_moon_dasha_lord}).
`.trim();

  const cyclesBlock = cycles
    ? `
CICLOS AMORC CONVERGENTES HOY (sistema H. Spencer Lewis, 1929):
- Ciclo de Vida Personal: período ${cycles.ciclo_vida.periodo} de 7 (${cycles.ciclo_vida.dias_en_periodo} días transcurridos, quedan ${cycles.ciclo_vida.dias_restantes}, ${cycles.ciclo_vida.progreso_pct}% completado)
- Ciclo Diario: letra ${cycles.ciclo_diario.letra}
- Ciclo del Alma: período ${cycles.ciclo_alma.periodo} polaridad ${cycles.ciclo_alma.polaridad} — "${cycles.ciclo_alma.nombre}"
`.trim()
    : '';

  const userPrompt = `Voy a darte los datos astronómicos calculados de ${userName} (nacida el ${birthDate}${birthTime ? ' a las ' + birthTime : ''}${birthPlace ? ' en ' + birthPlace : ''}). Tu misión es escribir la Carta Ayurvédica completa siguiendo la estructura de 8 secciones.

${placementsBlock}

${nakshatraBlock}

${prakritiBlock}

${dashaBlock}

${cyclesBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTRUCTURA OBLIGATORIA DEL INFORME HTML:

<section class="ayu-section" id="seccion-1">
  <h2>1. Tu Nakshatra Natal: ${nak.name}</h2>
  [600 palabras describiendo el nakshatra ${nak.name} pada ${chart.moon.nakshatra.pada}: el simbolismo de "${nak.symbol}", la personalidad que otorga la regencia de ${nak.deity}, el arquetipo del animal sagrado ${nak.yoni}, la huella espiritual que deja en ${userName}. Menciona qué significa pertenecer al gana ${nak.gana} y tener la guna ${nak.guna}. Termina conectando con la idea de que esto ES su "estrella" de nacimiento, no una abstracción.]
</section>

<section class="ayu-section" id="seccion-2">
  <h2>2. Tu Prakriti: constitución ${prakriti.constitution_label}</h2>
  [900 palabras. Explica qué es la Prakriti en Ayurveda (~100 palabras). Luego describe las características físicas, mentales y emocionales de ser ${prakriti.dominant}-${prakriti.secondary}: cómo se manifiesta en el cuerpo de ${userName}, en su digestión (Agni), en su mente, en sus patrones de sueño, en su piel. Incluye una pequeña tabla HTML con "Tendencia equilibrada" vs "Tendencia desequilibrada" para la dosha dominante. Cierra con los signos de alerta cuando su dosha se desequilibra.]
</section>

<section class="ayu-section" id="seccion-3">
  <h2>3. Tu Dasha Activo: estás en ${dashaInfo.mahadasha.planet} mahadasha</h2>
  [900 palabras. Explica qué es el sistema Vimshottari (~120 palabras). Luego entra en profundidad en el mahadasha de ${dashaInfo.mahadasha.planet}: qué enseñanzas trae, qué temas se activan, qué debe cultivar ${userName} y qué debe soltar. Dedica un párrafo al sub-período de ${dashaInfo.antardasha.planet} y su interacción con el mahadasha principal. Cita el número de años que lleva y cuántos le quedan. Termina con el próximo tramo: cuando finalice ${dashaInfo.mahadasha.planet}, entrará en ${findNextPlanet(dashaInfo.mahadasha.planet)} y qué energía nueva aparecerá.]
</section>

<section class="ayu-section" id="seccion-4">
  <h2>4. Dinacharya: tu rutina diaria óptima</h2>
  [700 palabras. Explica el concepto de Dinacharya (~80 palabras). Luego detalla, para una naturaleza ${prakriti.dominant}-${prakriti.secondary}, los horarios óptimos: hora de despertar, hora ideal para meditar y ejercitarse, hora de la comida principal, hora de cenar, hora de dormir. Incluye qué tipo de ejercicio le conviene (no por modas, sino por dosha): si es Vata necesita yoga suave y calor; si es Pitta necesita ejercicio moderado y frescura; si es Kapha necesita movimiento intenso. Cierra con una rutina matinal de 15 minutos que ${userName} pueda incorporar esta semana.]
</section>

<section class="ayu-section" id="seccion-5">
  <h2>5. Tu alimentación según el Prakriti</h2>
  [800 palabras. Introduce los 6 sabores (rasa) del Ayurveda: dulce, agrio, salado, picante, amargo, astringente (~150 palabras). Luego explica cuáles de los 6 rasa pacifican la dosha de ${userName} y cuáles la agravan. Lista 8-10 alimentos recomendados (con explicación corta del porqué) y 5-7 alimentos a evitar o moderar. Menciona una especia clave que debería incorporar. Cierra con una regla de oro sobre la cantidad y la temperatura de sus comidas.]
</section>

<section class="ayu-section" id="seccion-6">
  <h2>6. Remedios para tu Nakshatra y Dasha</h2>
  [700 palabras. Sugiere (con tono de "tradición sugiere", no de prescripción):
    - Una gema que resuena con el dasha lord natal ${nak.dasha_lord} y otra con el mahadasha activo ${dashaInfo.mahadasha.planet}, explicando por qué.
    - Un mantra de 9-12 sílabas asociado a la deidad del nakshatra (${nak.deity}) o al dasha lord.
    - Una hierba o planta ayurvédica clásica (Ashwagandha, Brahmi, Shatavari, Triphala, Guduchi...) según el dosha dominante.
    - Un ritual sencillo de 5-10 minutos (puede ser una abhyanga, un trataka, un baño de plantas) que ${userName} pueda hacer sola en casa una vez por semana.
  Incluye recordatorio de seguridad: son tradición, no medicina.]
</section>

<section class="ayu-section" id="seccion-7">
  <h2>7. Tu momento astrológico ahora: los ciclos AMORC convergentes</h2>
  [700 palabras. ${cycles ? `El sistema de ciclos AMORC (Rosacruces, H. Spencer Lewis 1929) es otra lente complementaria. Hoy ${userName} está en el ciclo de Vida Personal número ${cycles.ciclo_vida.periodo} (${cycles.ciclo_vida.progreso_pct}% completado), ciclo del Alma período ${cycles.ciclo_alma.periodo} polaridad ${cycles.ciclo_alma.polaridad} "${cycles.ciclo_alma.nombre}". Explica qué significan esos ciclos, cómo se integran con su dasha Vimshottari activo (¿potencian, suavizan o confrontan?), y qué ventanas de acción/reflexión se abren hoy. Termina con 3 claves prácticas para aprovechar la convergencia.` : 'Por falta de datos precisos de hora no calculamos los ciclos AMORC, pero sugiere al usuario que añada la hora exacta en un futuro para desbloquear esa capa.'}]
</section>

<section class="ayu-section" id="seccion-8">
  <h2>8. Tu próximo año: predicción ayurvédica</h2>
  [700 palabras. Traza una predicción para los próximos 12 meses desde la fecha de cálculo, basándote en:
    - La evolución del mahadasha de ${dashaInfo.mahadasha.planet} y la transición al siguiente antardasha
    - Ventanas favorables para salud, relaciones, trabajo, decisiones financieras
    - Al menos 2-3 meses concretos que marcar en el calendario y por qué
    - Una consigna espiritual anual (una frase corta que ${userName} pueda guardarse como mantra del año)
  Cierra con una despedida cálida que reconozca el viaje único de ${userName} y la bendición implícita en haberse tomado el tiempo de leer su carta.]
</section>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Entrega SOLO las 8 secciones HTML, en orden, sin preámbulo ni despedida externa a las secciones. La sección 8 incluye la despedida final internamente.`;

  return { system: SYSTEM_PROMPT, user: userPrompt };
}

// ============================================================
// Helper: próximo planeta en la secuencia Vimshottari
// ============================================================
function findNextPlanet(current: string): string {
  const order = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  const idx = order.indexOf(current);
  if (idx === -1) return 'Ketu';
  return order[(idx + 1) % 9]!;
}
