/**
 * /api/informe-status?report_id=<uuid>
 *
 * Endpoint de polling para que el frontend sepa el estado de un informe
 * en generación. Devuelve status + progress + metadata mínima.
 *
 * Frontend lo polea cada 5s mientras status no sea terminal
 * ('ready' | 'error').
 *
 * Auth: ninguna. La protección es por UUID del report_id (no enumerable).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ProgressState } from '@/lib/generators/_shared/progress';
import { progressPercent } from '@/lib/generators/_shared/progress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StatusResponse {
  status: string;
  /** 0..100 calculado a partir del jsonb progress; null si no aplicable. */
  percent: number | null;
  /** Estado detallado por sección, si aplica. null si el informe no usa chunked. */
  progress: ProgressState | null;
  generated_at: string | null;
  error_message: string | null;
  /** True si status es terminal ('ready' o 'error'). Cliente puede dejar de polear. */
  terminal: boolean;
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const reportId = url.searchParams.get('report_id');

  if (!reportId) {
    return NextResponse.json({ error: 'missing_report_id' }, { status: 400 });
  }
  if (!UUID_RE.test(reportId)) {
    return NextResponse.json({ error: 'invalid_report_id' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('astrodorado_user_reports')
    .select('status, progress, error_message, generated_at')
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'db_error', detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const status = String(data.status ?? 'unknown');
  const progress = (data.progress ?? null) as ProgressState | null;
  const terminal = status === 'ready' || status === 'error';

  const response: StatusResponse = {
    status,
    percent: progress ? progressPercent(progress) : null,
    progress,
    generated_at: (data.generated_at as string | null) ?? null,
    error_message: (data.error_message as string | null) ?? null,
    terminal,
  };

  return NextResponse.json(response, {
    headers: {
      // No cache para que el polling siempre vea estado fresco.
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
