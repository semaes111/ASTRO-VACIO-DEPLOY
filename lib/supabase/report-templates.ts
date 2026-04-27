/**
 * Queries centralizadas para `public.astrodorado_report_templates`.
 *
 * Regla del proyecto (CLAUDE-MASTER §4.2): toda query vive aquí, nunca inline
 * en componentes. Consumidores:
 *  - `lib/generators/_shared/template-loader.ts` (con cache en memoria)
 *  - `app/admin/templates/*` (futuro — si se crea UI administrativa)
 *
 * ¿Por qué leer vía wrapper view `public.astrodorado_report_templates`?
 *   PostgREST (supabase-js REST) solo expone el schema `public` por defecto.
 *   Las llamadas `.schema('astrodorado').from('report_templates')` fallan
 *   con "Invalid schema". La view en public es el contrato limpio.
 *
 * Cliente: usa service_role (createAdminClient de @/lib/supabase/admin) porque
 * estos helpers se invocan desde workers que pueden correr fuera de un
 * Route Handler (cron jobs, scripts CLI, Edge Functions). El cliente con
 * cookies de @/lib/supabase/server NO sirve en esos contextos.
 *
 * Errores: propagación explícita vía `throw new Error(...)`. Nunca swallow.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  ReportTemplateRow,
  ReportTemplateSummary,
} from '@/lib/types/report-templates';

// Columnas explícitas — nunca '*' (CLAUDE-MASTER §4.2)
const FULL_COLUMNS =
  'id, slug, html_template, data_schema, source, version, is_active, notes, byte_size, created_at, updated_at';

const SUMMARY_COLUMNS =
  'id, slug, version, is_active, source, byte_size, notes, created_at, updated_at';

/**
 * Obtiene el template activo de un slug. Devuelve `null` si no existe
 * (NO lanza excepción — la ausencia es un caso legítimo que el worker
 * debe manejar con un fallback).
 *
 * Si hubiese múltiples activos para el mismo slug (bug — no existe un
 * constraint que lo impida tras la migración del Turno 1), devuelve el
 * de mayor versión y loguea un warning.
 *
 * @throws si la query REST falla (red, 500, credenciales, etc.)
 */
export async function getActiveTemplate(
  slug: string,
): Promise<ReportTemplateRow | null> {
  if (!slug || typeof slug !== 'string') {
    throw new Error('getActiveTemplate: slug requerido');
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('astrodorado_report_templates')
    .select(FULL_COLUMNS)
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(2);

  if (error) {
    throw new Error(`getActiveTemplate(${slug}): ${error.message}`);
  }
  if (!data || data.length === 0) {
    return null;
  }
  if (data.length > 1) {
    // eslint-disable-next-line no-console
    console.warn(
      `[report-templates] Múltiples templates activos para slug=${slug}. ` +
        `Usando version=${(data[0] as ReportTemplateRow).version}. ` +
        'Revisar integridad de is_active.',
    );
  }
  return data[0] as ReportTemplateRow;
}

/**
 * Lista todas las versiones activas (una por slug, la más reciente).
 * Uso previsto: UI administrativa "/admin/templates" o scripts de diagnóstico.
 * Pagina explícitamente — la view no debería superar 50 filas en producción.
 */
export async function listActiveTemplates(params?: {
  limit?: number;
  offset?: number;
}): Promise<ReportTemplateSummary[]> {
  const limit = Math.min(params?.limit ?? 50, 200);
  const offset = params?.offset ?? 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('astrodorado_report_templates')
    .select(SUMMARY_COLUMNS)
    .order('slug', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`listActiveTemplates: ${error.message}`);
  }
  return (data ?? []) as ReportTemplateSummary[];
}

/**
 * Devuelve `true` si existe un template activo para el slug. Útil para
 * endpoints de preflight antes de lanzar la generación (evita esperar
 * a que el worker falle por "template no encontrado").
 */
export async function hasActiveTemplate(slug: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('astrodorado_report_templates')
    .select('slug', { count: 'exact', head: true })
    .eq('slug', slug);

  if (error) {
    throw new Error(`hasActiveTemplate(${slug}): ${error.message}`);
  }
  return (count ?? 0) > 0;
}
