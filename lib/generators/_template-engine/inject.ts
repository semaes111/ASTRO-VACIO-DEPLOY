/**
 * Inyección de fragmentos en plantilla — motor genérico 001.
 * Dos modos por slot: selector CSS (innerHTML de la zona) o marcador
 * literal {{SLOT:key}}. Restricción R4: el DOM/CSS no se toca; un slot
 * sin fragmento o sin match conserva el contenido demo de la plantilla
 * (degradación invisible, nunca rotura).
 */
import { parse } from 'node-html-parser';
import type { ReportTemplateSlot } from '@/lib/types/report-templates';

export interface InjectResult {
  html: string;
  injected: string[];
  missing_selector: string[];
  missing_fragment: string[];
}

export function injectSlots(
  templateHtml: string,
  slots: ReportTemplateSlot[],
  fragments: Record<string, string>,
): InjectResult {
  const injected: string[] = [];
  const missing_selector: string[] = [];
  const missing_fragment: string[] = [];

  const root = parse(templateHtml, {
    comment: true,
    blockTextElements: { script: true, noscript: true, style: true, pre: true },
  });

  const literales: ReportTemplateSlot[] = [];

  for (const slot of slots) {
    if (!slot.selector) {
      literales.push(slot);
      continue;
    }
    // Resolución del ancla (selector-first: un selector roto SIEMPRE aflora)
    let node: ReturnType<typeof root.querySelector> = null;
    if (slot.selector.endsWith('::content')) {
      const base = root.querySelector(slot.selector.slice(0, -'::content'.length).trim());
      if (base) {
        let best: typeof node = null;
        let bestP = 0;
        const stack = [...base.childNodes];
        while (stack.length) {
          const n = stack.shift();
          if (!n || n.nodeType !== 1) continue;
          const el = n as unknown as NonNullable<typeof node>;
          const pCount = el.querySelectorAll('p').length;
          if (pCount > bestP && el.querySelectorAll('h1,h2,h3').length === 0) {
            best = el;
            bestP = pCount;
          }
          stack.push(...el.childNodes);
        }
        node = best;
      }
    } else {
      node = root.querySelector(slot.selector);
    }
    if (!node) {
      missing_selector.push(slot.key);
      continue;
    }
    const fragment = fragments[slot.key];
    if (typeof fragment !== 'string' || fragment.trim().length === 0) {
      missing_fragment.push(slot.key);
      continue;
    }
    node.set_content(fragment);
    injected.push(slot.key);
  }

  let html = root.toString();

  // Modo marcador literal {{SLOT:key}} (marcador-first, misma prioridad)
  for (const slot of literales) {
    const marker = `{{SLOT:${slot.key}}}`;
    if (!html.includes(marker)) {
      missing_selector.push(slot.key);
      continue;
    }
    const fragment = fragments[slot.key];
    if (typeof fragment !== 'string' || fragment.trim().length === 0) {
      missing_fragment.push(slot.key);
      continue;
    }
    html = html.split(marker).join(fragment);
    injected.push(slot.key);
  }

  return { html, injected, missing_selector, missing_fragment };
}
