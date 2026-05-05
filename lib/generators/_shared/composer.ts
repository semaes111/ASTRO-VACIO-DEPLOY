// ============================================================
// lib/generators/_shared/composer.ts - Ensambla secciones en HTML final
//
// Cuando un generador chunked produce 6 secciones en paralelo
// (cada una un <section id="seccion-N">), el composer las une en un
// único <article> con header + body + footer, listo para ser
// pasado por sanitizeReportHtml + assertValidReportHtml.
//
// El composer es agnóstico al producto (no conoce las semánticas de
// vehiculo/mudanza/ayurveda). Recibe metadata como argumento.
// ============================================================

import { sanitizeReportHtml } from './html-sanitizer';

/**
 * Una sección generada. Si failed=true, html debe ser un placeholder
 * de error (ej. <section><p>Sección no disponible</p></section>) para
 * mantener el flujo del informe sin romper la estructura.
 */
export interface GeneratedSection {
  id: 's1' | 's2' | 's3' | 's4' | 's5' | 's6';
  /** HTML de la sección, debe empezar por <section ...> y terminar por </section> */
  html: string;
  failed?: boolean;
}

export interface ComposeOptions {
  /** Slug del producto: "evento-vehiculo", "evento-mudanza", etc. */
  productSlug: string;
  /** Nombre del usuario (para personalización del header). */
  userName: string;
  /** Subtítulo/contexto: ej. "Compra de vehículo · 15 jun 2026". */
  contextLine: string;
  /** Texto del footer. Por defecto disclaimer estándar. */
  footerText?: string;
}

const DEFAULT_FOOTER = `Este informe es una herramienta orientativa basada en astrología occidental tradicional. Las decisiones finales son siempre tuyas.`;

/**
 * Ensambla las 6 secciones en un <article> completo.
 *
 * Garantías:
 *   - Las secciones se concatenan en el orden s1..s6 (no por argumento)
 *   - Si falta alguna sección, se inserta un placeholder visual
 *   - El HTML resultante pasa sanitizeReportHtml para limpiar atributos
 *     React/inline scripts si Claude añadió alguno por accidente
 *
 * NO maneja errores fatales: si todas las secciones fallaron, el caller
 * debe decidir si guarda el informe parcial o tirar.
 */
export function composeReport(
  sections: GeneratedSection[],
  options: ComposeOptions
): string {
  // Ordenar por ID para garantizar S1..S6
  const sorted = [...sections].sort((a, b) => a.id.localeCompare(b.id));

  // Garantizar que están las 6 (rellenar huecos con placeholder)
  const allIds: GeneratedSection['id'][] = ['s1', 's2', 's3', 's4', 's5', 's6'];
  const byId = new Map(sorted.map((s) => [s.id, s]));
  const filled = allIds.map(
    (id): GeneratedSection =>
      byId.get(id) ?? {
        id,
        html: `<section class="ev-section ev-section-missing" id="seccion-${idToNumber(id)}"><p><em>Esta sección no pudo generarse en este momento. Inténtalo más tarde.</em></p></section>`,
        failed: true,
      }
  );

  const sectionsHtml = filled.map((s) => s.html.trim()).join('\n');

  const articleHtml = `<article class="ev-report" data-product="${escapeAttr(options.productSlug)}">
<header class="ev-report-header">
<h1 class="ev-report-title">Informe astrológico para ${escapeText(options.userName)}</h1>
<p class="ev-report-context">${escapeText(options.contextLine)}</p>
</header>
${sectionsHtml}
<footer class="ev-report-footer">
<p>${escapeText(options.footerText ?? DEFAULT_FOOTER)}</p>
</footer>
</article>`;

  return sanitizeReportHtml(articleHtml);
}

function idToNumber(id: string): string {
  return id.replace(/^s/, '');
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}
