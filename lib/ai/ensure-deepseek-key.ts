/**
 * ensure-deepseek-key — Puente de secreto para DEEPSEEK_API_KEY.
 *
 * CONTEXTO: DEEPSEEK_API_KEY no está configurada en el entorno Production
 * de Vercel y no existe vía programática para inyectarla (sin token de la
 * API de Vercel). Este helper implementa el patrón secret-manager lookup:
 * si la env var no existe en el proceso, la carga desde Supabase Vault
 * (cifrado en reposo) vía la RPC `astrodorado_get_secret`, cuyo EXECUTE
 * está restringido a service_role, y la inyecta en process.env ANTES de
 * que lib/ai/deepseek.ts::getClient() la lea (lectura lazy en la primera
 * generación).
 *
 * ENDGAME: cuando la key se rote y se añada como env var en Vercel
 * (Production + Preview), este helper queda dormante (el guard no entra)
 * y puede eliminarse junto con el secreto del Vault.
 *
 * Coste: 1 RPC por cold-start de lambda (cacheado en scope de módulo).
 */

import { createAdminClient } from '@/lib/supabase/admin';

let cargado = false;

export async function ensureDeepSeekKey(): Promise<void> {
  if (process.env.DEEPSEEK_API_KEY || cargado) return;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('astrodorado_get_secret', {
    p_name: 'DEEPSEEK_API_KEY',
  });

  if (error || typeof data !== 'string' || data.length === 0) {
    throw new Error(
      `ensureDeepSeekKey: no se pudo cargar la key desde Vault (${error?.message ?? 'respuesta vacía'})`,
    );
  }

  process.env.DEEPSEEK_API_KEY = data;
  cargado = true;
}
