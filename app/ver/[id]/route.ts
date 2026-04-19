// =====================================================
// /ver/[id] - Route Handler visual premium
// Hero + prose + footer con template AstroDorado
// =====================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

interface ReportMeta {
  name_es: string | null;
  tagline: string | null;
  hero_icon: string | null;
  category: string | null;
}

interface UserReport {
  id: string;
  status: string;
  output_html: string | null;
  report_slug: string | null;
  generated_at: string | null;
  input_data: Record<string, unknown> | null;
  error_message: string | null;
  astrodorado_reports: ReportMeta | ReportMeta[] | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}

const INFORME_CSS = `
:root {
  --bg-deep: #050510;
  --bg-card: #0b0b1a;
  --bg-card-elev: #12121f;
  --gold-100: #f0ce5a;
  --gold-200: #d4af37;
  --gold-300: #a8862a;
  --gold-glow: rgba(212, 175, 55, 0.15);
  --cream-100: #f0e5cc;
  --cream-80: rgba(240, 229, 204, 0.88);
  --cream-60: rgba(240, 229, 204, 0.65);
  --cream-40: rgba(240, 229, 204, 0.45);
  --cream-25: rgba(240, 229, 204, 0.25);
  --divider: rgba(212, 175, 55, 0.15);
  --divider-strong: rgba(212, 175, 55, 0.3);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg-deep);
  color: var(--cream-80);
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
  position: relative;
  min-height: 100vh;
}
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1px 1px at 20% 30%, rgba(240,206,90,0.4), transparent 50%),
    radial-gradient(1px 1px at 40% 70%, rgba(240,206,90,0.3), transparent 50%),
    radial-gradient(1.5px 1.5px at 70% 20%, rgba(240,206,90,0.25), transparent 50%),
    radial-gradient(1px 1px at 85% 55%, rgba(240,206,90,0.35), transparent 50%),
    radial-gradient(1px 1px at 15% 85%, rgba(240,206,90,0.3), transparent 50%),
    radial-gradient(2px 2px at 55% 40%, rgba(240,206,90,0.2), transparent 50%);
  pointer-events: none;
  z-index: 0;
}
body::after {
  content: '';
  position: fixed;
  top: -20%;
  left: -20%;
  width: 140%;
  height: 140%;
  background: radial-gradient(ellipse at center, rgba(212, 175, 55, 0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
.page { position: relative; z-index: 1; }

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  border-bottom: 1px solid var(--divider);
  position: relative;
}
.hero-seal {
  width: 120px;
  height: 120px;
  margin-bottom: 32px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-seal::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid var(--gold-200);
  border-radius: 50%;
  animation: rotate 120s linear infinite;
}
.hero-seal::after {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid var(--gold-300);
  border-radius: 50%;
  opacity: 0.5;
}
.hero-seal-glyph {
  font-family: 'Cinzel', serif;
  font-size: 52px;
  color: var(--gold-100);
  text-shadow: 0 0 24px var(--gold-glow);
  position: relative;
  z-index: 1;
}
@keyframes rotate { to { transform: rotate(360deg); } }
.hero-eyebrow {
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--cream-40);
  margin-bottom: 20px;
}
.hero-title {
  font-family: 'Cinzel', serif;
  font-size: clamp(42px, 6vw, 72px);
  font-weight: 500;
  color: var(--gold-100);
  letter-spacing: 0.04em;
  line-height: 1.1;
  margin: 0 0 16px;
  text-shadow: 0 0 40px rgba(240, 206, 90, 0.15);
}
.hero-subtitle {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: clamp(18px, 2.5vw, 24px);
  color: var(--cream-60);
  max-width: 640px;
  margin: 0 auto 32px;
  line-height: 1.5;
}
.hero-divider {
  width: 80px;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--gold-200), transparent);
  margin: 32px auto;
}
.hero-nativity {
  font-family: 'Cinzel', serif;
  font-size: 20px;
  color: var(--cream-80);
  letter-spacing: 0.08em;
  margin: 0 0 8px;
}
.hero-birth {
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 13px;
  color: var(--cream-40);
  letter-spacing: 0.15em;
}
.hero-scroll-hint {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.3em;
  color: var(--cream-40);
  text-transform: uppercase;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: translateX(-50%) translateY(0); }
  50% { opacity: 1; transform: translateX(-50%) translateY(4px); }
}

.container {
  max-width: 780px;
  margin: 0 auto;
  padding: 80px 24px;
}

.section, .prose > section {
  margin-bottom: 96px;
  position: relative;
  display: block;
}
.section-number {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--gold-200);
  text-transform: uppercase;
  margin-bottom: 12px;
  display: block;
}
.section-title {
  font-family: 'Cinzel', serif;
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 500;
  color: var(--gold-100);
  letter-spacing: 0.02em;
  line-height: 1.25;
  margin: 0 0 24px;
}
.section-intro {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 22px;
  line-height: 1.6;
  color: var(--cream-60);
  margin: 0 0 40px;
  padding-left: 16px;
  border-left: 2px solid var(--gold-300);
}

.prose p {
  margin: 0 0 24px;
  font-size: 18px;
  line-height: 1.85;
  color: var(--cream-80);
}
.prose section > p:first-of-type:first-letter,
.prose > p:first-of-type:first-letter {
  font-family: 'Cinzel', serif;
  font-size: 3em;
  float: left;
  line-height: 0.9;
  margin: 4px 8px 0 0;
  color: var(--gold-100);
  font-weight: 600;
}
.prose h1 {
  font-family: 'Cinzel', serif;
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 500;
  color: var(--gold-100);
  letter-spacing: 0.02em;
  line-height: 1.25;
  margin: 48px 0 24px;
}
.prose h2 {
  font-family: 'Cinzel', serif;
  font-size: clamp(24px, 3.5vw, 32px);
  font-weight: 500;
  color: var(--gold-100);
  letter-spacing: 0.02em;
  line-height: 1.3;
  margin: 56px 0 20px;
  border-bottom: 1px solid var(--divider);
  padding-bottom: 12px;
}
.prose h3 {
  font-family: 'Cinzel', serif;
  font-size: 22px;
  font-weight: 500;
  color: var(--gold-200);
  letter-spacing: 0.03em;
  margin: 48px 0 16px;
}
.prose h4 {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--gold-200);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin: 32px 0 12px;
}
.prose strong { color: var(--gold-100); font-weight: 600; }
.prose em { color: var(--cream-100); font-style: italic; }

.prose blockquote {
  margin: 40px 0;
  padding: 24px 32px;
  background: var(--bg-card);
  border-left: 3px solid var(--gold-200);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  font-size: 19px;
  color: var(--cream-100);
  line-height: 1.6;
  position: relative;
}
.prose blockquote::before {
  content: '\\201C';
  position: absolute;
  top: -8px;
  left: 12px;
  font-family: 'Cinzel', serif;
  font-size: 48px;
  color: var(--gold-200);
  opacity: 0.3;
}
.prose blockquote p { margin: 0; color: inherit; }
.prose blockquote p:first-letter { float: none; font-size: inherit; color: inherit; margin: 0; font-family: inherit; }

.prose ul, .prose ol { margin: 20px 0; padding-left: 24px; }
.prose li { margin-bottom: 8px; line-height: 1.7; color: var(--cream-80); }
.prose ul li::marker { color: var(--gold-200); }

.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 32px 0;
  background: var(--bg-card);
  border: 1px solid var(--divider);
  border-radius: 6px;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
}
.prose th {
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05));
  color: var(--gold-100);
  font-family: 'Cinzel', serif;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid var(--divider-strong);
}
.prose td {
  padding: 12px 18px;
  border-bottom: 1px solid var(--divider);
  color: var(--cream-80);
}
.prose tbody tr:last-child td { border-bottom: none; }
.prose tbody tr:hover { background: rgba(212, 175, 55, 0.03); }

.keyvalue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin: 40px 0;
}
.kv-card {
  background: var(--bg-card);
  border: 1px solid var(--divider);
  padding: 20px;
  border-radius: 6px;
  text-align: center;
  transition: border-color 0.3s, transform 0.3s;
}
.kv-card:hover {
  border-color: var(--gold-200);
  transform: translateY(-2px);
}
.kv-label {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--cream-40);
  margin-bottom: 8px;
}
.kv-value {
  font-family: 'Cinzel', serif;
  font-size: 24px;
  color: var(--gold-100);
  font-weight: 500;
  margin-bottom: 4px;
}
.kv-detail { font-size: 13px; color: var(--cream-60); font-style: italic; }

.callout {
  margin: 40px 0;
  padding: 24px 28px;
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(212, 175, 55, 0.02));
  border: 1px solid var(--divider);
  border-radius: 8px;
  position: relative;
}
.callout-icon {
  position: absolute;
  top: -14px;
  left: 24px;
  background: var(--bg-deep);
  padding: 0 12px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--gold-200);
  text-transform: uppercase;
}
.callout p { margin: 0; color: var(--cream-80); }
.callout p:first-letter { float: none; font-size: inherit; color: inherit; margin: 0; font-family: inherit; }

.ornament {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 64px 0;
}
.ornament-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--divider-strong), transparent);
}
.ornament-glyph {
  color: var(--gold-200);
  font-family: 'Cinzel', serif;
  font-size: 20px;
}

.footer {
  max-width: 780px;
  margin: 0 auto;
  padding: 48px 24px 80px;
  border-top: 1px solid var(--divider);
  text-align: center;
}
.footer-glyph {
  font-family: 'Cinzel', serif;
  font-size: 24px;
  color: var(--gold-200);
  margin-bottom: 16px;
}
.footer-meta {
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--cream-40);
  text-transform: uppercase;
  margin: 4px 0;
}
.footer-copy {
  font-size: 13px;
  color: var(--cream-60);
  font-style: italic;
  margin-top: 16px;
}

.estado-box {
  max-width: 520px;
  margin: 80px auto;
  padding: 0 24px;
  text-align: center;
}
.estado-box h1 {
  font-family: 'Cinzel', serif;
  font-size: 32px;
  color: var(--gold-100);
  margin-bottom: 24px;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.estado-box p {
  font-size: 17px;
  line-height: 1.7;
  color: var(--cream-80);
  font-family: 'Cormorant Garamond', serif;
}
.estado-box .small {
  font-size: 13px;
  color: var(--cream-40);
  margin-top: 16px;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.1em;
}

@media (max-width: 640px) {
  body { font-size: 17px; }
  .container { padding: 48px 20px; }
  .section, .prose > section { margin-bottom: 72px; }
  .prose p { font-size: 17px; }
  .prose section > p:first-of-type:first-letter { font-size: 2.4em; }
  .prose blockquote { padding: 20px 24px; font-size: 17px; }
  .keyvalue-grid { grid-template-columns: repeat(2, 1fr); }
  .kv-value { font-size: 20px; }
}
@media print {
  body { background: white; color: #222; }
  body::before, body::after { display: none; }
  .hero { min-height: auto; page-break-after: always; }
  .section { page-break-inside: avoid; }
  .hero-scroll-hint { display: none; }
  .hero-title, .section-title, .prose h1, .prose h2 { color: #8a6d1c; }
  .prose strong, .kv-value, .section-number { color: #8a6d1c; }
}
`;

const FONTS_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">`;

function formatBirthLine(input: Record<string, unknown> | null): string {
  if (!input) return '';
  const fecha = typeof input.fecha_nacimiento === 'string' ? input.fecha_nacimiento : null;
  const hora = typeof input.hora_nacimiento === 'string' ? input.hora_nacimiento : null;
  const lugar = typeof input.lugar_nacimiento === 'string' ? input.lugar_nacimiento : null;

  const parts: string[] = [];
  if (fecha) {
    try {
      const d = new Date(fecha);
      if (!isNaN(d.getTime())) {
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        parts.push(`${String(d.getDate()).padStart(2, '0')}.${months[d.getMonth()]}.${d.getFullYear()}`);
      } else {
        parts.push(fecha);
      }
    } catch {
      parts.push(fecha);
    }
  }
  if (hora) parts.push(hora.slice(0, 5));
  if (lugar) parts.push(lugar.toUpperCase());
  return parts.join(' \u00B7 ');
}

function firstName(input: Record<string, unknown> | null, fallback = 'Tu informe'): string {
  if (!input) return fallback;
  const nombre = typeof input.nombre === 'string' ? input.nombre : null;
  const fullName = typeof input.full_name === 'string' ? input.full_name : null;
  return (nombre || fullName || fallback).toUpperCase();
}

function renderStatusPage(title: string, body: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
${FONTS_LINKS}
<style>${INFORME_CSS}</style>
</head>
<body>
<div class="page">
<div class="estado-box">
${body}
</div>
</div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return renderStatusPage(
      'ID invalido | AstroDorado',
      `<h1>Identificador invalido</h1><p>El ID proporcionado no tiene formato UUID valido.</p>`,
      400
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return renderStatusPage(
      'Error | AstroDorado',
      `<h1 style="color:#ff6b6b">Error de configuracion</h1><p>Variables de entorno Supabase no disponibles.</p>`,
      500
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('astrodorado_user_reports')
    .select(`
      id, status, output_html, report_slug, generated_at,
      input_data, error_message,
      astrodorado_reports!inner(name_es, tagline, hero_icon, category)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return renderStatusPage(
      'Error | AstroDorado',
      `<h1 style="color:#ff6b6b">Error al consultar el informe</h1><p style="font-family:ui-monospace,monospace;font-size:13px;background:rgba(255,0,0,0.08);padding:12px;border-radius:4px;white-space:pre-wrap">${escapeHtml(error.message)}</p>`,
      500
    );
  }

  const report = data as UserReport | null;

  if (!report) {
    return renderStatusPage(
      'No encontrado | AstroDorado',
      `<h1>Informe no encontrado</h1><p>No existe ningun informe con ID ${escapeHtml(id.slice(0, 8))}&hellip;</p>`,
      404
    );
  }

  const metaRaw = report.astrodorado_reports;
  const meta: ReportMeta = Array.isArray(metaRaw)
    ? (metaRaw[0] ?? { name_es: null, tagline: null, hero_icon: null, category: null })
    : (metaRaw ?? { name_es: null, tagline: null, hero_icon: null, category: null });

  // Estados previos a ready
  if (report.status !== 'ready' || !report.output_html) {
    const mensaje =
      report.status === 'generating'
        ? 'Tu informe se esta generando. Suele tardar entre 3 y 6 minutos.'
        : report.status === 'paid'
        ? 'Pago confirmado. El informe comenzara a generarse en breve.'
        : report.status === 'pending_payment'
        ? 'Pendiente de confirmacion de pago.'
        : report.status === 'error'
        ? 'Ha habido un problema generando tu informe.'
        : 'Estado actual: ' + report.status;

    const errBlock = report.error_message
      ? `<p class="small" style="color:#ff9999;background:rgba(255,0,0,0.08);padding:12px;border-radius:4px;font-family:ui-monospace,monospace;text-align:left;white-space:pre-wrap;margin-top:24px">${escapeHtml(report.error_message)}</p>`
      : '';
    const reloadHint = report.status === 'generating'
      ? `<p class="small">Recarga esta pagina en unos minutos.</p>`
      : '';

    return renderStatusPage(
      (meta.name_es || 'Tu informe') + ' | AstroDorado',
      `<h1>${escapeHtml(meta.name_es || 'AstroDorado')}</h1><p>${escapeHtml(mensaje)}</p>${reloadHint}${errBlock}`,
      200
    );
  }

  // READY: renderizado completo
  const productName = meta.name_es || (report.report_slug === 'ayurveda' ? 'Carta Ayurv\u00E9dica' : 'Tu informe');
  const tagline = meta.tagline || '';
  const heroIcon = meta.hero_icon || '\u2756';
  const category = (meta.category || 'informe').toString();

  const fechaGeneracion = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const userName = firstName(report.input_data);
  const birthLine = formatBirthLine(report.input_data);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(productName)} | AstroDorado</title>
${FONTS_LINKS}
<style>${INFORME_CSS}</style>
</head>
<body>
<div class="page">

  <section class="hero">
    <div class="hero-seal">
      <span class="hero-seal-glyph">${escapeHtml(heroIcon)}</span>
    </div>
    <div class="hero-eyebrow">Astro Dorado \u00B7 ${escapeHtml(category)}</div>
    <h1 class="hero-title">${escapeHtml(productName)}</h1>
    ${tagline ? `<p class="hero-subtitle">${escapeHtml(tagline)}</p>` : ''}
    <div class="hero-divider"></div>
    ${userName ? `<p class="hero-nativity">${escapeHtml(userName)}</p>` : ''}
    ${birthLine ? `<p class="hero-birth">${escapeHtml(birthLine)}</p>` : ''}
    <div class="hero-scroll-hint">\u2193 &nbsp; Desplazate para leer tu informe</div>
  </section>

  <div class="container">
    <main class="prose">
${report.output_html}
    </main>
  </div>

  <footer class="footer">
    <div class="footer-glyph">\u2756</div>
    <div class="footer-meta">Informe N\u00BA ${escapeHtml(id.slice(0, 8).toUpperCase())}</div>
    ${fechaGeneracion ? `<div class="footer-meta">Generado el ${escapeHtml(fechaGeneracion)}</div>` : ''}
    <p class="footer-copy">
      Astro Dorado \u00B7 NextHorizont AI<br>
      Esta lectura es una guia simbolica, no un sustituto del consejo profesional.
    </p>
  </footer>

</div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
