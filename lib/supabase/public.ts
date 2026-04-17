import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase público — usa solo anon key, NO cookies, NO sesión.
 *
 * Úsalo para queries de datos públicos en cualquier contexto:
 *   - Server Components
 *   - Route Handlers
 *   - generateStaticParams (build-time)
 *   - generateMetadata
 *   - Middleware
 *
 * Regla: si la query no depende de la sesión del usuario, usa este cliente.
 * Si depende de sesión (Auth, datos de usuario autenticado), usa server.ts.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
