/**
 * Orchestrator para el generador Ayurveda.
 *
 * Flujo:
 *  1. Lee el user_report y el user desde Supabase
 *  2. Parsea birth_date, birth_time, birth_place → Date UTC + lat/lng
 *  3. Calcula NatalChart con astronomy-engine
 *  4. Calcula Prakriti y Dasha activo
 *  5. Llama al RPC calc_amorc_cycles
 *  6. Construye prompt y llama a Sonnet 4.5
 *  7. Envuelve la respuesta en HTML con estilos mínimos
 *  8. Actualiza user_report con resultado, tokens, coste
 *  9. Guarda snapshot de ciclos AMORC
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { generateWithSonnet } from '@/lib/ai/sonnet';
import { computeNatalChart } from '@/lib/astronomy/planets';
import { calculatePrakriti } from '@/lib/ayurveda/doshas';
import { calculateDashas } from '@/lib/ayurveda/dashas';
import { buildAyurvedaPrompt } from './prompt';
import type { AmorcCyclesSnapshot } from '@/lib/types/life-cycles';

export interface GenerateAyurvedaResult {
  html: string;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  model_used: string;
  word_count: number;
}

/**
 * Lookup de coordenadas para ciudades españolas comunes.
 * Fallback pragmático mientras no integremos geocoding completo.
 */
const CITY_COORDS: Record<string, { lat: number; lng: number; tz_offset_hours: number }> = {
  madrid: { lat: 40.4168, lng: -3.7038, tz_offset_hours: 1 },
  'el ejido': { lat: 36.7759, lng: -2.8108, tz_offset_hours: 1 },
  almeria: { lat: 36.8340, lng: -2.4637, tz_offset_hours: 1 },
  barcelona: { lat: 41.3851, lng: 2.1734, tz_offset_hours: 1 },
  sevilla: { lat: 37.3891, lng: -5.9845, tz_offset_hours: 1 },
  valencia: { lat: 39.4699, lng: -0.3763, tz_offset_hours: 1 },
  bilbao: { lat: 43.2630, lng: -2.9350, tz_offset_hours: 1 },
  malaga: { lat: 36.7213, lng: -4.4213, tz_offset_hours: 1 },
  granada: { lat: 37.1773, lng: -3.5986, tz_offset_hours: 1 },
  zaragoza: { lat: 41.6488, lng: -0.8891, tz_offset_hours: 1 },
};

function lookupCity(placeName: string | null | undefined): { lat: number; lng: number; tz_offset_hours: number } {
  const normalized = (placeName ?? '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(city)) return coords;
  }
  // Default: Madrid (siempre está en el catálogo)
  return CITY_COORDS.madrid!;
}

/**
 * Construye el Date UTC del nacimiento a partir de date+time+offset.
 */
function buildBirthDateUTC(
  birthDate: string,
  birthTime: string | null,
  tzOffsetHours: number,
): Date {
  const timeStr = birthTime ?? '12:00';
  // birthDate = 'YYYY-MM-DD', timeStr = 'HH:MM' o 'HH:MM:SS'
  const [hhStr = '12', mmStr = '00'] = timeStr.split(':');
  const [yStr = '2000', mStr = '01', dStr = '01'] = birthDate.split('-');
  const Y = parseInt(yStr, 10);
  const M = parseInt(mStr, 10);
  const D = parseInt(dStr, 10);
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  // Fecha local → UTC: restamos el offset
  const utc = Date.UTC(Y, M - 1, D, hh - tzOffsetHours, mm);
  return new Date(utc);
}

/**
 * Cuenta palabras aproximadas de un HTML (strip tags + split por espacios).
 */
function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text.split(' ').length : 0;
}

/**
 * Envuelve el contenido HTML del informe en una estructura completa con estilos inline mínimos.
 */
function wrapInHtmlDocument(innerHtml: string, userName: string): string {
  return `<article class="ayu-report" data-user="${escapeHtml(userName)}">
<header class="ayu-report-header">
  <p class="ayu-report-eyebrow">Carta Ayurvédica AstroDorado</p>
  <h1>La huella astrológica de ${escapeHtml(userName)}</h1>
  <p class="ayu-report-subtitle">Un recorrido por tu nakshatra, tu prakriti y tu tiempo presente.</p>
</header>
${innerHtml}
<footer class="ayu-report-footer">
  <p>Este informe ha sido generado con base en cálculos sidéreos precisos y tradición védica clásica. No sustituye el consejo médico profesional.</p>
</footer>
</article>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Función pública principal.
 * @param userReportId UUID de astrodorado.user_reports
 */
export async function generateAyurveda(userReportId: string): Promise<GenerateAyurvedaResult> {
  const supabase = createAdminClient();

  // 1. Leer user_report
  const { data: ur, error: urErr } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, report_slug, input_data, status')
    .eq('id', userReportId)
    .single();
  if (urErr || !ur) {
    throw new Error(`user_report ${userReportId} no encontrado: ${urErr?.message}`);
  }
  if (ur.report_slug !== 'ayurveda') {
    throw new Error(`report_slug esperado 'ayurveda', recibido '${ur.report_slug}'`);
  }

  // 2. Leer user
  const { data: user, error: userErr } = await supabase
    .from('astrodorado_users')
    .select('id, email, birth_date, birth_time, birth_place')
    .eq('id', ur.user_id)
    .single();
  if (userErr || !user) {
    throw new Error(`user ${ur.user_id} no encontrado: ${userErr?.message}`);
  }
  if (!user.birth_date) {
    throw new Error(`user ${user.id} no tiene birth_date. No se puede generar Ayurveda.`);
  }

  // 3. Preparar datos — el frontend puede pasar lat/lng explícitos en input_data
  const inputData = (ur.input_data ?? {}) as Record<string, unknown>;
  const explicitLat = typeof inputData.latitude === 'number' ? inputData.latitude : null;
  const explicitLng = typeof inputData.longitude === 'number' ? inputData.longitude : null;
  const explicitTzOffset = typeof inputData.tz_offset_hours === 'number' ? inputData.tz_offset_hours : null;
  const userName = typeof inputData.name === 'string' && inputData.name.trim().length > 0
    ? inputData.name.trim()
    : (user.email?.split('@')[0] ?? 'amiga');

  const coords = explicitLat !== null && explicitLng !== null
    ? { lat: explicitLat, lng: explicitLng, tz_offset_hours: explicitTzOffset ?? 1 }
    : lookupCity(user.birth_place);

  const birthDateUTC = buildBirthDateUTC(user.birth_date, user.birth_time, coords.tz_offset_hours);

  // 4. Calcular natal chart
  const chart = computeNatalChart(birthDateUTC, coords.lat, coords.lng);

  // 5. Calcular Prakriti
  const prakriti = calculatePrakriti(chart);

  // 6. Calcular Dashas
  const dashaInfo = calculateDashas(
    birthDateUTC,
    chart.moon.nakshatra.dasha_lord,
    chart.moon.nakshatra.degree_within,
    new Date(),
  );

  // 7. Llamar RPC de ciclos AMORC
  let cycles: AmorcCyclesSnapshot | null = null;
  try {
    const { data: cyclesData } = await supabase.rpc('calc_amorc_cycles', {
      p_birth_date: user.birth_date,
      p_birth_time: user.birth_time ?? '12:00',
      p_target_date: new Date().toISOString(),
    });
    cycles = (cyclesData ?? null) as AmorcCyclesSnapshot | null;
  } catch (e) {
    console.warn('[ayurveda] RPC calc_amorc_cycles falló, generando sin ciclos:', e);
  }

  // 8. Construir prompt y llamar Sonnet
  const { system, user: userPrompt } = buildAyurvedaPrompt({
    userName,
    birthDate: user.birth_date,
    birthTime: user.birth_time ?? undefined,
    birthPlace: user.birth_place ?? undefined,
    chart,
    prakriti,
    dashaInfo,
    cycles,
  });

  const ai = await generateWithSonnet({
    system,
    user: userPrompt,
    max_tokens: 16000,
    temperature: 0.75,
  });

  // 9. Envolver en HTML final
  const html = wrapInHtmlDocument(ai.content, userName);
  const wordCount = countWords(html);

  // 10. Actualizar user_report
  const tokensUsed = ai.tokens_in + ai.tokens_out;
  const { error: updErr } = await supabase
    .from('astrodorado_user_reports')
    .update({
      status: 'ready',
      output_html: html,
      tokens_used: tokensUsed,
      model_used: ai.model_used,
      actual_cost_usd: ai.cost_usd,
      generation_duration_ms: ai.duration_ms,
      generated_at: new Date().toISOString(),
      life_cycles_snapshot: cycles,
    })
    .eq('id', userReportId);
  if (updErr) {
    throw new Error(`Fallo actualizando user_report: ${updErr.message}`);
  }

  return {
    html,
    tokens_used: tokensUsed,
    cost_usd: ai.cost_usd,
    duration_ms: ai.duration_ms,
    model_used: ai.model_used,
    word_count: wordCount,
  };
}
