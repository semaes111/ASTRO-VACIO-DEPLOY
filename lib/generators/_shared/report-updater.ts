/**
 * Helpers para transicionar `user_reports` entre estados durante la
 * generación. Centraliza los UPDATE para que todos los workers los usen
 * de forma consistente y para mantener las métricas (tokens, coste, duración).
 *
 * Diagrama de estados (resumen — referencia canónica en docs/adr):
 *
 *   pending_payment → paid → generating → ready
 *                        \→ error (con error_count++)
 *
 * Reglas:
 *   - Usa service_role (createAdminClient) porque user_reports tiene RLS
 *     que impide que anon/authenticated escriban. NUNCA llames a estos
 *     helpers desde un Client Component.
 *   - La view `public.astrodorado_user_reports` ya expone la tabla base.
 *   - `error_count` se incrementa a nivel de DB cuando hay error.
 *   - Los timestamps se rellenan aquí; el worker no debe setearlos a mano.
 */
import { createAdminClient } from '@/lib/supabase/admin';

const COLS_WRITABLE =
  'id, status, output_html, error_message, error_count, ' +
  'generation_started_at, generated_at, generation_duration_ms, ' +
  'tokens_used, model_used, actual_cost_usd, updated_at';

/**
 * Marca el informe como "generating" y persiste `generation_started_at`.
 * Usar justo antes de la llamada a Claude.
 */
export async function markGenerationStarted(reportId: string): Promise<void> {
  if (!reportId) throw new Error('markGenerationStarted: reportId requerido');

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('astrodorado_user_reports')
    .update({
      status: 'generating',
      generation_started_at: new Date().toISOString(),
      error_message: null, // limpiamos posibles errores previos si hay reintento
    })
    .eq('id', reportId);

  if (error) {
    throw new Error(`markGenerationStarted(${reportId}): ${error.message}`);
  }
}

export interface GenerationSuccessMetrics {
  output_html: string;
  tokens_used: number;
  model_used: string;
  actual_cost_usd: number;
  generation_duration_ms: number;
}

/**
 * Marca el informe como "ready" con el HTML final y todas las métricas.
 * Se ejecuta como un único UPDATE atómico (misma transacción REST).
 */
export async function markGenerationReady(
  reportId: string,
  metrics: GenerationSuccessMetrics,
): Promise<void> {
  if (!reportId) throw new Error('markGenerationReady: reportId requerido');
  if (!metrics.output_html) {
    throw new Error('markGenerationReady: output_html vacío');
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('astrodorado_user_reports')
    .update({
      status: 'ready',
      output_html: metrics.output_html,
      tokens_used: metrics.tokens_used,
      model_used: metrics.model_used,
      actual_cost_usd: metrics.actual_cost_usd,
      generation_duration_ms: metrics.generation_duration_ms,
      generated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', reportId);

  if (error) {
    throw new Error(`markGenerationReady(${reportId}): ${error.message}`);
  }
}

/**
 * Marca el informe como "error" con mensaje y autoincrementa `error_count`.
 * Se usa tanto para errores de Claude como de validación del HTML.
 *
 * Implementación: incrementamos `error_count` en dos llamadas (SELECT + UPDATE)
 * porque PostgREST no soporta expresiones (`col = col + 1`) en el body del
 * UPDATE. Si se quisiera atomicidad estricta, crear una función SQL.
 */
export async function markGenerationError(
  reportId: string,
  errorMessage: string,
): Promise<void> {
  if (!reportId) throw new Error('markGenerationError: reportId requerido');

  const supabase = createAdminClient();

  // 1) Leer error_count actual
  const { data: current, error: readError } = await supabase
    .from('astrodorado_user_reports')
    .select('error_count')
    .eq('id', reportId)
    .single();

  if (readError) {
    // Si no podemos leer, intentamos escribir con error_count = 1
    // (aceptamos la pérdida de precisión en reintentos raros).
  }

  const nextCount = (current?.error_count ?? 0) + 1;

  const { error } = await supabase
    .from('astrodorado_user_reports')
    .update({
      status: 'error',
      error_message: errorMessage.slice(0, 2000), // límite razonable
      error_count: nextCount,
    })
    .eq('id', reportId);

  if (error) {
    // Si esto también falla, lo logueamos y propagamos — el worker
    // ya estaba en camino de fallar de todos modos.
    // eslint-disable-next-line no-console
    console.error(
      `markGenerationError(${reportId}) FALLÓ al persistir: ${error.message}. ` +
        `Error original: ${errorMessage}`,
    );
    throw new Error(`markGenerationError(${reportId}): ${error.message}`);
  }
}
