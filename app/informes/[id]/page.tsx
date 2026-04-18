// ═══════════════════════════════════════════════════════════════════
// Ruta publica: /informes/[id]
// Sirve el HTML de un informe astrologico ya generado
// Incluye boton para descargar en PDF
// ═══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

async function getReport(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .schema('astrodorado')
    .from('user_reports')
    .select('id, user_id, report_slug, status, output_html, generated_at, amount_paid_eur, report:reports(name_es, icon_emoji)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as unknown as {
    id: string;
    user_id: string;
    report_slug: string;
    status: string;
    output_html: string;
    generated_at: string;
    amount_paid_eur: number;
    report: { name_es: string; icon_emoji: string } | null;
  };
}

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report || report.status !== 'ready' || !report.output_html) {
    notFound();
  }

  const reportName = report.report?.name_es || 'Informe astrológico';
  const icon = report.report?.icon_emoji || '📜';
  const generatedDate = new Date(report.generated_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      {/* Header flotante con descargar PDF */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          padding: '12px 24px',
          background: 'rgba(26, 20, 15, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(212, 168, 83, 0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: "'Cinzel', Georgia, serif",
        }}
      >
        <a href="/" style={{ color: '#d4a853', fontSize: 12, letterSpacing: 2, textDecoration: 'none', textTransform: 'uppercase' }}>
          ← AstroDorado
        </a>
        <span style={{ color: 'rgba(232, 224, 208, 0.6)', fontSize: 11, letterSpacing: 2 }}>
          {icon} {reportName.toUpperCase()}
        </span>
        
          href={`/api/informes/${id}/pdf`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #d4a853, #a67c2e)',
            color: '#0a0a0f',
            textDecoration: 'none',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          ↓ Descargar PDF
        </a>
      </div>

      {/* Contenido HTML del informe (render interno) */}
      <div
        style={{ paddingTop: 56, minHeight: '100vh', background: '#faf8f3' }}
        dangerouslySetInnerHTML={{ __html: report.output_html }}
      />

      {/* Footer discreto */}
      <div
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          color: '#8a7258',
          fontSize: 12,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          background: '#faf8f3',
          borderTop: '1px solid rgba(212, 168, 83, 0.2)',
        }}
      >
        <div style={{ fontSize: 18, color: '#d4a853', marginBottom: 8 }}>✦ ✦ ✦</div>
        Informe generado el {generatedDate}<br />
        AstroDorado · NextHorizont AI SL
      </div>
    </>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  return {
    title: report ? `${report.report?.name_es || 'Informe'} · AstroDorado` : 'Informe no encontrado',
    description: 'Tu informe astrológico personal de AstroDorado',
  };
}
