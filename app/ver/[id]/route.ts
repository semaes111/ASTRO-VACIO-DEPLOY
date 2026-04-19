// =====================================================
// /ver/[id] - Route Handler (NO Server Component)
// Funciona porque /informes/[id]/pdf/route.ts funciona
// con el mismo patron. El problema estaba en page.tsx.
// =====================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] || c));
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #050510;
    color: #f0e5cc;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    line-height: 1.8;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 780px; margin: 0 auto; padding: 32px 24px 96px; }
  header {
    padding-bottom: 20px;
    margin-bottom: 40px;
    border-bottom: 1px solid rgba(212,175,55,0.2);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 12px;
  }
  .eyebrow {
    font-size: 11px;
    color: rgba(240,229,204,0.45);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  h1.title {
    font-size: 26px;
    color: #f0ce5a;
    margin: 4px 0 0;
    font-weight: 600;
  }
  .fecha {
    font-size: 11px;
    color: rgba(240,229,204,0.45);
    font-family: ui-monospace, monospace;
    letter-spacing: 0.1em;
  }
  main h1, main h2 { color: #f0ce5a; font-family: Georgia, serif; margin: 48px 0 16px; font-weight: 600; line-height: 1.3; }
  main h1 { font-size: 26px; }
  main h2 { font-size: 22px; border-bottom: 1px solid rgba(212,175,55,0.15); padding-bottom: 8px; }
  main h3 { color: #d4af37; font-family: Georgia, serif; font-size: 18px; margin: 32px 0 12px; }
  main h4 { color: #d4af37; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin: 24px 0 10px; }
  main p { margin: 0 0 18px; color: rgba(240,229,204,0.88); }
  main strong { color: #f0ce5a; font-weight: 600; }
  main em { color: rgba(240,206,90,0.9); font-style: italic; }
  main blockquote { border-left: 2px solid #d4af37; padding: 4px 0 4px 20px; margin: 28px 0; font-style: italic; color: rgba(240,229,204,0.75); }
  main ul, main ol { margin: 16px 0 24px; padding-left: 24px; color: rgba(240,229,204,0.88); }
  main li { margin-bottom: 6px; line-height: 1.7; }
  main table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; background: rgba(212,175,55,0.03); border: 1px solid rgba(212,175,55,0.15); }
  main th { background: rgba(212,175,55,0.1); color: #f0ce5a; padding: 10px 14px; text-align: left; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(212,175,55,0.25); }
  main td { padding: 10px 14px; border-bottom: 1px solid rgba(212,175,55,0.08); color: rgba(240,229,204,0.82); }
  main hr { border: none; height: 1px; background: linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent); margin: 40px 0; }
  footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid rgba(212,175,55,0.15);
    text-align: center;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: rgba(240,229,204,0.4);
    letter-spacing: 0.1em;
  }
  .estado-box {
    max-width: 520px;
    margin: 80px auto;
    text-align: center;
  }
  .estado-box h1 {
    font-family: Georgia, serif;
    font-size: 28px;
    color: #f0ce5a;
    margin-bottom: 24px;
  }
  .estado-box p {
    font-size: 16px;
    line-height: 1.7;
    color: rgba(240,229,204,0.8);
  }
  .estado-box .small {
    font-size: 13px;
    color: rgba(240,229,204,0.5);
    margin-top: 16px;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  // Validar UUID
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    const body = `<div class="container"><div class="estado-box">
      <h1>Identificador invalido</h1>
      <p>El ID proporcionado no tiene formato UUID valido.</p>
    </div></div>`;
    return new NextResponse(page('ID invalido | AstroDorado', body), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const body = `<div class="container"><div class="estado-box">
      <h1 style="color:#ff6b6b">Error de configuracion</h1>
      <p>Variables de entorno Supabase no disponibles.</p>
    </div></div>`;
    return new NextResponse(page('Error | AstroDorado', body), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: report, error } = await supabase
    .from('astrodorado_user_reports')
    .select('id, status, output_html, report_slug, generated_at, error_message')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const body = `<div class="container"><div class="estado-box">
      <h1 style="color:#ff6b6b">Error al consultar el informe</h1>
      <pre style="background:rgba(255,0,0,0.08);padding:16px;border-radius:4px;font-size:12px;text-align:left;white-space:pre-wrap">${escapeHtml(error.message)}</pre>
    </div></div>`;
    return new NextResponse(page('Error | AstroDorado', body), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (!report) {
    const body = `<div class="container"><div class="estado-box">
      <h1>Informe no encontrado</h1>
      <p>No existe ningun informe con ID ${escapeHtml(id.slice(0, 8))}...</p>
    </div></div>`;
    return new NextResponse(page('No encontrado | AstroDorado', body), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Estados previos a ready
  if (report.status !== 'ready' || !report.output_html) {
    const mensaje =
      report.status === 'generating' ? 'Tu informe se esta generando. Tarda entre 3 y 6 minutos.' :
      report.status === 'paid' ? 'Pago confirmado. El informe comenzara a generarse en breve.' :
      report.status === 'pending_payment' ? 'Pendiente de pago.' :
      report.status === 'error' ? 'Ha habido un problema generando tu informe.' :
      'Estado actual: ' + report.status;

    const errBlock = report.error_message
      ? `<pre style="background:rgba(255,0,0,0.08);padding:16px;border-radius:4px;font-size:12px;text-align:left;white-space:pre-wrap;margin-top:24px">${escapeHtml(report.error_message)}</pre>`
      : '';

    const reloadHint = report.status === 'generating'
      ? '<p class="small">Recarga esta pagina en unos minutos.</p>'
      : '';

    const body = `<div class="container"><div class="estado-box">
      <h1>AstroDorado</h1>
      <p>${escapeHtml(mensaje)}</p>
      ${reloadHint}
      ${errBlock}
    </div></div>`;

    return new NextResponse(page('Tu informe | AstroDorado', body), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  }

  // READY: renderizar output_html
  const productName = report.report_slug === 'ayurveda' ? 'Carta Ayurvedica' : 'Informe';
  const fecha = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const body = `<div class="container">
  <header>
    <div>
      <div class="eyebrow">Astro Dorado</div>
      <h1 class="title">${escapeHtml(productName)}</h1>
    </div>
    ${fecha ? `<div class="fecha">${escapeHtml(fecha.toUpperCase())}</div>` : ''}
  </header>

  <main>
${report.output_html}
  </main>

  <footer>
    <div>N${String.fromCharCode(186)} ${escapeHtml(id.slice(0, 8).toUpperCase())}</div>
    <div style="margin-top:6px">AstroDorado ${String.fromCharCode(183)} NextHorizont AI</div>
  </footer>
</div>`;

  return new NextResponse(page(productName + ' | AstroDorado', body), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}