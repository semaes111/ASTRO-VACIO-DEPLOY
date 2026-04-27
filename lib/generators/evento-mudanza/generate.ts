/**
 * Orchestrator del generador "Mudanza" (slug: evento-mudanza).
 *
 * Segundo worker del patrón canónico, idéntico estructuralmente a
 * `lib/generators/evento-vehiculo/generate.ts`. Las únicas diferencias son:
 *   - Constantes del producto (SLUG, colores, modelo, etc.)
 *   - Validación de inputs específicos (current_address, new_address, move_date_target)
 *   - Wrapper HTML con clase 'emz-report' y header propio
 *   - Llamada a `buildEventoMudanzaPrompt` en vez de `buildEventoVehiculoPrompt`
 *
 * Si encuentras divergencias arquitectónicas con vehiculo, son bugs:
 * el patrón debe replicarse 1:1 para que el scaffolder funcione.
 *
 * Flujo:
 *   1. Lee user_report y valida slug
 *   2. validateInputs específicos
 *   3. resolveBirthData con fallback al user logueado
 *   4. loadTemplate (cache LRU + TTL)
 *   5. computeNatalChart natal + tránsitos al día objetivo
 *   5b.findOptimalDays sobre ventana ±90d (~2.7s, calcula 90 charts)
 *   6. markGenerationStarted
 *   7. buildEventoMudanzaPrompt + generateWithSonnet (incluye S5.2)
 *   8. sanitizeGeneratedHtml + assertValidReportHtml
 *   9. wrapInHtmlDocument + markGenerationReady
 *  10. Catch general → markGenerationError + relanza
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { generateWithSonnet } from '@/lib/ai/sonnet';
import { computeNatalChart } from '@/lib/astronomy/planets';
import { loadTemplate } from '@/lib/generators/_shared/template-loader';
import {
  findOptimalDays,
  buildWindowAroundTarget,
} from '@/lib/generators/_shared/optimal-days';
import {
  resolveBirthData,
  countWords,
  escapeHtml,
} from '@/lib/generators/_shared/birth-data';
import {
  sanitizeGeneratedHtml,
  assertValidReportHtml,
} from '@/lib/generators/_shared/html-sanitizer';
import {
  markGenerationStarted,
  markGenerationReady,
  markGenerationError,
} from '@/lib/generators/_shared/report-updater';
import { buildEventoMudanzaPrompt } from './prompt';

// ---------------------------------------------------------------------------
// Constantes del producto (consultar astrodorado.reports si hay duda)
// ---------------------------------------------------------------------------

const SLUG = 'evento-mudanza';
const PRIMARY_COLOR = '#B45309';
const ACCENT_COLOR = '#FDBA74';
const MIN_OUTPUT_WORDS = 800;
const MAX_TOKENS = 14000;       // S5.2 añade ~500 palabras
const TEMPERATURE = 0.65;

// Configuración del calendario alternativo (S5.2)
const OPTIMAL_DAYS_TOP_N = 5;          // mejores días alternativos
const OPTIMAL_DAYS_TOP_N_AVOID = 3;    // peores días a evitar
const OPTIMAL_DAYS_EXTEND_AFTER = 60;  // días después de la fecha objetivo en la ventana

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GenerateEventoMudanzaResult {
  html: string;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  model_used: string;
  word_count: number;
}

const DAY_OF_WEEK_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
] as const;

// ---------------------------------------------------------------------------
// Validación de inputs específicos
// ---------------------------------------------------------------------------

interface EventoMudanzaInputs {
  currentAddress: string;
  newAddress: string;
  moveDateTarget: string;
  moveDayOfWeek: string;
  moveDateUTC: Date;
}

/**
 * Valida y normaliza los inputs específicos de evento-mudanza. Lanza con
 * mensajes claros si falta o está mal formado.
 */
function validateInputs(inputData: Record<string, unknown>): EventoMudanzaInputs {
  const currentAddressRaw = inputData.current_address;
  if (typeof currentAddressRaw !== 'string' || currentAddressRaw.trim().length === 0) {
    throw new Error(
      'input_data.current_address es requerido (string no vacío con la dirección actual)',
    );
  }

  const newAddressRaw = inputData.new_address;
  if (typeof newAddressRaw !== 'string' || newAddressRaw.trim().length === 0) {
    throw new Error(
      'input_data.new_address es requerido (string no vacío con la dirección nueva)',
    );
  }

  if (currentAddressRaw.trim() === newAddressRaw.trim()) {
    throw new Error(
      'input_data.current_address y new_address no pueden ser iguales — ' +
        'el informe asume una mudanza real entre dos lugares distintos.',
    );
  }

  const moveDateRaw = inputData.move_date_target;
  if (typeof moveDateRaw !== 'string') {
    throw new Error(
      "input_data.move_date_target es requerido (string: 'YYYY-MM-DD')",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveDateRaw)) {
    throw new Error(
      `input_data.move_date_target no tiene formato YYYY-MM-DD: '${moveDateRaw}'`,
    );
  }

  const moveDateUTC = new Date(`${moveDateRaw}T12:00:00Z`);
  if (Number.isNaN(moveDateUTC.getTime())) {
    throw new Error(`move_date_target no es una fecha válida: '${moveDateRaw}'`);
  }

  const moveDayOfWeek = DAY_OF_WEEK_ES[moveDateUTC.getUTCDay()]!;

  return {
    currentAddress: currentAddressRaw.trim(),
    newAddress: newAddressRaw.trim(),
    moveDateTarget: moveDateRaw,
    moveDayOfWeek,
    moveDateUTC,
  };
}

// ---------------------------------------------------------------------------
// Wrapper visual
// ---------------------------------------------------------------------------

function wrapInHtmlDocument(
  innerHtml: string,
  userName: string,
  currentAddress: string,
  newAddress: string,
  moveDate: string,
): string {
  const userNameEsc = escapeHtml(userName);
  return `<article class="emz-report" data-product="evento-mudanza" data-user="${userNameEsc}">
<header class="emz-report-header">
  <p class="emz-report-eyebrow">Mudanza · AstroDorado</p>
  <h1>Cerrar y abrir puertas en armonía, ${userNameEsc}</h1>
  <p class="emz-report-subtitle">Análisis astrológico para tu mudanza desde ${escapeHtml(currentAddress)} hasta ${escapeHtml(newAddress)}, prevista para el ${escapeHtml(moveDate)}.</p>
</header>
${innerHtml}
<footer class="emz-report-footer">
  <p>Este informe es un análisis astrológico complementario al juicio profesional. No sustituye a la asesoría legal sobre el contrato de alquiler o compraventa, ni a la planificación logística profesional. Toma siempre las precauciones materiales que correspondan.</p>
</footer>
</article>`;
}

// ---------------------------------------------------------------------------
// Función pública principal
// ---------------------------------------------------------------------------

/**
 * Genera el informe completo "Mudanza" y persiste el resultado en
 * `user_reports`. Idempotente respecto a estado 'ready' (no rehace).
 *
 * @param userReportId UUID de astrodorado.user_reports
 * @returns Métricas de la generación (tokens, coste, duración, palabras)
 * @throws Si los inputs son inválidos. Errores tras markGenerationStarted
 *         se persisten en DB y se relanzan al caller.
 */
export async function generateEventoMudanza(
  userReportId: string,
): Promise<GenerateEventoMudanzaResult> {
  if (!userReportId) {
    throw new Error('generateEventoMudanza: userReportId requerido');
  }
  const supabase = createAdminClient();

  // ───────────────────────────────────────────────────────────
  // 1. Leer user_report
  // ───────────────────────────────────────────────────────────
  const { data: ur, error: urErr } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, report_slug, input_data, status')
    .eq('id', userReportId)
    .single();
  if (urErr || !ur) {
    throw new Error(
      `user_report ${userReportId} no encontrado: ${urErr?.message ?? 'unknown'}`,
    );
  }
  if (ur.report_slug !== SLUG) {
    throw new Error(
      `report_slug esperado '${SLUG}', recibido '${ur.report_slug}' (id=${userReportId})`,
    );
  }
  if (ur.status === 'ready') {
    throw new Error(
      `user_report ${userReportId} ya está en status='ready'. ` +
        'Borra output_html antes de reintentar si quieres regenerar.',
    );
  }

  const inputData = (ur.input_data ?? {}) as Record<string, unknown>;

  // ───────────────────────────────────────────────────────────
  // 2. Validar inputs específicos
  // ───────────────────────────────────────────────────────────
  const { currentAddress, newAddress, moveDateTarget, moveDayOfWeek, moveDateUTC } =
    validateInputs(inputData);

  // ───────────────────────────────────────────────────────────
  // 3. Resolver birth data (input.person → fallback user)
  // ───────────────────────────────────────────────────────────
  let resolvedBirth;
  try {
    resolvedBirth = resolveBirthData(inputData, '');
  } catch {
    const { data: user, error: userErr } = await supabase
      .from('astrodorado_users')
      .select('id, email, birth_date, birth_time, birth_place')
      .eq('id', ur.user_id)
      .single();
    if (userErr || !user) {
      throw new Error(
        `Sin datos de nacimiento ni en input.person ni en astrodorado.users ` +
          `para user ${ur.user_id}: ${userErr?.message ?? 'no rows'}`,
      );
    }
    if (!user.birth_date) {
      throw new Error(
        `User ${user.id} no tiene birth_date. ` +
          'Pídele al cliente que lo introduzca antes de iniciar el informe.',
      );
    }
    const fallback = user.email?.split('@')[0] ?? 'cliente';
    resolvedBirth = resolveBirthData(
      {
        person: {
          name: fallback,
          birth_date: user.birth_date,
          birth_time: user.birth_time,
          birth_place: user.birth_place,
        },
      },
      fallback,
    );
  }

  // ───────────────────────────────────────────────────────────
  // 4. Cargar template
  // ───────────────────────────────────────────────────────────
  const template = await loadTemplate(SLUG);
  if (!template) {
    throw new Error(
      `No hay template activo para slug='${SLUG}' en astrodorado.report_templates. ` +
        'Ejecuta `npm run ingest:one -- --slug=evento-mudanza` antes de generar.',
    );
  }

  // ───────────────────────────────────────────────────────────
  // 5. Calcular charts
  // ───────────────────────────────────────────────────────────
  const natalChart = computeNatalChart(
    resolvedBirth.birth_date_utc,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );
  const transitChart = computeNatalChart(
    moveDateUTC,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );

  // ───────────────────────────────────────────────────────────
  // 5b. Evaluar la ventana de días alternativos (S5.2 del informe)
  // ───────────────────────────────────────────────────────────
  // Calcula los topN mejores y peores días en una ventana razonable
  // alrededor de la fecha objetivo. Coste: ~30ms/día × ~90 días = ~2.7s.
  // Excluye explícitamente la fecha objetivo (ya está en S5.1).
  const window = buildWindowAroundTarget(moveDateTarget, {
    extendDaysAfter: OPTIMAL_DAYS_EXTEND_AFTER,
  });
  const optimal = findOptimalDays(natalChart, {
    start: window.start,
    end: window.end,
    topN: OPTIMAL_DAYS_TOP_N,
    topNAvoid: OPTIMAL_DAYS_TOP_N_AVOID,
    excludeDate: moveDateTarget,
    hourLocal: 12,
    tzOffsetHours: resolvedBirth.coords.tz_offset_hours,
    latitude: resolvedBirth.coords.lat,
    longitude: resolvedBirth.coords.lng,
  });

  // ───────────────────────────────────────────────────────────
  // 6. Marcar generating
  // ───────────────────────────────────────────────────────────
  await markGenerationStarted(userReportId);

  try {
    // ─────────────────────────────────────────────────────────
    // 7. Construir prompt y llamar a Sonnet
    // ─────────────────────────────────────────────────────────
    const { system, user: userPrompt } = buildEventoMudanzaPrompt({
      userName: resolvedBirth.name,
      birthDate: resolvedBirth.birth_date,
      birthTime: resolvedBirth.birth_time ?? undefined,
      birthPlace: resolvedBirth.birth_place ?? undefined,
      chart: natalChart,
      currentAddress,
      newAddress,
      moveDateTarget,
      transitChart,
      moveDayOfWeek,
      alternativeDays: optimal.topFavorable,
      daysToAvoid: optimal.topUnfavorable,
      primaryColor: PRIMARY_COLOR,
      accentColor: ACCENT_COLOR,
      templateHtml: template.html_template,
    });

    const ai = await generateWithSonnet({
      system,
      user: userPrompt,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    // ─────────────────────────────────────────────────────────
    // 8. Sanitizar HTML
    // ─────────────────────────────────────────────────────────
    const sanitized = sanitizeGeneratedHtml(ai.content);
    if (
      sanitized.removed.scripts > 0 ||
      sanitized.removed.iframes > 0 ||
      sanitized.removed.inlineHandlers > 0
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[evento-mudanza] sanitizer eliminó contenido sospechoso de userReportId=${userReportId}:`,
        sanitized.removed,
      );
    }

    const finalHtml = wrapInHtmlDocument(
      sanitized.html,
      resolvedBirth.name,
      currentAddress,
      newAddress,
      moveDateTarget,
    );
    assertValidReportHtml(finalHtml);

    const wordCount = countWords(finalHtml);
    if (wordCount < MIN_OUTPUT_WORDS) {
      throw new Error(
        `HTML final solo tiene ${wordCount} palabras (mínimo ${MIN_OUTPUT_WORDS}). ` +
          'Sonnet probablemente truncó la generación. Revisa max_tokens.',
      );
    }

    // ─────────────────────────────────────────────────────────
    // 9. Persistir resultado
    // ─────────────────────────────────────────────────────────
    const tokensUsed = ai.tokens_in + ai.tokens_out;
    await markGenerationReady(userReportId, {
      output_html: finalHtml,
      tokens_used: tokensUsed,
      model_used: ai.model_used,
      actual_cost_usd: ai.cost_usd,
      generation_duration_ms: ai.duration_ms,
    });

    return {
      html: finalHtml,
      tokens_used: tokensUsed,
      cost_usd: ai.cost_usd,
      duration_ms: ai.duration_ms,
      model_used: ai.model_used,
      word_count: wordCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await markGenerationError(userReportId, message);
    } catch (markErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[evento-mudanza] Doble fallo: error original "${message}" y ` +
          `markGenerationError también falló: ${
            markErr instanceof Error ? markErr.message : String(markErr)
          }`,
      );
    }
    throw err;
  }
}
