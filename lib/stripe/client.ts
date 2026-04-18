import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set - Stripe calls will fail');
}

// Sin apiVersion hardcoded: el SDK usa su default (compatible con la version
// instalada). Esto evita errores TS cuando Stripe actualiza su API.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  typescript: true,
});
