import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'no_signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid';
    return NextResponse.json({ error: 'invalid_signature', detail: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Audit log idempotente
  const { error: ae } = await supabase
    .from('astrodorado_payment_events')
    .insert({
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      payload: JSON.parse(JSON.stringify(event.data.object)),
      processed_at: new Date().toISOString(),
    });

  if (ae?.code === '23505') {
    return NextResponse.json({ status: 'already_processed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userReportId = session.metadata?.user_report_id;
    const productType = session.metadata?.product_type;

    if (!userReportId) {
      return NextResponse.json({ error: 'missing_metadata' }, { status: 400 });
    }

    await supabase
      .from('astrodorado_user_reports')
      .update({
        status: 'paid',
        stripe_payment_intent_id: session.payment_intent as string,
        amount_paid_eur: (session.amount_total || 0) / 100,
        purchased_at: new Date().toISOString(),
      })
      .eq('id', userReportId);

    // Disparar generacion async (no bloqueante)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://astrodorado-app.vercel.app';
    fetch(`${appUrl}/api/generate/${productType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ user_report_id: userReportId }),
    }).catch((e) => console.error('generation_trigger_failed', e));
  }

  return NextResponse.json({ status: 'ok' });
}
