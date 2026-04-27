/**
 * Tipos canónicos para la tabla `astrodorado.report_templates` y su wrapper
 * view `public.astrodorado_report_templates`.
 *
 * Regla del proyecto (CLAUDE-MASTER §4.1): los tipos viven aquí, nunca inline.
 * Si cambia el esquema de la DB, actualiza este archivo ANTES que cualquier
 * consumidor (queries, template-loader, workers).
 *
 * Correspondencia 1:1 con la migración del Turno 1 +
 * 20260422_create_report_templates_view.sql.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Origen del template. Coincide con el CHECK constraint en la DB.
 *  - `manual`           → pegado a mano por un operador
 *  - `zip_ingest`       → parseado de un zip de Kimi/Builder sin Puppeteer
 *  - `ai_generated`     → producido por un LLM (draft)
 *  - `puppeteer_render` → renderizado con Chromium (el caso estándar del Turno 2)
 */
export type ReportTemplateSource =
  | 'manual'
  | 'zip_ingest'
  | 'ai_generated'
  | 'puppeteer_render';

// ---------------------------------------------------------------------------
// Data schema (contenido del campo JSONB `data_schema`)
// ---------------------------------------------------------------------------

/**
 * Un slot opcional que el template expone. Se rellena durante la ingesta
 * cuando el parser detecta marcadores `{{SLOT:xxx}}` en el HTML.
 *
 * En V1 (modo "referencia" — el worker actual), `data_schema` se ignora:
 * Claude regenera el HTML completo usando el template como guía visual.
 *
 * En V2 (modo "slots" — evolución futura), el worker solo pide a Claude
 * el contenido de cada slot y los sustituye literalmente. Mucho más barato
 * en tokens output, pero requiere templates con slots bien marcados.
 */
export interface ReportTemplateSlot {
  /** Identificador del slot dentro del HTML. Ej: "intro", "section_transits". */
  key: string;
  /** Etiqueta legible para logs y UI administrativa. */
  label?: string;
  /** Límite orientativo de palabras que Claude debe respetar. */
  word_limit?: number;
  /** Si el slot debe estar presente en la respuesta de Claude. */
  required?: boolean;
  /** Notas libres para el prompt. */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Filas de la DB
// ---------------------------------------------------------------------------

/**
 * Fila completa de `astrodorado.report_templates`.
 * Incluye el HTML — pesa (templates entre 50KB y 500KB). No instanciar
 * en bulk; usar `ReportTemplateSummary` para listados.
 */
export interface ReportTemplateRow {
  id: string;
  slug: string;
  html_template: string;
  data_schema: ReportTemplateSlot[];
  source: ReportTemplateSource;
  version: number;
  is_active: boolean;
  notes: string | null;
  byte_size: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vista ligera para listados y UI administrativa. Excluye el HTML.
 */
export type ReportTemplateSummary = Pick<
  ReportTemplateRow,
  | 'id'
  | 'slug'
  | 'version'
  | 'is_active'
  | 'source'
  | 'byte_size'
  | 'notes'
  | 'created_at'
  | 'updated_at'
>;

// ---------------------------------------------------------------------------
// Respuesta de la RPC `public.astrodorado_upsert_template`
// ---------------------------------------------------------------------------

/**
 * Resultado que devuelve `astrodorado_upsert_template`. NO incluye el HTML.
 * Se usa para logging y verificación post-insert, no para reconstruir la fila.
 */
export interface UpsertTemplateResult {
  id: string;
  slug: string;
  version: number;
  byte_size: number;
  is_active: boolean;
  created_at: string;
}
