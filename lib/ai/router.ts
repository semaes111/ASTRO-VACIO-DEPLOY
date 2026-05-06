// ============================================================
// lib/ai/router.ts - Routing centralizado por TaskType
//
// Capa de abstracción sobre los wrappers de LLM (sonnet.ts, deepseek.ts).
// Los generadores NO deben importar deepseek.ts ni sonnet.ts directamente
// (excepto para casos específicos justificados).
//
// Patrón de uso:
//   import { generateForTask, generateForTaskStream } from '@/lib/ai/router';
//
//   const result = await generateForTaskStream({
//     task: 'narrative',  // ← decide modelo automáticamente
//     system: '...',
//     user: '...',
//     max_tokens: 4000,
//     cache_system: true,
//   });
//
// Beneficios:
//   1. Cambiar de modelo = editar ROUTING_TABLE, no tocar generadores
//   2. Centraliza políticas de fallback (futuro: try DeepSeek → fall to Sonnet)
//   3. Mismo shape GenerationResult: caller no sabe qué modelo se usó
//
// Estado actual (mayo 2026):
//   - 100% del tráfico va a DeepSeek V4 Flash
//   - lib/ai/sonnet.ts se mantiene en el repo como rollback de emergencia
//     pero NO se importa desde aquí. Para revertir: editar este archivo
//     y cambiar el delegate a sonnet.ts.
// ============================================================

import {
  generateWithDeepSeek,
  generateWithDeepSeekStream,
  type GenerationRequest,
  type GenerationResult,
} from './deepseek';

// ---------- TYPES ----------

/**
 * Categoría de tarea. Cada una mapea a un modelo en ROUTING_TABLE.
 *
 * - 'narrative': generación de texto largo (informes astrológicos,
 *   secciones, content marketing). Sin reasoning explícito.
 * - 'reasoning': tareas que se benefician de chain-of-thought visible
 *   (cálculos lógicos complejos, decisiones multi-paso). Más caras
 *   por los thinking tokens, usar solo cuando aporte calidad.
 */
export type TaskType = 'narrative' | 'reasoning';

export interface RoutedRequest extends GenerationRequest {
  /** Categoría de tarea — determina el modelo. */
  task: TaskType;
}

interface RoutingPolicy {
  /** Función que ejecuta la generación. */
  delegate: (req: GenerationRequest) => Promise<GenerationResult>;
  /** Función streaming equivalente. */
  delegateStream: (req: GenerationRequest) => Promise<GenerationResult>;
  /** Documentación humana del por qué de esta política. */
  rationale: string;
}

// ---------- ROUTING TABLE ----------

/**
 * Mapping TaskType → política de generación.
 *
 * Para añadir un nuevo modelo (ej. Anthropic Sonnet como fallback):
 *   1. Importar generateWithSonnet de '@/lib/ai/sonnet'
 *   2. Añadir wrapper que intente DeepSeek primero, fallback a Sonnet
 *   3. Sustituir delegate aquí
 */
const ROUTING_TABLE: Record<TaskType, RoutingPolicy> = {
  narrative: {
    delegate: generateWithDeepSeek,
    delegateStream: generateWithDeepSeekStream,
    rationale:
      'DeepSeek V4 Flash: $0.14/$0.28/Mtok + cache hit $0.003. ~$0.003/informe ' +
      'chunked vs $0.134 con Sonnet 4.5. Calidad balance para narrativa española.',
  },
  reasoning: {
    // Por ahora, mismo modelo que narrative. V4 Flash soporta thinking
    // mode pero no lo activamos aquí (param distinto). Cuando lo
    // necesitemos, este delegate cambiará a un wrapper específico.
    delegate: generateWithDeepSeek,
    delegateStream: generateWithDeepSeekStream,
    rationale:
      'V4 Flash sin thinking. Si en el futuro necesitamos chain-of-thought ' +
      'visible (cálculos electional, etc.), cambiar a deepseek-reasoner ' +
      'o V4 thinking mode.',
  },
};

// ---------- PUBLIC API ----------

/**
 * Generación síncrona. Drop-in para callers que usaban
 * generateWithSonnet({ system, user, ... }).
 *
 * Solo añade el campo `task` al request.
 */
export async function generateForTask(
  req: RoutedRequest,
): Promise<GenerationResult> {
  const policy = ROUTING_TABLE[req.task];
  // Stripeamos el campo task antes de pasarlo al delegate
  const { task: _task, ...delegateReq } = req;
  return policy.delegate(delegateReq);
}

/**
 * Generación streaming. Drop-in para callers que usaban
 * generateWithSonnetStream({ system, user, cache_system: true, ... }).
 *
 * Recomendado para cualquier max_tokens > 2000 o cuando se quiere
 * mantener TCP vivo durante generación larga.
 */
export async function generateForTaskStream(
  req: RoutedRequest,
): Promise<GenerationResult> {
  const policy = ROUTING_TABLE[req.task];
  const { task: _task, ...delegateReq } = req;
  return policy.delegateStream(delegateReq);
}

// Re-exportar tipos para que los callers solo importen del router.
export type { GenerationRequest, GenerationResult } from './deepseek';
