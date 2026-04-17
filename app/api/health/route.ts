import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Health check liviano para Docker HEALTHCHECK y monitoreo.
 * Verifica que podemos conectar con Supabase (latencia mínima con un ping al schema).
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .schema('astrodorado')
      .from('zodiac_signs')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'degraded', db: 'unreachable', error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 503 },
    );
  }
}
