// ═══════════════════════════════════════════════════════════════════
// Ruta: /informes/[id]
// Sirve el template premium (grimorio dorado) con los datos del user_report
// inyectados dinamicamente. El template vive en /public como HTML estatico.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

async function getReportData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener user_report + natal_chart del mismo user
  const { data: report } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, status, output_html, generated_at, report_slug')
    .eq('id', id)
    .single();

  if (!report || report.status !== 'ready') return null;

  const { data: chart } = await supabase
    .from('astrodorado_natal_charts')
    .select('sun_sign, sun_degree, moon_sign, moon_degree, rising_sign, rising_degree, dominant_element')
    .eq('user_id', report.user_id)
    .single();

  return { report, chart };
}

function degreeToMinutes(deg: number): string {
  const intDeg = Math.floor(deg);
  const minutes = Math.round((deg - intDeg) * 60);
  return `${intDeg.toString().padStart(2, '0')}°${minutes.toString().padStart(2, '0')}′`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const data = await getReportData(id);
  if (!data) notFound();

  const { report, chart } = data;

  // Leer el template premium de public/
  const templatePath = path.join(process.cwd(), 'public', 'informe-template-premium.html');
  let template: string;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch {
    // Fallback si el template no esta en el deploy aun
    return (
      <div style={{ padding: 40, fontFamily: 'Georgia, serif', color: '#a67c2e', background: '#050510', minHeight: '100vh' }}>
        <h1>Informe en preparación</h1>
        <p>El template premium aún no está disponible. Por favor vuelve en unos minutos.</p>
      </div>
    );
  }

  // Inyectar datos reales en el window.REPORT del template
  if (chart) {
    const sunStr = `${capitalize(chart.sun_sign)} · ${degreeToMinutes(chart.sun_degree)}`;
    const moonStr = `${capitalize(chart.moon_sign)} · ${degreeToMinutes(chart.moon_degree)}`;
    const ascStr = `${capitalize(chart.rising_sign)} · ${degreeToMinutes(chart.rising_degree)}`;
    const element = chart.dominant_element ? capitalize(chart.dominant_element) : 'Agua';

    template = template.replace(
      /window\.REPORT = \{[\s\S]*?\};/,
      `window.REPORT = ${JSON.stringify({
        clientSalute: 'Apreciado Sergio',
        issuedAt: new Date(report.generated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
        issuedCode: `AD·${new Date(report.generated_at).toISOString().slice(0,10).replace(/-/g, '·')} / Vol. I · No. 01`,
        delivery: 'Edición personal — intransferible',
        birthDate: '30 de Junio de 1973',
        birthTime: '12:00',
        birthPlace: 'Almería, España',
        latitude: '36°50′N',
        longitude: '02°28′W',
        sun: sunStr,
        moon: moonStr,
        ascendant: ascStr,
        midheaven: 'Sagitario · —',
        element: `${element} / Cardinal`,
        modality: 'Receptivo emocional',
        lifePath: '8',
        soulNumber: '6',
        destinyNumber: '1',
        expressionNumber: '7',
        birthYearVibration: '2',
      }, null, 2)};`
    );

    // Inyectar el output_html real en el slot de Carta Natal si existe
    if (report.output_html) {
      template = template.replace(
        '<!-- OUTPUT_HTML_SLOT -->',
        report.output_html
      );
    }
  }

  // Devolver el HTML como respuesta raw (usamos dangerouslySetInnerHTML dentro de un iframe)
  // Como el template es un documento completo con <html>, usamos un iframe srcdoc
  return (
    <div style={{ margin: 0, padding: 0, height: '100vh', overflow: 'hidden' }}>
      <iframe
        srcDoc={template}
        style={{
          width: '100vw',
          height: '100vh',
          border: 'none',
          display: 'block',
        }}
        title="Informe AstroDorado"
      />
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return {
    title: 'AstroDorado · Informe Personal del Alma',
    description: 'Tu carta natal, tu numerología, y la cartografía de tu destino.',
  };
}
