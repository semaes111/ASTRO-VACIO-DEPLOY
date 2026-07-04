/**
 * Aviso de transparencia de IA — Reglamento (UE) 2024/1689 (Reglamento de IA),
 * obligaciones de transparencia (art. 50), aplicables desde el 2 de agosto de 2026.
 *
 * El contenido interpretativo de los informes se genera total o parcialmente
 * mediante IA, por lo que debe informarse de ello de forma visible. Este aviso
 * se añade en el ÚNICO punto de guardado compartido (markGenerationReady), de
 * modo que cubre los 19 productos (genéricos y bespoke) y cualquier producto futuro.
 *
 * Estilos inline y fondo propio: legible sobre cualquier plantilla (clara u oscura).
 * Idempotente: nunca se duplica.
 */

const MARKER = 'astrodorado-ai-disclosure';

const DISCLOSURE_HTML = `<div id="${MARKER}" role="note" aria-label="Aviso de contenido generado con inteligencia artificial" style="max-width:780px;margin:32px auto 40px;padding:16px 20px;border:1px solid rgba(150,150,150,.35);border-radius:10px;background:#f6f3ec;color:#3a3a3a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:12.5px;line-height:1.6;box-sizing:border-box"><div style="font-weight:600;color:#5a4a1a;margin-bottom:4px">Contenido generado con inteligencia artificial</div>Este informe ha sido elaborado de forma <strong>total o parcial mediante sistemas de inteligencia artificial</strong> a partir de los datos facilitados. Los cálculos astronómicos y numéricos se realizan de forma determinista y verificable; la redacción interpretativa se genera con IA. Aviso conforme al <strong>Reglamento (UE) 2024/1689</strong> (Reglamento de Inteligencia Artificial). El contenido es de carácter simbólico-interpretativo y no constituye asesoramiento médico, financiero, jurídico ni profesional.</div>`;

/**
 * Inserta el aviso de IA antes de `</body>` (o al final si no lo hay).
 * Idempotente: si el aviso ya está presente, devuelve el HTML sin cambios.
 */
export function withAiDisclosure(html: string): string {
  if (!html || html.includes(MARKER)) return html;
  if (html.includes('</body>')) {
    return html.replace('</body>', `${DISCLOSURE_HTML}</body>`);
  }
  return `${html}\n${DISCLOSURE_HTML}`;
}
