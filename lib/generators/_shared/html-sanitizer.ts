/**
 * HTML Sanitizer para output de Claude.
 *
 * Motivación:
 *   El worker pide a Claude que "regenere el HTML" usando un template como
 *   referencia. Claude es fiable pero puede colar cosas indeseables:
 *     - `<script>` tags (el original no los tiene, pero Claude podría añadir
 *       analytics imaginarios)
 *     - Handlers inline (`onclick`, `onerror`) que son superficies de XSS
 *       si el HTML acaba renderizado sin sandbox
 *     - Marcadores markdown accidentales (```html, ``` al inicio/fin)
 *     - Tags de apertura/cierre mal formados (raro, pero lo validamos)
 *
 *   Este módulo es la última barrera antes de persistir el HTML en
 *   `user_reports.output_html`. NO reemplaza a una CSP o a un sandbox,
 *   pero elimina los vectores más obvios.
 *
 * Filosofía:
 *   Allowlist > denylist cuando es práctico. Aquí usamos denylist porque
 *   el dominio visual (CSS, animaciones, gráficos) es demasiado amplio
 *   para enumerar. Compensamos siendo muy estrictos con JS.
 *
 * Fuera del alcance (out-of-scope):
 *   - No valida XSS profundo en atributos (url-encoded javascript:, data-uri).
 *     Para eso, añade CSP en el response del route handler.
 *   - No parsea DOM (sería caro y este es un hot-path). Si en el futuro
 *     se necesita, cambiar a `parse5` o `cheerio`.
 */

// ---------------------------------------------------------------------------
// Regex "suficientemente buenos" para este contexto
// ---------------------------------------------------------------------------

const SCRIPT_BLOCK = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const SCRIPT_VOID = /<script\b[^>]*\/>/gi;
const IFRAME_BLOCK = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
const OBJECT_BLOCK = /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi;
const EMBED_TAG = /<embed\b[^>]*>/gi;
const INLINE_HANDLER = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL = /(?<=(?:href|src|action)\s*=\s*["'])\s*javascript:[^"']*/gi;
const MARKDOWN_FENCES = /^\s*```(?:html|HTML)?\s*|\s*```\s*$/g;

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface SanitizeReport {
  /** HTML después de limpiar */
  html: string;
  /** Flags con qué se ha eliminado. Útil para logs y métricas. */
  removed: {
    scripts: number;
    iframes: number;
    objects: number;
    embeds: number;
    inlineHandlers: number;
    javascriptUrls: number;
    markdownFences: boolean;
  };
  /** Size comparison — útil para alertar si Claude inyectó mucha basura. */
  bytesBefore: number;
  bytesAfter: number;
}

export function sanitizeGeneratedHtml(raw: string): SanitizeReport {
  if (typeof raw !== 'string') {
    throw new Error('sanitizeGeneratedHtml: input no es string');
  }

  const bytesBefore = Buffer.byteLength(raw, 'utf8');
  let html = raw;

  // 1) Quitar fences de markdown (Claude a veces envuelve en ```html...```)
  const hadFences = MARKDOWN_FENCES.test(html);
  html = html.replace(MARKDOWN_FENCES, '');

  // 2) Script blocks
  const scriptsBlock = html.match(SCRIPT_BLOCK)?.length ?? 0;
  html = html.replace(SCRIPT_BLOCK, '');
  const scriptsVoid = html.match(SCRIPT_VOID)?.length ?? 0;
  html = html.replace(SCRIPT_VOID, '');

  // 3) iframes, objects, embeds
  const iframes = html.match(IFRAME_BLOCK)?.length ?? 0;
  html = html.replace(IFRAME_BLOCK, '');
  const objects = html.match(OBJECT_BLOCK)?.length ?? 0;
  html = html.replace(OBJECT_BLOCK, '');
  const embeds = html.match(EMBED_TAG)?.length ?? 0;
  html = html.replace(EMBED_TAG, '');

  // 4) Handlers inline (on*=)
  const inlineHandlers = html.match(INLINE_HANDLER)?.length ?? 0;
  html = html.replace(INLINE_HANDLER, '');

  // 5) URLs javascript:
  const jsUrls = html.match(JAVASCRIPT_URL)?.length ?? 0;
  html = html.replace(JAVASCRIPT_URL, 'about:blank');

  // 6) Normalizaciones menores
  html = html.trim();

  return {
    html,
    removed: {
      scripts: scriptsBlock + scriptsVoid,
      iframes,
      objects,
      embeds,
      inlineHandlers,
      javascriptUrls: jsUrls,
      markdownFences: hadFences,
    },
    bytesBefore,
    bytesAfter: Buffer.byteLength(html, 'utf8'),
  };
}

/**
 * Valida forma básica del HTML limpio. Lanza excepción si algo huele mal.
 * Usar después de `sanitizeGeneratedHtml` en el worker para detener la
 * inserción antes de persistir basura.
 */
export function assertValidReportHtml(html: string): void {
  if (!html || html.length < 500) {
    throw new Error(
      `HTML generado demasiado corto (${html?.length ?? 0} bytes). Claude falló.`,
    );
  }
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    throw new Error('HTML generado no contiene <html>…</html>. Claude falló.');
  }
  if (!/<body[\s>]/i.test(html) || !/<\/body>/i.test(html)) {
    throw new Error('HTML generado no contiene <body>…</body>. Claude falló.');
  }
  // Heurística: si el output contiene literal "undefined" o "null" más de
  // 3 veces, es muy probable que Claude haya fallado interpolando datos.
  const undefinedMatches = html.match(/\bundefined\b/g)?.length ?? 0;
  if (undefinedMatches > 3) {
    throw new Error(
      `HTML generado tiene ${undefinedMatches} ocurrencias de "undefined". ` +
        'Probablemente Claude interpoló mal los inputs.',
    );
  }
}
