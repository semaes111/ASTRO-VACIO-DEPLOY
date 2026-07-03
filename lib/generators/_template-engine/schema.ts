/**
 * Validación del data_schema (ReportTemplateSlot[]) — motor genérico 001.
 * El contrato vive en lib/types/report-templates.ts; aquí solo el guard
 * runtime (jsonb ⇒ unknown en frontera de DB).
 */
import type { ReportTemplateSlot } from '@/lib/types/report-templates';

function isSlot(v: unknown): v is ReportTemplateSlot {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.key !== 'string' || o.key.length === 0) return false;
  if (o.selector !== undefined && typeof o.selector !== 'string') return false;
  if (o.word_limit !== undefined && typeof o.word_limit !== 'number') return false;
  return true;
}

export function validateSlots(raw: unknown): ReportTemplateSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSlot);
}
