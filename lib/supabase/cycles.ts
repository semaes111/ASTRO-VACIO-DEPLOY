// Helper para llamar al RPC calc_amorc_cycles desde Server Components/Actions.
// Los ciclos AMORC solo cambian cada ~52 dias (Vida/Negocios/Salud),
// cada ~3.4h (Diario) o cada periodo del calendario (Alma). El caller puede
// cachear el resultado con confianza (ej: unstable_cache de Next.js o en BD).

import { createClient } from '@/lib/supabase/server';
import type { AmorcCyclesSnapshot } from '@/lib/types/life-cycles';

export async function getAmorcCycles(
  birthDate: string,
  birthTime: string = '12:00',
  targetDate?: Date,
): Promise<AmorcCyclesSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('calc_amorc_cycles', {
    p_birth_date: birthDate,
    p_birth_time: birthTime,
    p_target_date: targetDate ? targetDate.toISOString() : new Date().toISOString(),
  });

  if (error) {
    throw new Error(`getAmorcCycles: ${error.message}`);
  }
  if (!data) {
    throw new Error('getAmorcCycles: returned null');
  }
  return data as AmorcCyclesSnapshot;
}

// Version tolerante a errores para UI no-critica (devuelve null en lugar de throw).
// Util cuando los ciclos son un "plus" al informe pero no deben tumbar toda la pagina.
export async function getAmorcCyclesSafe(
  birthDate: string,
  birthTime: string = '12:00',
  targetDate?: Date,
): Promise<AmorcCyclesSnapshot | null> {
  try {
    return await getAmorcCycles(birthDate, birthTime, targetDate);
  } catch (e) {
    console.error('[cycles] RPC fallo:', e);
    return null;
  }
}