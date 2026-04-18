// Ruta /informes/[id] - wrapper con iframe (vista premium) + boton PDF fuera
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

function degreeToMinutes(deg: number): string {
  const intDeg = Math.floor(deg);
  const minutes = Math.round((deg - intDeg) * 60);
  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);
  return intDeg.toString().padStart(2, '0') + DEG + minutes.toString().padStart(2, '0') + MIN;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function getData(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: report } = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, status, generated_at, output_html')
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

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  const templatePath = path.join(process.cwd(), 'public', 'informe-template-premium.html');
  let template: string;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch {
    return <div style={{ padding: 40, color: '#a67c2e' }}>Template no disponible</div>;
  }

  if (data.chart) {
    const c = data.chart;
    const DOT = String.fromCharCode(183);
    const DEG = String.fromCharCode(176);
    const MIN = String.fromCharCode(8242);
    const isoDate = new Date(data.report.generated_at).toISOString().slice(0, 10);
    const dottedDate = isoDate.split('-').join(DOT);
    const dataBlock = {
      clientSalute: 'Apreciado Sergio',
      issuedAt: new Date(data.report.generated_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      issuedCode: 'AD' + DOT + dottedDate + ' / Vol. I ' + DOT + ' No. 01',
      delivery: 'Edicion personal - intransferible',
      birthDate: '30 de Junio de 1973',
      birthTime: '12:00',
      birthPlace: 'Almeria, Espana',
      latitude: '36' + DEG + '50' + MIN + 'N',
      longitude: '02' + DEG + '28' + MIN + 'W',
      sun: cap(c.sun_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.sun_degree),
      moon: cap(c.moon_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.moon_degree),
      ascendant: cap(c.rising_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.rising_degree),
      midheaven: 'Sagitario ' + DOT + ' -',
      element: (c.dominant_element ? cap(c.dominant_element) : 'Agua') + ' / Cardinal',
      modality: 'Receptivo emocional',
      lifePath: '8',
      soulNumber: '6',
      destinyNumber: '1',
      expressionNumber: '7',
      birthYearVibration: '2',
    };
    template = template.replace(
      /window\.REPORT = \{[\s\S]*?\};/,
      'window.REPORT = ' + JSON.stringify(dataBlock, null, 2) + ';'
    );
  }

  const buttonStyle = {
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    padding: '14px 22px',
    background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
    color: '#050510',
    textDecoration: 'none',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    boxShadow: '0 8px 32px rgba(212,175,55,0.35), 0 0 0 1px rgba(212,175,55,0.4) inset',
    zIndex: 9999,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 8,
    cursor: 'pointer' as const,
    backdropFilter: 'blur(8px)',
  };

  const iframeStyle = {
    width: '100vw',
    height: '100vh',
    border: 'none',
    display: 'block' as const,
  };

  const wrapperStyle = {
    margin: 0,
    padding: 0,
    height: '100vh',
    overflow: 'hidden' as const,
    position: 'relative' as const,
    background: '#050510',
  };

  return (
    <div style={wrapperStyle}>
      <iframe srcDoc={template} style={iframeStyle} title="Informe AstroDorado" />
      <a href={`/informes/${id}/print`} target="_blank" rel="noopener" style={buttonStyle}>
        <span style={{ fontSize: 14, fontWeight: 900 }}>PDF</span>
        <span>Descargar</span>
      </a>
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return {
    title: 'AstroDorado - Informe Personal del Alma',
    description: 'Tu carta natal, tu numerologia, y la cartografia de tu destino.',
  };
}
