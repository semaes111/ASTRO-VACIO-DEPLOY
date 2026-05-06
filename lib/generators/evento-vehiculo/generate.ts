/**
 * lib/generators/evento-vehiculo/generate.ts
 *
 * Worker de generación del informe "Compra de Vehículo".
 *
 * MODO: chunked (default desde Opción C). Promise.all de 6 secciones
 * paralelas con prompt caching. Tiempo total ~30s (vs 4-15min sync).
 *
 * Tolerancia a fallos:
 *   - Hasta 2 reintentos por sección que falle (con backoff 500ms/1000ms)
 *   - Si tras retries una sección sigue fallando, se inserta placeholder
 *     "sección no disponible" pero el informe continúa
 *   - Solo se marca el informe como 'error' fatal si fallan ≥4 secciones
 *     o si fallan secciones críticas combinadas (S2 + S6)
 *
 * Tracking de progreso:
 *   - Cada vez que una sección entra in_progress / completed / failed,
 *     se hace UPDATE atómico de la columna progress (jsonb) en DB
 *   - Frontend lee /api/informe-status que devuelve este progress
 *
 * Email transactional:
 *   - Tras markGenerationReady, se intenta enviar email via Resend
 *   - Si falla email, NO afecta al informe (se loguea y sigue)
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWithSonnetStream } from '@/lib/ai/sonnet';
import { computeNatalChart } from '@/lib/astronomy/planets';
import { loadTemplate } from '@/lib/generators/_shared/template-loader';
import {
  findOptimalDays,
  buildWindowAroundTarget,
} from '@/lib/generators/_shared/optimal-days';
import {
  resolveBirthData,
  countWords,
} from '@/lib/generators/_shared/birth-data';
import { sanitizeGeneratedHtml } from '@/lib/generators/_shared/html-sanitizer';
import {
  markGenerationStarted,
  markGenerationReady,
  markGenerationError,
  updateProgress,
} from '@/lib/generators/_shared/report-updater';
import {
  initialProgress,
  markInProgress,
  markCompleted,
  markFailed,
  type ProgressState,
  type SectionId,
} from '@/lib/generators/_shared/progress';
import {
  composeReport,
  type GeneratedSection,
} from '@/lib/generators/_shared/composer';
import { sendReportReadyEmail } from '@/lib/email/resend';
import {
  buildEventoVehiculoChunkedPrompts,
  type EventoVehiculoPromptInput,
} from './prompt';

// ---------------------------------------------------------------------------
// Constantes del producto
// ---------------------------------------------------------------------------

const SLUG = 'evento-vehiculo';
const PRODUCT_LABEL = 'Compra de vehículo';
const PRIMARY_COLOR = '#92400E';
const ACCENT_COLOR = '#FED7AA';

// max_tokens por sección. Cada sección target ~1100 palabras = ~1500 tokens.
// Damos margen 2.5x para evitar truncamientos por max_tokens cap.
const MAX_TOKENS_PER_SECTION = 4000;
const TEMPERATURE = 0.65;

// Mínimo de palabras del informe completo para marcar 'ready'.
// Si todas las secciones fallaron y solo hay placeholders, total ~50 palabras.
// El umbral 800 detecta "informe vacío" sin ser tan estricto que rechace
// informes parciales legítimos (5/6 secciones OK, 1 con placeholder).
const MIN_OUTPUT_WORDS = 800;

// Retry por sección
const SECTION_MAX_ATTEMPTS = 3; // 1 intento + 2 retries
const SECTION_RETRY_BACKOFF_MS = [500, 1000]; // ms entre retries

// Optimal days
const OPTIMAL_DAYS_TOP_N = 5;
const OPTIMAL_DAYS_TOP_N_AVOID = 3;
const OPTIMAL_DAYS_EXTEND_AFTER = 60;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface GenerateEventoVehiculoResult {
  html: string;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  model_used: string;
  word_count: number;
  /** Cuántas de las 6 secciones se generaron OK (resto: placeholder). */
  completed_sections: number;
  /** IDs de secciones que fallaron tras todos los retries. */
  failed_sections: SectionId[];
}

interface VehicleType {
  raw: string;
  normalized: string;
}

const ALLOWED_VEHICLE_TYPES = [
  'coche',
  'moto',
  'camion',
  'furgoneta',
  'barco',
  'velero',
  'lancha',
  'electrico',
  'hibrido',
  'comercial',
  'deportivo',
  'familiar',
] as const;

const DAY_OF_WEEK_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

interface EventoVehiculoInputs {
  vehicleType: string;
  purchaseDateTarget: string;
  purchaseDayOfWeek: string;
  purchaseDateUTC: Date;
}

// ---------------------------------------------------------------------------
// Validación de inputs
// ---------------------------------------------------------------------------

function validateInputs(inputData: Record<string, unknown>): EventoVehiculoInputs {
  const product = (inputData.product ?? {}) as Record<string, unknown>;

  // vehicleType (libre pero con normalización para mapeo simbólico)
  const vehicleTypeRaw = String(product.vehicle_type ?? 'coche').trim();
  const vehicleType = vehicleTypeRaw.length > 0 ? vehicleTypeRaw : 'coche';

  // purchaseDateTarget (obligatorio)
  const purchaseDateTarget = String(product.purchase_date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateTarget)) {
    throw new Error(
      `evento-vehiculo: input_data.product.purchase_date inválido o ausente. ` +
        `Esperado YYYY-MM-DD, recibido: "${purchaseDateTarget}"`,
    );
  }

  const purchaseDateUTC = new Date(`${purchaseDateTarget}T12:00:00.000Z`);
  if (isNaN(purchaseDateUTC.getTime())) {
    throw new Error(
      `evento-vehiculo: purchase_date "${purchaseDateTarget}" no es fecha válida`,
    );
  }

  // getUTCDay() devuelve 0..6 garantizado por ECMA spec, pero noUncheckedIndexedAccess
  // exige guardia contra undefined. El '?? domingo' es runtime-imposible.
  const purchaseDayOfWeek = DAY_OF_WEEK_ES[purchaseDateUTC.getUTCDay()] ?? 'domingo';

  return { vehicleType, purchaseDateTarget, purchaseDayOfWeek, purchaseDateUTC };
}

// ---------------------------------------------------------------------------
// Helpers de generación por sección con retry
// ---------------------------------------------------------------------------

interface SectionGenerationResult {
  id: SectionId;
  ok: boolean;
  html?: string;
  /** Acumulado de tokens usados en TODOS los intentos de esta sección. */
  tokens_in: number;
  tokens_out: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  cost_usd: number;
  duration_ms: number;
  attempts: number;
  error?: string;
}

/**
 * Genera UNA sección con hasta SECTION_MAX_ATTEMPTS intentos.
 *
 * Cada intento llama a Sonnet con streaming + cache_system. El cache
 * resuena entre llamadas paralelas: la primera paga cache_write, las
 * demás (incluida una sección retry) pagan cache_read si están dentro
 * de los 5min del TTL.
 */
async function generateSectionWithRetry(args: {
  sectionId: SectionId;
  systemShared: string;
  userPrompt: string;
  reportId: string;
  progressRef: { state: ProgressState };
}): Promise<SectionGenerationResult> {
  const { sectionId, systemShared, userPrompt, reportId, progressRef } = args;

  // Marcamos in_progress en el state local + UPDATE a DB (decisión 2: A)
  progressRef.state = markInProgress(progressRef.state, sectionId);
  void updateProgress(reportId, progressRef.state);

  const acc: SectionGenerationResult = {
    id: sectionId,
    ok: false,
    tokens_in: 0,
    tokens_out: 0,
    tokens_cache_read: 0,
    tokens_cache_write: 0,
    cost_usd: 0,
    duration_ms: 0,
    attempts: 0,
  };

  for (let attempt = 1; attempt <= SECTION_MAX_ATTEMPTS; attempt++) {
    acc.attempts = attempt;

    try {
      const ai = await generateWithSonnetStream({
        system: systemShared,
        user: userPrompt,
        max_tokens: MAX_TOKENS_PER_SECTION,
        temperature: TEMPERATURE,
        cache_system: true,
      });

      // Acumular métricas
      acc.tokens_in += ai.tokens_in;
      acc.tokens_out += ai.tokens_out;
      acc.tokens_cache_read += ai.tokens_cache_read;
      acc.tokens_cache_write += ai.tokens_cache_write;
      acc.cost_usd += ai.cost_usd;
      acc.duration_ms += ai.duration_ms;

      // Validación mínima del output: debe contener un <section>
      if (!/<section[\s>]/i.test(ai.content) || !/<\/section>/i.test(ai.content)) {
        throw new Error(
          `Sección ${sectionId}: respuesta sin <section>...</section>. ` +
            `Sonnet devolvió ${ai.content.length} chars de prefacio o markdown. ` +
            `Stop reason: ${ai.stop_reason}`,
        );
      }

      // Detectar truncamiento por max_tokens (output cortado a la mitad)
      if (ai.stop_reason === 'max_tokens') {
        throw new Error(
          `Sección ${sectionId}: stop_reason=max_tokens, output truncado. ` +
            `Considera aumentar MAX_TOKENS_PER_SECTION (actual ${MAX_TOKENS_PER_SECTION}).`,
        );
      }

      // Sanitizar
      const sanitized = sanitizeGeneratedHtml(ai.content);
      acc.html = sanitized.html;
      acc.ok = true;

      // Marcamos completed
      progressRef.state = markCompleted(progressRef.state, sectionId);
      void updateProgress(reportId, progressRef.state);
      return acc;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      acc.error = message;

      if (attempt < SECTION_MAX_ATTEMPTS) {
        // Backoff antes del siguiente intento
        const backoffMs = SECTION_RETRY_BACKOFF_MS[attempt - 1] ?? 1000;
        // eslint-disable-next-line no-console
        console.warn(
          `[evento-vehiculo] sección ${sectionId} falló attempt ${attempt}/${SECTION_MAX_ATTEMPTS}: ` +
            `${message}. Reintentando en ${backoffMs}ms...`,
        );
        await sleep(backoffMs);
        continue;
      }

      // Tras todos los retries, marcar como failed
      // eslint-disable-next-line no-console
      console.error(
        `[evento-vehiculo] sección ${sectionId} FALLIDA tras ${SECTION_MAX_ATTEMPTS} intentos: ${message}`,
      );
      progressRef.state = markFailed(progressRef.state, sectionId);
      void updateProgress(reportId, progressRef.state);
      return acc;
    }
  }

  // Defensa: nunca debería llegar aquí
  return acc;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Worker principal
// ---------------------------------------------------------------------------

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
  const { vehicleType, purchaseDateTarget, purchaseDayOfWeek, purchaseDateUTC } =
    validateInputs(inputData);

  // ───────────────────────────────────────────────────────────
  // 3. Resolver datos de nacimiento (input.person → fallback user)
  // ───────────────────────────────────────────────────────────
  let resolvedBirth;
  let userEmail: string | null = null;
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
    userEmail = user.email;
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

  // Si todavía no tenemos email (caso input.person OK), leerlo del user
  if (!userEmail) {
    const { data: u } = await supabase
      .from('astrodorado_users')
      .select('email')
      .eq('id', ur.user_id)
      .single();
    userEmail = u?.email ?? null;
  }

  // ───────────────────────────────────────────────────────────
  // 4. Cargar template HTML (con cache)
  // ───────────────────────────────────────────────────────────
  const template = await loadTemplate(SLUG);
  if (!template) {
    throw new Error(
      `No hay template activo para slug='${SLUG}' en astrodorado.report_templates. ` +
        'Ejecuta `tsx --env-file=.env.local scripts/ingest-html-templates.ts --slug=evento-vehiculo` antes de generar informes.',
    );
  }

  // ───────────────────────────────────────────────────────────
  // 5. Calcular charts + ventana de días alternativos
  // ───────────────────────────────────────────────────────────
  const natalChart = computeNatalChart(
    resolvedBirth.birth_date_utc,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );
  const transitChart = computeNatalChart(
    purchaseDateUTC,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );
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
  // 6. Marcar generating con progress inicial
  // ───────────────────────────────────────────────────────────
  const progressRef = { state: initialProgress(6) };
  await markGenerationStarted(userReportId, progressRef.state);

  try {
    // ─────────────────────────────────────────────────────────
    // 7. Construir prompts chunked
    // ─────────────────────────────────────────────────────────
    const promptInput: EventoVehiculoPromptInput = {
      userName: resolvedBirth.name,
      birthDate: resolvedBirth.birth_date,
      birthTime: resolvedBirth.birth_time ?? null,
      birthPlace: resolvedBirth.birth_place ?? null,
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
    };
    const { systemShared, perSection } =
      buildEventoVehiculoChunkedPrompts(promptInput);

    // ─────────────────────────────────────────────────────────
    // 8. Generar las 6 secciones en paralelo con retry
    // ─────────────────────────────────────────────────────────
    const startTotal = Date.now();
    const sectionResults = await Promise.all(
      perSection.map((sec) =>
        generateSectionWithRetry({
          sectionId: sec.id,
          systemShared,
          userPrompt: sec.user,
          reportId: userReportId,
          progressRef,
        }),
      ),
    );
    const elapsedTotal = Date.now() - startTotal;

    // ─────────────────────────────────────────────────────────
    // 9. Política de fallback (decisión 1: C+B)
    // ─────────────────────────────────────────────────────────
    const failed = sectionResults.filter((r) => !r.ok);
    const succeeded = sectionResults.filter((r) => r.ok);

    // Reglas de fallo fatal:
    //   a) ≥4 secciones fallaron (mayoría)
    //   b) Combinación crítica: S2 (veredicto del día) + S6 (calendario alt.)
    const failedIds = new Set(failed.map((r) => r.id));
    const criticalCombinationFailed =
      failedIds.has('s2') && failedIds.has('s6');

    if (failed.length >= 4 || criticalCombinationFailed) {
      const reason =
        failed.length >= 4
          ? `${failed.length}/6 secciones fallaron`
          : `secciones críticas S2+S6 fallaron simultáneamente`;
      throw new Error(
        `Generación abortada: ${reason}. Errores: ${failed
          .map((r) => `${r.id}=${r.error}`)
          .join('; ')}`,
      );
    }

    // ─────────────────────────────────────────────────────────
    // 10. Componer informe con secciones OK + placeholders en las falladas
    //     (composer ya inserta placeholder ev-section-missing si falta una)
    // ─────────────────────────────────────────────────────────
    const sectionsForComposer: GeneratedSection[] = succeeded
      .filter((r): r is SectionGenerationResult & { html: string } =>
        Boolean(r.html),
      )
      .map((r) => ({ id: r.id, html: r.html, failed: false }));

    const finalHtml = composeReport(sectionsForComposer, {
      productSlug: SLUG,
      userName: resolvedBirth.name,
      contextLine: `${PRODUCT_LABEL} · ${formatDateEs(purchaseDateTarget)}`,
    });

    // Validación mínima: el HTML final debe tener cuerpo razonable
    const wordCount = countWords(finalHtml);
    if (wordCount < MIN_OUTPUT_WORDS) {
      throw new Error(
        `HTML final solo tiene ${wordCount} palabras (mínimo ${MIN_OUTPUT_WORDS}). ` +
          `Probable: todas las secciones devolvieron placeholders. failed=${failed.length}`,
      );
    }

    // ─────────────────────────────────────────────────────────
    // 11. Persistir resultado + progress final
    // ─────────────────────────────────────────────────────────
    const totalTokensIn = sectionResults.reduce((s, r) => s + r.tokens_in, 0);
    const totalTokensOut = sectionResults.reduce((s, r) => s + r.tokens_out, 0);
    const totalCost = sectionResults.reduce((s, r) => s + r.cost_usd, 0);

    await markGenerationReady(userReportId, {
      output_html: finalHtml,
      tokens_used: totalTokensIn + totalTokensOut,
      model_used: 'claude-sonnet-4-5-20250929',
      actual_cost_usd: totalCost,
      generation_duration_ms: elapsedTotal,
      finalProgress: progressRef.state,
    });

    // ─────────────────────────────────────────────────────────
    // 12. Email transactional (decisión 3: A — try/catch interno)
    // ─────────────────────────────────────────────────────────
    if (userEmail) {
      const reportUrl = buildReportUrl(userReportId);
      void sendReportReadyEmail({
        to: userEmail,
        userName: resolvedBirth.name,
        productLabel: PRODUCT_LABEL,
        reportUrl,
      })
        .then((result) => {
          if (!result.ok) {
            // eslint-disable-next-line no-console
            console.warn(
              `[evento-vehiculo] email a ${userEmail} no enviado: ${result.error}. ` +
                `Informe ${userReportId} marcado ready de todas formas.`,
            );
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`[evento-vehiculo] email exception:`, err);
        });
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `[evento-vehiculo] user ${ur.user_id} no tiene email; saltando notificación`,
      );
    }

    return {
      html: finalHtml,
      tokens_used: totalTokensIn + totalTokensOut,
      cost_usd: totalCost,
      duration_ms: elapsedTotal,
      model_used: 'claude-sonnet-4-5-20250929',
      word_count: wordCount,
      completed_sections: succeeded.length,
      failed_sections: failed.map((r) => r.id),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReportUrl(reportId: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.astrodorado.com';
  return `${baseUrl.replace(/\/$/, '')}/ver/${reportId}`;
}

function formatDateEs(iso: string): string {
  // 2026-06-15 → 15 jun 2026
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${parseInt(dd, 10)} ${months[parseInt(mm, 10) - 1]} ${y}`;
}
