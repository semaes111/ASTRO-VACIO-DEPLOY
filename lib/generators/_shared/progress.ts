// ============================================================
// lib/generators/_shared/progress.ts - Tracking de progreso de generación
//
// Estado de progreso que se persiste en la columna `progress` (jsonb)
// de astrodorado.user_reports durante una generación chunked.
//
// El frontend lo lee vía /api/informe-status para mostrar al usuario
// qué secciones están completas, en progreso o han fallado.
//
// FILOSOFÍA:
//   - Estructura plana, sin nesting profundo (jsonb queries simples)
//   - IDs de sección estables ('s1'..'s6') que NO dependen del producto
//   - Failed != error fatal: una sección puede fallar y reintentar
// ============================================================

export type SectionId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6';

export type SectionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Estructura del jsonb almacenado en astrodorado.user_reports.progress.
 *
 * Diseño optimizado para frontend polling:
 *   - completed_sections: array de IDs ya listos → barra de progreso
 *   - in_progress_sections: array de IDs en curso → spinner
 *   - failed_sections: array de IDs con error → UI de retry
 *   - last_update_at: para detectar progreso "estancado" (>30s sin cambio)
 */
export interface ProgressState {
  total_sections: number;
  completed_sections: SectionId[];
  in_progress_sections: SectionId[];
  failed_sections: SectionId[];
  started_at: string; // ISO 8601
  last_update_at: string; // ISO 8601
}

/**
 * Estado inicial al arrancar una generación chunked.
 */
export function initialProgress(totalSections: number = 6): ProgressState {
  const now = new Date().toISOString();
  return {
    total_sections: totalSections,
    completed_sections: [],
    in_progress_sections: [],
    failed_sections: [],
    started_at: now,
    last_update_at: now,
  };
}

/**
 * Marca una sección como en progreso. Inmutable: devuelve nuevo estado.
 */
export function markInProgress(state: ProgressState, sid: SectionId): ProgressState {
  return {
    ...state,
    // Por si estaba en failed_sections de un retry anterior
    failed_sections: state.failed_sections.filter((s) => s !== sid),
    in_progress_sections: dedupe([...state.in_progress_sections, sid]),
    last_update_at: new Date().toISOString(),
  };
}

/**
 * Marca una sección como completa. Quita de in_progress.
 */
export function markCompleted(state: ProgressState, sid: SectionId): ProgressState {
  return {
    ...state,
    in_progress_sections: state.in_progress_sections.filter((s) => s !== sid),
    completed_sections: dedupe([...state.completed_sections, sid]),
    last_update_at: new Date().toISOString(),
  };
}

/**
 * Marca una sección como fallida. Quita de in_progress.
 */
export function markFailed(state: ProgressState, sid: SectionId): ProgressState {
  return {
    ...state,
    in_progress_sections: state.in_progress_sections.filter((s) => s !== sid),
    failed_sections: dedupe([...state.failed_sections, sid]),
    last_update_at: new Date().toISOString(),
  };
}

/**
 * % de progreso (0..100) para barra del frontend.
 * Considera 50% de peso a "completed" y 25% de peso a "in_progress"
 * (las que están en curso ya muestran progreso parcial).
 */
export function progressPercent(state: ProgressState): number {
  if (state.total_sections === 0) return 0;
  const score =
    state.completed_sections.length * 1.0 +
    state.in_progress_sections.length * 0.5;
  return Math.min(100, Math.round((score / state.total_sections) * 100));
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
