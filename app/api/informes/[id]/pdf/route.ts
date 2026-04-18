// ═══════════════════════════════════════════════════════════════════
// API: POST /api/informes/[id]/pdf
// Genera PDF del informe usando @sparticuz/chromium + puppeteer-core
// (la unica combinacion que funciona en Vercel serverless por el limite 50MB)
// ═══════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;

  // 1) Leer informe
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: userReport } = await supabase
    .schema('astrodorado')
    .from('user_reports')
    .select('id, output_html, status, report:reports(name_es)')
    .eq('id', id)
    .single();

  if (!userReport || userReport.status !== 'ready' || !userReport.output_html) {
    return NextResponse.json({ error: 'Informe no disponible' }, { status: 404 });
  }

  // 2) Lazy-import (evita incluir chromium en el bundle si no se usa)
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = await import('puppeteer-core');

  // 3) Launch browser (Vercel-compatible)
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Envolver el HTML con CSS print-friendly
    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;700&family=EB+Garamond:ital,wght@0,400;500,600;1,400&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'EB Garamond', Georgia, serif; font-size: 11pt; line-height: 1.6;
         color: #2a2118; background: #faf8f3; margin: 0; padding: 0; }
  h1, h2, h3 { font-family: 'Cinzel', Georgia, serif; }
  h2 { color: #a67c2e; letter-spacing: 1px; font-size: 16pt; page-break-after: avoid;
       border-bottom: 1px solid rgba(212, 168, 83, 0.4); padding-bottom: 6px; margin-top: 24pt; }
  h3 { color: #a67c2e; font-style: italic; font-weight: 500; page-break-after: avoid; }
  p { margin: 10pt 0; text-align: justify; }
  blockquote { border-left: 3px solid #d4a853; padding: 8pt 16pt; background: rgba(212, 168, 83, 0.06);
               font-style: italic; color: #6b5c43; margin: 14pt 0; }
  em { color: #a67c2e; }
  strong { color: #2a2118; }
  .cover { text-align: center; page-break-after: always; padding-top: 60mm; }
  .cover h1 { font-size: 34pt; color: #a67c2e; letter-spacing: 6pt; margin-bottom: 10pt; }
  .cover .sub { color: #8a7258; font-size: 10pt; letter-spacing: 3pt; text-transform: uppercase; }
</style>
</head>
<body>
<div class="cover">
  <h1>ASTRODORADO</h1>
  <div class="sub">Carta Natal Completa</div>
  <div style="margin-top:40mm;font-style:italic;color:#6b5c43;font-size:13pt;">
    Sergio<br>30 de junio de 1973<br>Almería, España
  </div>
</div>
${userReport.output_html}
</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
    await browser.close();

    const reportName = (userReport as any).report?.name_es || 'informe';
    const filename = `astrodorado-${reportName.toLowerCase().replace(/\s+/g, '-')}-${id.slice(0, 8)}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    await browser.close();
    console.error('PDF gen error:', e);
    return NextResponse.json({ error: 'Error generando PDF', detail: String(e) }, { status: 500 });
  }
}
