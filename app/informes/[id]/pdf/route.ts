// ===================================================================
// Ruta: /informes/[id]/pdf
// Documento HTML totalmente estatico, disenado para papel A4.
// NO reutiliza el template interactivo. Es otra cosa: un libro.
// ===================================================================

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function degMin(deg: number): string {
  const i = Math.floor(deg);
  const m = Math.round((deg - i) * 60);
  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);
  return i.toString().padStart(2, '0') + DEG + m.toString().padStart(2, '0') + MIN;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const ZODIAC_NAMES: Record<string, string> = {
  aries: 'Aries', tauro: 'Tauro', geminis: 'Geminis', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', escorpio: 'Escorpio',
  sagitario: 'Sagitario', capricornio: 'Capricornio', acuario: 'Acuario', piscis: 'Piscis',
};

const PLANET_NAMES: Record<string, string> = {
  sun: 'Sol', moon: 'Luna', mercury: 'Mercurio', venus: 'Venus',
  mars: 'Marte', jupiter: 'Jupiter', saturn: 'Saturno', uranus: 'Urano',
  neptune: 'Neptuno', pluto: 'Pluton',
};

const ASPECT_NAMES: Record<string, string> = {
  conjuncion: 'Conjuncion', sextil: 'Sextil', cuadratura: 'Cuadratura',
  trigono: 'Trigono', oposicion: 'Oposicion',
};

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: report } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, status, generated_at, output_html, report_slug')
    .eq('id', id)
    .single();

  if (!report || report.status !== 'ready' || !report.output_html) {
    return NextResponse.json({ error: 'not_ready' }, { status: 404 });
  }

  const { data: chart } = await supabase
    .from('astrodorado_natal_charts')
    .select('sun_sign, sun_degree, moon_sign, moon_degree, rising_sign, rising_degree, dominant_element, planets, houses, aspects')
    .eq('user_id', report.user_id)
    .single();

  const generatedDate = new Date(report.generated_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);

  // Construir tabla de planetas (desde JSONB)
  let planetsTable = '';
  if (chart?.planets && typeof chart.planets === 'object') {
    const rows: string[] = [];
    for (const [key, p] of Object.entries(chart.planets as Record<string, { sign: string; degree: number }>)) {
      const name = PLANET_NAMES[key] || cap(key);
      const sign = ZODIAC_NAMES[p.sign] || cap(p.sign);
      rows.push(`<tr><td class="p-name">${name}</td><td class="p-sign">${sign}</td><td class="p-deg">${degMin(p.degree)}</td></tr>`);
    }
    planetsTable = rows.join('\n');
  }

  // Construir tabla de aspectos
  let aspectsTable = '';
  if (Array.isArray(chart?.aspects)) {
    const sorted = [...chart.aspects].sort((a, b) => a.orb - b.orb).slice(0, 12);
    const rows = sorted.map((a) => {
      const p1 = PLANET_NAMES[a.p1] || cap(a.p1);
      const p2 = PLANET_NAMES[a.p2] || cap(a.p2);
      const type = ASPECT_NAMES[a.type] || cap(a.type);
      return `<tr><td class="a-p1">${p1}</td><td class="a-type">${type}</td><td class="a-p2">${p2}</td><td class="a-orb">${a.orb.toFixed(2)}${DEG}</td></tr>`;
    });
    aspectsTable = rows.join('\n');
  }

  const sunLine = chart ? `${ZODIAC_NAMES[chart.sun_sign] || cap(chart.sun_sign)} ${degMin(chart.sun_degree)}` : '';
  const moonLine = chart ? `${ZODIAC_NAMES[chart.moon_sign] || cap(chart.moon_sign)} ${degMin(chart.moon_degree)}` : '';
  const ascLine = chart ? `${ZODIAC_NAMES[chart.rising_sign] || cap(chart.rising_sign)} ${degMin(chart.rising_degree)}` : '';
  const element = chart?.dominant_element ? cap(chart.dominant_element) : 'Agua';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>AstroDorado - Carta Natal de Sergio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Playfair+Display:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #2a2118;
    --ink-soft: #6b5c43;
    --ink-muted: #8a7a5e;
    --gold: #7a5e0f;
    --gold-light: #9c7e1f;
    --gold-pale: #d4af37;
    --paper: #faf7ed;
    --paper-warm: #f5ecd4;
    --rule: rgba(156, 126, 31, 0.3);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page { size: A4; margin: 22mm 20mm; }
  @page :first { margin: 0; }

  html, body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 11pt;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ============ PORTADA ============ */
  .cover {
    width: 210mm; height: 297mm;
    background: linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%);
    padding: 50mm 30mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    page-break-inside: avoid;
    position: relative;
  }
  .cover::before {
    content: '';
    position: absolute; top: 15mm; left: 50%; transform: translateX(-50%);
    width: 60mm; height: 0.5pt;
    background: var(--gold-light);
  }
  .cover::after {
    content: '';
    position: absolute; bottom: 15mm; left: 50%; transform: translateX(-50%);
    width: 60mm; height: 0.5pt;
    background: var(--gold-light);
  }
  .cover-brand {
    text-align: center;
    font-family: 'Playfair Display', serif;
    color: var(--gold);
    letter-spacing: 8pt;
    font-size: 10pt;
    text-transform: uppercase;
    font-weight: 500;
  }
  .cover-main {
    text-align: center;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .cover-title {
    font-family: 'Playfair Display', serif;
    font-size: 42pt;
    color: var(--gold);
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 8mm;
  }
  .cover-title em {
    font-style: italic;
    font-weight: 400;
    color: var(--gold-light);
    display: block;
    margin: 2mm 0;
  }
  .cover-subtitle {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 14pt;
    color: var(--ink-soft);
    margin-top: 6mm;
  }
  .cover-meta {
    text-align: center;
    margin-top: 20mm;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    color: var(--ink-muted);
    letter-spacing: 2pt;
    line-height: 1.8;
  }
  .cover-meta strong {
    color: var(--gold);
    font-weight: 500;
  }
  .cover-footer {
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    color: var(--ink-muted);
    letter-spacing: 3pt;
    text-transform: uppercase;
  }

  /* ============ BLOQUE DE DATOS NATALES ============ */
  .natal-block {
    margin: 10mm 0 15mm;
    padding: 8mm;
    border-top: 0.5pt solid var(--rule);
    border-bottom: 0.5pt solid var(--rule);
    page-break-inside: avoid;
  }
  .natal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6mm;
  }
  .natal-cell {
    text-align: center;
  }
  .natal-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7pt;
    color: var(--ink-muted);
    letter-spacing: 2pt;
    text-transform: uppercase;
    margin-bottom: 2mm;
  }
  .natal-value {
    font-family: 'Playfair Display', serif;
    font-size: 13pt;
    color: var(--gold);
    font-weight: 500;
    font-style: italic;
  }

  /* ============ TABLAS ============ */
  table.data {
    width: 100%;
    border-collapse: collapse;
    margin: 6mm 0 10mm;
    font-size: 10.5pt;
    page-break-inside: avoid;
  }
  table.data caption {
    font-family: 'Playfair Display', serif;
    font-size: 14pt;
    color: var(--gold);
    text-align: left;
    margin-bottom: 4mm;
    font-weight: 600;
    font-variant: small-caps;
    letter-spacing: 1pt;
  }
  table.data th {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 1.5pt;
    text-transform: uppercase;
    color: var(--ink-muted);
    text-align: left;
    padding: 2mm 3mm;
    border-bottom: 0.5pt solid var(--rule);
    font-weight: 500;
  }
  table.data td {
    padding: 2mm 3mm;
    border-bottom: 0.25pt dotted var(--rule);
  }
  table.data td.p-name, table.data td.a-p1, table.data td.a-p2 {
    font-family: 'Playfair Display', serif;
    font-weight: 500;
    color: var(--gold);
  }
  table.data td.p-sign, table.data td.a-type {
    font-style: italic;
    color: var(--ink-soft);
  }
  table.data td.p-deg, table.data td.a-orb {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9pt;
    text-align: right;
    color: var(--ink);
  }

  /* ============ CONTENIDO DEL INFORME ============ */
  .informe-content {
    margin-top: 10mm;
  }
  .informe-content h1 {
    font-family: 'Playfair Display', serif;
    font-size: 28pt;
    color: var(--gold);
    line-height: 1.15;
    margin: 10mm 0 4mm;
    font-weight: 700;
    page-break-after: avoid;
  }
  .informe-content h2 {
    font-family: 'Playfair Display', serif;
    font-size: 18pt;
    color: var(--gold);
    margin: 14mm 0 4mm;
    font-weight: 500;
    font-variant: small-caps;
    letter-spacing: 1pt;
    padding-bottom: 2mm;
    border-bottom: 0.5pt solid var(--rule);
    page-break-after: avoid;
  }
  .informe-content h3 {
    font-family: 'Playfair Display', serif;
    font-size: 13pt;
    color: var(--gold-light);
    margin: 8mm 0 3mm;
    font-weight: 500;
    font-style: italic;
    page-break-after: avoid;
  }
  .informe-content p {
    margin: 3mm 0;
    text-align: justify;
    hyphens: auto;
    orphans: 3;
    widows: 3;
  }
  .informe-content blockquote {
    margin: 5mm 0 5mm 8mm;
    padding: 3mm 0 3mm 6mm;
    border-left: 2pt solid var(--gold-light);
    font-style: italic;
    color: var(--ink-soft);
    page-break-inside: avoid;
  }
  .informe-content em { color: var(--gold-light); font-style: italic; }
  .informe-content strong { color: var(--ink); font-weight: 600; }
  .informe-content ul, .informe-content ol {
    margin: 3mm 0 3mm 6mm;
    padding-left: 4mm;
  }
  .informe-content li { margin: 1.5mm 0; }

  /* ============ PAGINA DE CIERRE ============ */
  .closing {
    text-align: center;
    margin-top: 25mm;
    padding-top: 15mm;
    border-top: 0.5pt solid var(--rule);
    page-break-inside: avoid;
  }
  .closing .sigil {
    font-family: 'Playfair Display', serif;
    font-size: 20pt;
    color: var(--gold-pale);
    letter-spacing: 8pt;
    margin: 8mm 0;
  }
  .closing p {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    color: var(--ink-soft);
    font-size: 10pt;
    margin: 2mm 0;
  }
  .closing .brand {
    margin-top: 10mm;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7pt;
    letter-spacing: 3pt;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  /* ============ PAGINAS DE CONTENIDO (no portada) ============ */
  .body-pages {
    padding: 0;
  }

  @media screen {
    body { padding: 20mm 0; }
    .cover { margin: 0 auto 10mm; box-shadow: 0 4px 24px rgba(122, 94, 15, 0.15); }
    .body-pages { max-width: 210mm; margin: 0 auto; padding: 22mm 20mm; background: var(--paper); box-shadow: 0 4px 24px rgba(122, 94, 15, 0.15); }
  }
</style>
</head>
<body>

<!-- ======= PORTADA ======= -->
<section class="cover">
  <div class="cover-brand">Astro Dorado &middot; Vol. I &middot; No. 01</div>

  <div class="cover-main">
    <h1 class="cover-title">La cartografia<em>de tu destino</em>ha sido trazada.</h1>
    <p class="cover-subtitle">Un volumen personal para Sergio</p>

    <div class="cover-meta">
      <div><strong>Nacido</strong> &middot; 30 de Junio de 1973</div>
      <div><strong>Hora</strong> &middot; 12:00</div>
      <div><strong>Lugar</strong> &middot; Almeria, Espana</div>
      <div style="margin-top: 6mm">36${DEG}50${MIN}N &middot; 02${DEG}28${MIN}W</div>
    </div>
  </div>

  <div class="cover-footer">Emitido el ${generatedDate}</div>
</section>

<!-- ======= PAGINAS DE CONTENIDO ======= -->
<div class="body-pages">

  <!-- Bloque de datos natales -->
  <div class="natal-block">
    <div class="natal-grid">
      <div class="natal-cell">
        <div class="natal-label">Sol</div>
        <div class="natal-value">${sunLine}</div>
      </div>
      <div class="natal-cell">
        <div class="natal-label">Luna</div>
        <div class="natal-value">${moonLine}</div>
      </div>
      <div class="natal-cell">
        <div class="natal-label">Ascendente</div>
        <div class="natal-value">${ascLine}</div>
      </div>
    </div>
    <div style="text-align: center; margin-top: 5mm; font-family: 'JetBrains Mono', monospace; font-size: 8pt; color: var(--ink-muted); letter-spacing: 2pt; text-transform: uppercase;">
      Elemento dominante &middot; <strong style="color: var(--gold);">${element}</strong>
    </div>
  </div>

  <!-- Tabla de planetas -->
  ${planetsTable ? `
  <table class="data">
    <caption>Configuracion planetaria</caption>
    <thead>
      <tr>
        <th style="width: 35%">Planeta</th>
        <th style="width: 40%">Signo</th>
        <th style="width: 25%; text-align: right;">Grado</th>
      </tr>
    </thead>
    <tbody>
      ${planetsTable}
    </tbody>
  </table>
  ` : ''}

  <!-- Tabla de aspectos -->
  ${aspectsTable ? `
  <table class="data">
    <caption>Aspectos mayores</caption>
    <thead>
      <tr>
        <th style="width: 28%">Planeta</th>
        <th style="width: 28%">Aspecto</th>
        <th style="width: 28%">Planeta</th>
        <th style="width: 16%; text-align: right;">Orbe</th>
      </tr>
    </thead>
    <tbody>
      ${aspectsTable}
    </tbody>
  </table>
  ` : ''}

  <!-- Contenido generado por IA -->
  <div class="informe-content">
    ${report.output_html}
  </div>

  <!-- Cierre -->
  <div class="closing">
    <div class="sigil">&#10070; &#10022; &#10070;</div>
    <p>Este documento fue escrito solo para ti.</p>
    <p>No es una copia de un horoscopo general.<br>
    Es la lectura de tu cielo natal concreto.</p>
    <div class="brand">Astro Dorado &middot; Next Horizont AI</div>
  </div>

</div>

<script>
// Auto-disparar dialogo de impresion cuando fuentes carguen
(function() {
  if (new URL(location.href).searchParams.get('print') === '0') return;
  document.fonts.ready.then(() => {
    setTimeout(() => window.print(), 800);
  });
})();
</script>

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
