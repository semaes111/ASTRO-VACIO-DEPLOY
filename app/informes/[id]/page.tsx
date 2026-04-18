import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

async function getReport(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('astrodorado_user_reports')
    .select('id, status, output_html, generated_at, report_slug')
    .eq('id', id)
    .single();
  return data as { id: string; status: string; output_html: string; generated_at: string; report_slug: string } | null;
}

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report || report.status !== 'ready' || !report.output_html) notFound();

  const generatedDate = new Date(report.generated_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;700&family=EB+Garamond:ital,wght@0,400;500;600;1,400&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #faf8f3;
               font-family: 'EB Garamond', Georgia, serif; font-size: 18px; line-height: 1.8;
               color: #2a2118; }
        .informe-content { max-width: 780px; margin: 0 auto; padding: 80px 40px 60px; }
        .informe-content h2 { font-family: 'Cinzel', Georgia, serif; color: #a67c2e;
                              letter-spacing: 2px; font-size: 22px; margin-top: 56px;
                              padding-bottom: 10px; border-bottom: 1px solid rgba(212, 168, 83, 0.3); }
        .informe-content h3 { font-family: 'Cinzel', Georgia, serif; color: #a67c2e;
                              font-weight: 500; font-size: 17px; letter-spacing: 1px;
                              margin-top: 32px; font-style: italic; }
        .informe-content p { margin: 18px 0; text-align: justify; }
        .informe-content blockquote { border-left: 3px solid #d4a853; padding: 14px 24px;
                                      margin: 28px 0; background: rgba(212, 168, 83, 0.06);
                                      font-style: italic; color: #6b5c43; }
        .informe-content em { color: #a67c2e; font-style: italic; }
        .informe-content strong { color: #2a2118; font-weight: 600; }

        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { background: white; }
          .no-print { display: none !important; }
          .informe-content { max-width: none; padding: 0; }
          .informe-content h2 { page-break-after: avoid; }
          .informe-content h3 { page-break-after: avoid; }
          .informe-content blockquote { page-break-inside: avoid; }
        }
      `}} />

      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, padding: '12px 24px',
        background: 'rgba(26, 20, 15, 0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(212, 168, 83, 0.3)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: "'Cinzel', Georgia, serif",
      }}>
        <a href="/" style={{ color: '#d4a853', fontSize: 12, letterSpacing: 2, textDecoration: 'none', textTransform: 'uppercase' }}>
          ← AstroDorado
        </a>
        <span style={{ color: 'rgba(232, 224, 208, 0.6)', fontSize: 11, letterSpacing: 2 }}>
          CARTA NATAL COMPLETA
        </span>
        <PrintButton />
      </div>

      <div className="informe-content" dangerouslySetInnerHTML={{ __html: report.output_html }} />

      <div className="no-print" style={{
        padding: '40px 24px', textAlign: 'center', color: '#8a7258', fontSize: 12,
        fontFamily: 'Georgia, serif', fontStyle: 'italic', background: '#faf8f3',
        borderTop: '1px solid rgba(212, 168, 83, 0.2)',
      }}>
        <div style={{ fontSize: 18, color: '#d4a853', marginBottom: 8 }}>✦ ✦ ✦</div>
        Informe generado el {generatedDate}<br />
        AstroDorado · NextHorizont AI SL
      </div>
    </>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return { title: `Carta Natal · AstroDorado`, description: 'Tu informe astrológico personal' };
}
