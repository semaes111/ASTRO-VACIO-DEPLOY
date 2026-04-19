import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware que refresca el token de Supabase en cada request.
 * Ref: https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * IMPORTANTE: /informes/* y /api/* se EXCLUYEN en el matcher para evitar
 * que el auth.getUser() bloquee paginas publicas que no requieren sesion.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si expiró (no bloquea si no hay sesión)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protección de rutas VIP — redirect a login si no hay sesión
  const { pathname } = request.nextUrl;
  const isVipRoute = pathname.startsWith('/vip') || pathname.startsWith('/admin');

  if (isVipRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Excluimos:
     * - _next/static, _next/image (assets)
     * - favicon, imagenes publicas
     * - /informes/* (paginas publicas de resultado - no requieren auth)
     * - /api/* (API routes se gestionan su propia auth)
     * - /catalogo (publico)
     * - / (homepage publica)
     */
    '/((?!_next/static|_next/image|favicon.ico|informes|ver|api|catalogo|$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};