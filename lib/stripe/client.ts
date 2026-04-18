import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe calls will fail');
}

// apiVersion as any: Stripe SDK bumps apiVersion periodically; hardcoding
// specific version breaks on SDK upgrade. We let Stripe default to its
// latest supported while explicitly typing for TS.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-03-25.dahlia' as Stripe.StripeConfig['apiVersion'],
  typescript: true,
});
