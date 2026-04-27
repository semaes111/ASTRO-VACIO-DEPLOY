import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCatalogProduct } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CheckoutBody {
  product_slug: string;
  buyer_email: string;
  data_inputs: Record<string, string | number>;
}

export async function POST(req: Request) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { product_slug, buyer_email, data_inputs } = body;
  if (!product_slug || !buyer_email || !data_inputs) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const product = getCatalogProduct(product_slug);
  if (!product) {
    return NextResponse.json({ error: 'product_not_found' }, { status: 404 });
  }
  // Guard de seguridad: rechazar productos del nuevo patrón sin template ingestado.
  // is_active=false significa que el worker fallaría porque report_templates está vacío
  // para ese slug. Mejor devolver 410 ahora que cobrar y refundear después.
  if (!product.is_active) {
    return NextResponse.json(
      { error: 'product_inactive', detail: 'Este producto aún no está disponible' },
      { status: 410 },
    );
  }

  const supabase = createAdminClient();

  // Buscar o crear user
  let userId: string;
  const { data: existingUser } = await supabase
    .from('astrodorado_users')
    .select('id')
    .eq('email', buyer_email)
    .maybeSingle();

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: newUser, error: ue } = await supabase
      .from('astrodorado_users')
      .insert({
        email: buyer_email,
        birth_date: typeof data_inputs.birth_date === 'string' ? data_inputs.birth_date : null,
        birth_time: typeof data_inputs.birth_time === 'string' ? data_inputs.birth_time : null,
        birth_place: typeof data_inputs.birth_place === 'string' ? data_inputs.birth_place : null,
        subscription_status: 'free',
      })
      .select('id')
      .single();
    if (ue || !newUser) {
      return NextResponse.json({ error: 'user_create_failed', detail: ue?.message }, { status: 500 });
    }
    userId = newUser.id;
  }

  // Crear user_report en pending_payment
  const { data: userReport, error: re } = await supabase
    .from('astrodorado_user_reports')
    .insert({
      user_id: userId,
      report_slug: product.slug,
      product_type: product.product_type,
      status: 'pending_payment',
      input_data: data_inputs,
      amount_paid_eur: product.price_eur,
    })
    .select('id')
    .single();

  if (re || !userReport) {
    return NextResponse.json({ error: 'user_report_create_failed', detail: re?.message }, { status: 500 });
  }

  // Crear Stripe Checkout Session
  // Nota: en produccion usar stripe_price_id de BD. Aqui usamos price_data dinamico.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://astrodorado-app.vercel.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name_es,
            description: product.tagline,
          },
          unit_amount: Math.round(product.price_eur * 100),
        },
        quantity: 1,
      }],
      customer_email: buyer_email,
      locale: 'es',
      metadata: {
        user_report_id: userReport.id,
        product_slug: product.slug,
        product_type: product.product_type,
        user_id: userId,
      },
      success_url: `${appUrl}/comprando/exito?session_id={CHECKOUT_SESSION_ID}&report_id=${userReport.id}`,
      cancel_url: `${appUrl}/informes/${product.product_type}/nuevo?cancelled=1`,
    });

    await supabase
      .from('astrodorado_user_reports')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', userReport.id);

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
      user_report_id: userReport.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'stripe_error';
    return NextResponse.json({ error: 'stripe_checkout_failed', detail: msg }, { status: 500 });
  }
}
