// =====================================================
// InformeCartaNatalPremium - template iframe legacy
// Se mantiene tal cual estaba para preservar el diseno
// premium de Sergio (public/informe-template-premium.html)
// =====================================================

import fs from 'node:fs/promises';
import path from 'node:path';

interface UserReport {
  id: string;
  generated_at: string | null;
  input_data: Record<string, unknown> | null;
}

interface NatalChart {
  sun_sign: string;
  sun_degree: number | null;
  moon_sign: string;
  moon_degree: number | null;
  rising_sign: string | null;
  rising_degree: number | null;
  dominant_element: string | null;
}

function degreeToMinutes(deg: number | null): string {
  if (deg == null) return '-';
  const intDeg = Math.floor(deg);
  const minutes = Math.round((deg - intDeg) * 60);
  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);
  return intDeg.toString().padStart(2, '0') + DEG + minutes.toString().padStart(2, '0') + MIN;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export default async function InformeCartaNatalPremium({
  report,
  chart,
}: {
  report: UserReport;
  chart: NatalChart;
}) {
  const templatePath = path.join(process.cwd(), 'public', 'informe-template-premium.html');

  let template: string;
  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch {
    return (
      <div style={{ padding: 40, color: '#a67c2e', background: '#050510', minHeight: '100vh' }}>
        Template no disponible
      </div>
    );
  }

  const c = chart;
  const DOT = String.fromCharCode(183);
  const DEG = String.fromCharCode(176);
  const MIN = String.fromCharCode(8242);

  const generatedDate = report.generated_at ? new Date(report.generated_at) : new Date();
  const isoDate = generatedDate.toISOString().slice(0, 10);
  const dottedDate = isoDate.split('-').join(DOT);

  // Datos del input_data si están disponibles, fallback a valores de Sergio
  const input = (report.input_data ?? {}) as Record<string, string | undefined>;
  const clientName = input.name ?? 'Sergio';
  const birthDate = input.birth_date_display ?? '30 de Junio de 1973';
  const birthTime = input.birth_time ?? '12:00';
  const birthPlace = input.birth_place ?? 'Almería, España';

  const dataBlock = {
    clientSalute: 'Apreciado ' + clientName,
    issuedAt: generatedDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    issuedCode: 'AD' + DOT + dottedDate + ' / Vol. I ' + DOT + ' No. 01',
    delivery: 'Edición personal · intransferible',
    birthDate,
    birthTime,
    birthPlace,
    latitude: '36' + DEG + '50' + MIN + 'N',
    longitude: '02' + DEG + '28' + MIN + 'W',
    sun: cap(c.sun_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.sun_degree),
    moon: cap(c.moon_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.moon_degree),
    ascendant: c.rising_sign ? cap(c.rising_sign) + ' ' + DOT + ' ' + degreeToMinutes(c.rising_degree) : '-',
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

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: '#050510',
      }}
    >
      <iframe
        srcDoc={template}
        style={{ width: '100vw', height: '100vh', border: 'none', display: 'block' }}
        title="Informe AstroDorado"
      />
      <a
        href={`/informes/${report.id}/pdf`}
        target="_blank"
        rel="noopener"
        style={{
          position: 'fixed',
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
          textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          boxShadow: '0 8px 32px rgba(212,175,55,0.35), 0 0 0 1px rgba(212,175,55,0.4) inset',
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 900 }}>PDF</span>
        <span>Descargar</span>
      </a>
    </div>
  );
}
