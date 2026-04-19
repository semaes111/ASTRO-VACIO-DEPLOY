import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAyurveda } from '@/lib/generators/ayurveda/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type Ctx = { params: Promise<{ productType: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const secretHeader = req.headers.get('x-internal-secret');
  if (secretHeader !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { productType } = await params;
  const body = await req.json();
  const { user_report_id } = body as { user_report_id?: string };

  if (!user_report_id) {
    return NextResponse.json({ error: 'missing_user_report_id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Marcar generating
  await supabase
    .from('astrodorado_user_reports')
    .update({
      status: 'generating',
      generation_started_at: new Date().toISOString(),
    })
    .eq('id', user_report_id);

  try {
    // Dispatch por productType (que es report_slug)
    switch (productType) {
      case 'ayurveda': {
        const result = await generateAyurveda(user_report_id);
        return NextResponse.json({
          status: 'ok',
          user_report_id,
          product_type: productType,
          tokens_used: result.tokens_used,
          cost_usd: Number(result.cost_usd.toFixed(6)),
          duration_ms: result.duration_ms,
          model_used: result.model_used,
          word_count: result.word_count,
        });
      }
      default: {
        // Stub temporal para productos sin generador aún
        const stubContent = `<div style="padding: 40px; text-align: center;">
          <h2>Tu informe de ${productType} se generara pronto</h2>
          <p>Los generadores de tipos distintos a ayurveda estan en desarrollo activo.</p>
          <p>Tu pago esta registrado y recibiras el informe por email cuando este listo.</p>
        </div>`;

        await supabase
          .from('astrodorado_user_reports')
          .update({
            status: 'ready',
            output_html: stubContent,
            tokens_used: 0,
            generated_at: new Date().toISOString(),
            model_used: 'stub-v1',
          })
          .eq('id', user_report_id);

        return NextResponse.json({ status: 'ok', user_report_id, product_type: productType, stub: true });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error(`[generate/${productType}] error:`, err);
    await supabase
      .from('astrodorado_user_reports')
      .update({
        status: 'error',
        error_message: msg,
        error_count: 1,
      })
      .eq('id', user_report_id);
    return NextResponse.json({ error: 'generation_failed', detail: msg }, { status: 500 });
  }
}
