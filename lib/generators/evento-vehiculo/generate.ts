/**
 * Orchestrator del generador "Compra de Vehículo" (slug: evento-vehiculo).
 *
 * Este worker es el primer ejemplo del PATRÓN NUEVO para los 16 productos
 * del catálogo que tienen template en `astrodorado.report_templates`.
 * Sirve como referencia copiable para los siguientes workers.
 *
 * Diferencias respecto a Ayurveda:
 *   - Carga un template HTML pre-diseñado (cache LRU + TTL)
 *   - Calcula chart natal del titular Y un chart de tránsitos
 *     en la fecha objetivo de compra
 *   - El input "person" (natal_chart) puede venir del frontend o
 *     hacer fallback al user logueado
 *   - Usa los helpers centralizados de _shared/ y los transition
 *     functions de report-updater
 *   - Sanitiza el HTML que devuelve Claude antes de persistirlo
 *
 * Flujo:
 *   1. Lee user_report (con FK a slug='evento-vehiculo')
 *   2. Resuelve birth data del input.person (con fallback al user)
 *   3. Carga template activo de DB (cached)
 *   4. Calcula natal chart del titular
 *   5. Calcula transit chart en purchase_date_target
 *   5b.findOptimalDays sobre ventana ±90d (~2.7s, calcula 90 charts) → S6
 *   6. Construye prompt con template + datos + alternativas
 *   7. mark generating → call Sonnet → sanitize → mark ready
 *   8. Si algo falla en cualquier paso post-mark-generating, mark error
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
import { buildEventoVehiculoPrompt } from './prompt';

// ---------------------------------------------------------------------------
// Constantes del producto
// ---------------------------------------------------------------------------

const SLUG = 'evento-vehiculo';
const PRIMARY_COLOR = '#92400E';
const ACCENT_COLOR = '#FED7AA';
const MIN_OUTPUT_WORDS = 800; // umbral mínimo razonable; el target son 6000
const MAX_TOKENS = 14000;     // S6 añade ~500 palabras
const TEMPERATURE = 0.65;     // ligeramente menor que Ayurveda (más preciso)

// Configuración del calendario alternativo (S6)
const OPTIMAL_DAYS_TOP_N = 5;
const OPTIMAL_DAYS_TOP_N_AVOID = 3;
const OPTIMAL_DAYS_EXTEND_AFTER = 60;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface GenerateEventoVehiculoResult {
  /** HTML final que se persistió en user_reports.output_html */
  html: string;
  /** Suma de input + output tokens consumidos */
  tokens_used: number;
  /** Coste en USD calculado por el wrapper de Sonnet */
  cost_usd: number;
  /** Duración total de la generación (sin contar carga de template) */
  duration_ms: number;
  /** ID exacto del modelo usado (para auditoría) */
  model_used: string;
  /** Número de palabras del HTML final */
  word_count: number;
}

type VehicleType = 'coche' | 'moto' | 'barco' | 'otro';

const ALLOWED_VEHICLE_TYPES: readonly VehicleType[] = [
  'coche', 'moto', 'barco', 'otro',
] as const;

const DAY_OF_WEEK_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
] as const;

// ---------------------------------------------------------------------------
// Validación de inputs específicos del producto
// ---------------------------------------------------------------------------

interface EventoVehiculoInputs {
  vehicleType: VehicleType;
  purchaseDateTarget: string; // 'YYYY-MM-DD'
  purchaseDayOfWeek: string;
  purchaseDateUTC: Date;
}

/**
 * Valida y normaliza los inputs específicos de evento-vehiculo. Lanza con
 * mensajes claros si falta algo — es preferible fallar pronto que generar
 * un informe basura por inputs incorrectos.
 */
function validateInputs(inputData: Record<string, unknown>): EventoVehiculoInputs {
  const vehicleTypeRaw = inputData.vehicle_type;
  if (typeof vehicleTypeRaw !== 'string') {
    throw new Error(
      "input_data.vehicle_type es requerido (string: 'coche' | 'moto' | 'barco' | 'otro')",
    );
  }
  const vehicleType = vehicleTypeRaw.toLowerCase() as VehicleType;
  if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
    throw new Error(
      `input_data.vehicle_type inválido: '${vehicleTypeRaw}'. ` +
        `Valores permitidos: ${ALLOWED_VEHICLE_TYPES.join(', ')}`,
    );
  }

  const purchaseDateRaw = inputData.purchase_date_target;
  if (typeof purchaseDateRaw !== 'string') {
    throw new Error(
      "input_data.purchase_date_target es requerido (string: 'YYYY-MM-DD')",
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateRaw)) {
    throw new Error(
      `input_data.purchase_date_target no tiene formato YYYY-MM-DD: '${purchaseDateRaw}'`,
    );
  }

  const purchaseDateUTC = new Date(`${purchaseDateRaw}T12:00:00Z`); // mediodía UTC
  if (Number.isNaN(purchaseDateUTC.getTime())) {
    throw new Error(`purchase_date_target no es una fecha válida: '${purchaseDateRaw}'`);
  }

  const purchaseDayOfWeek = DAY_OF_WEEK_ES[purchaseDateUTC.getUTCDay()]!;

  return {
    vehicleType,
    purchaseDateTarget: purchaseDateRaw,
    purchaseDayOfWeek,
    purchaseDateUTC,
  };
}

// ---------------------------------------------------------------------------
// Wrapper visual del HTML final
// ---------------------------------------------------------------------------

/**
 * Envuelve el HTML que devuelve Claude en un <article> con estructura
 * consistente. El wrapper es deliberadamente minimalista — los estilos
 * los aplica `app/ver/[id]/route.ts` cuando detecta el documento.
 */
function wrapInHtmlDocument(
  innerHtml: string,
  userName: string,
  vehicleType: VehicleType,
  purchaseDate: string,
): string {
  const userNameEsc = escapeHtml(userName);
  const vehicleTypeEsc = escapeHtml(vehicleType);
  return `<article class="ev-report" data-product="evento-vehiculo" data-user="${userNameEsc}">
<header class="ev-report-header">
  <p class="ev-report-eyebrow">Compra de Vehículo · AstroDorado</p>
  <h1>El camino que se abre contigo, ${userNameEsc}</h1>
  <p class="ev-report-subtitle">Análisis astrológico para la adquisición de tu ${vehicleTypeEsc} prevista para el ${escapeHtml(purchaseDate)}.</p>
</header>
${innerHtml}
<footer class="ev-report-footer">
  <p>Este informe es un análisis astrológico complementario al juicio profesional. No sustituye a la revisión técnica del vehículo, la asesoría legal sobre el contrato, ni la verificación de antecedentes. Toma siempre las precauciones materiales que correspondan.</p>
</footer>
</article>`;
}

// ---------------------------------------------------------------------------
// Función pública principal
// ---------------------------------------------------------------------------

/**
 * Genera el informe completo "Compra de Vehículo" y persiste el resultado
 * en `user_reports`. Es idempotente respecto a estados terminales (ready /
 * error): si ya está en uno, no relanza generación.
 *
 * @param userReportId UUID de astrodorado.user_reports
 * @returns Métricas de la generación (tokens, coste, duración, palabras)
 * @throws Si los inputs son inválidos o falta el template. Errores
 *         posteriores a `markGenerationStarted` se persisten en la DB y
 *         se relanzan al caller para que el cron/worker decida reintentar.
 */
export async function generateEventoVehiculo(
  userReportId: string,
): Promise<GenerateEventoVehiculoResult> {
  if (!userReportId) {
    throw new Error('generateEventoVehiculo: userReportId requerido');
  }
  const supabase = createAdminClient();

  // ───────────────────────────────────────────────────────────
  // 1. Leer user_report y validar su estado
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

  // Idempotencia: si ya está en estado terminal, no rehacemos.
  if (ur.status === 'ready') {
    throw new Error(
      `user_report ${userReportId} ya está en status='ready'. ` +
        'Borra output_html antes de reintentar si quieres regenerar.',
    );
  }

  const inputData = (ur.input_data ?? {}) as Record<string, unknown>;

  // ───────────────────────────────────────────────────────────
  // 2. Validar inputs específicos del producto
  // ───────────────────────────────────────────────────────────
  // Nota: si esto lanza, el report queda en su estado anterior (no
  // tocamos la DB todavía). Es lo que queremos — ningún side-effect.
  const { vehicleType, purchaseDateTarget, purchaseDayOfWeek, purchaseDateUTC } =
    validateInputs(inputData);

  // ───────────────────────────────────────────────────────────
  // 3. Resolver datos de nacimiento (input.person → fallback user)
  // ───────────────────────────────────────────────────────────
  // Si el frontend pasó input.person.birth_date lo usamos. Si no,
  // hacemos fallback al usuario logueado (mismo patrón que Ayurveda).
  let resolvedBirth;
  try {
    resolvedBirth = resolveBirthData(inputData, '');
  } catch {
    // input_data.person incompleto → leer del user logueado
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
    // Construimos un input_data sintético con los datos del user para
    // pasarlo a resolveBirthData con un nombre fallback.
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
  // 4. Cargar template HTML (con cache)
  // ───────────────────────────────────────────────────────────
  const template = await loadTemplate(SLUG);
  if (!template) {
    throw new Error(
      `No hay template activo para slug='${SLUG}' en astrodorado.report_templates. ` +
        'Ejecuta `npm run ingest:one -- --slug=evento-vehiculo` antes de generar informes.',
    );
  }

  // ───────────────────────────────────────────────────────────
  // 5. Calcular charts (natal del titular + tránsitos a la fecha objetivo)
  // ───────────────────────────────────────────────────────────
  const natalChart = computeNatalChart(
    resolvedBirth.birth_date_utc,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );
  // Para los tránsitos NO usamos el ascendente (no es relevante para electional
  // analysis sin localización del comprador en ese momento), pero pasamos
  // las mismas coords por consistencia visual del bloque.
  const transitChart = computeNatalChart(
    purchaseDateUTC,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );

  // ───────────────────────────────────────────────────────────
  // 5b. Evaluar ventana de días alternativos (S6 del informe)
  // ───────────────────────────────────────────────────────────
  const window = buildWindowAroundTarget(purchaseDateTarget, {
    extendDaysAfter: OPTIMAL_DAYS_EXTEND_AFTER,
  });
  const optimal = findOptimalDays(natalChart, {
    start: window.start,
    end: window.end,
    topN: OPTIMAL_DAYS_TOP_N,
    topNAvoid: OPTIMAL_DAYS_TOP_N_AVOID,
    excludeDate: purchaseDateTarget,
    hourLocal: 12,
    tzOffsetHours: resolvedBirth.coords.tz_offset_hours,
    latitude: resolvedBirth.coords.lat,
    longitude: resolvedBirth.coords.lng,
  });

  // ───────────────────────────────────────────────────────────
  // 6. Marcar generating ANTES de la llamada cara a Claude
  // ───────────────────────────────────────────────────────────
  // A partir de aquí, cualquier error se persiste como status='error'.
  await markGenerationStarted(userReportId);

  try {
    // ─────────────────────────────────────────────────────────
    // 7. Construir prompt y llamar a Sonnet
    // ─────────────────────────────────────────────────────────
    const { system, user: userPrompt } = buildEventoVehiculoPrompt({
      userName: resolvedBirth.name,
      birthDate: resolvedBirth.birth_date,
      birthTime: resolvedBirth.birth_time ?? undefined,
      birthPlace: resolvedBirth.birth_place ?? undefined,
      chart: natalChart,
      vehicleType,
      purchaseDateTarget,
      transitChart,
      purchaseDayOfWeek,
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
    // 8. Sanitizar y validar HTML
    // ─────────────────────────────────────────────────────────
    const sanitized = sanitizeGeneratedHtml(ai.content);
    if (
      sanitized.removed.scripts > 0 ||
      sanitized.removed.iframes > 0 ||
      sanitized.removed.inlineHandlers > 0
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[evento-vehiculo] sanitizer eliminó contenido sospechoso de userReportId=${userReportId}:`,
        sanitized.removed,
      );
    }

    const finalHtml = wrapInHtmlDocument(
      sanitized.html,
      resolvedBirth.name,
      vehicleType,
      purchaseDateTarget,
    );

    // Validamos forma básica del HTML completo
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
    // Persistimos el error y relanzamos. El cron/worker decide reintentar.
    const message = err instanceof Error ? err.message : String(err);
    try {
      await markGenerationError(userReportId, message);
    } catch (markErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[evento-vehiculo] Doble fallo: error original "${message}" y ` +
          `markGenerationError también falló: ${
            markErr instanceof Error ? markErr.message : String(markErr)
          }`,
      );
    }
    throw err;
  }
}
