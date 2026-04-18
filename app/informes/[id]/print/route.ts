import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function degreeToMinutes(deg: number): string {
  const intDeg = Math.floor(deg);
  const minutes = Math.round((deg - intDeg) * 60);
  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);
  return `${intDeg.toString().padStart(2, '0')}${DEG}${minutes.toString().padStart(2, '0')}${MIN}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(req.url);
  const autoPrint = url.searchParams.get('print') !== '0';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: report } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, status, generated_at, output_html')
    .eq('id', id)
    .single();

  if (!report || report.status !== 'ready') {
    return NextResponse.json({ error: 'not_ready' }, { status: 404 });
  }

  const { data: chart } = await supabase
    .from('astrodorado_natal_charts')
    .select('sun_sign, sun_degree, moon_sign, moon_degree, rising_sign, rising_degree, dominant_element')
    .eq('user_id', report.user_id)
    .single();

  const templatePath = path.join(process.cwd(), 'public', 'informe-template-premium.html');
  let template: string;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'template_missing' }, { status: 500 });
  }

  if (chart) {
    const DOT = String.fromCharCode(183);
    const DEG = String.fromCharCode(176);
    const MIN = String.fromCharCode(8242);
    const dataBlock = {
      clientSalute: 'Apreciado Sergio',
      issuedAt: new Date(report.generated_at).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric',
      }),
      issuedCode: `AD${DOT}${new Date(report.generated_at).toISOString().slice(0, 10).replace(/-/g, DOT)} / Vol. I ${DOT} No. 01`,
      delivery: 'Edicion personal - intransferible',
      birthDate: '30 de Junio de 1973',
      birthTime: '12:00',
      birthPlace: 'Almeria, Espana',
      latitude: `36${DEG}50${MIN}N`,
      longitude: `02${DEG}28${MIN}W`,
      sun: `${cap(chart.sun_sign)} ${DOT} ${degreeToMinutes(chart.sun_degree)}`,
      moon: `${cap(chart.moon_sign)} ${DOT} ${degreeToMinutes(chart.moon_degree)}`,
      ascendant: `${cap(chart.rising_sign)} ${DOT} ${degreeToMinutes(chart.rising_degree)}`,
      midheaven: `Sagitario ${DOT} -`,
      element: `${chart.dominant_element ? cap(chart.dominant_element) : 'Agua'} / Cardinal`,
      modality: 'Receptivo emocional',
      lifePath: '8',
      soulNumber: '6',
      destinyNumber: '1',
      expressionNumber: '7',
      birthYearVibration: '2',
    };
    template = template.replace(
      /window\.REPORT = \{[\s\S]*?\};/,
      `window.REPORT = ${JSON.stringify(dataBlock, null, 2)};`
    );
  }

  if (autoPrint) {
    const autoPrintScript = `
<script>
(function(){
  let printed = false;
  function tryPrint() {
    if (printed) return;
    const main = document.getElementById('app');
    if (!main || main.children.length < 3) {
      setTimeout(tryPrint, 200);
      return;
    }
    printed = true;
    setTimeout(function() {
      try { window.print(); } catch(e) { console.error('print failed', e); }
    }, 1500);
  }
  if (document.readyState === 'complete') tryPrint();
  else window.addEventListener('load', tryPrint);
})();
</script>
</body>`;
    template = template.replace('</body>', autoPrintScript);
  }

  return new NextResponse(template, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=0',
    },
  });
}
