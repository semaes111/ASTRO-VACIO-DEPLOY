// =====================================================
// /informes/[id] - VERSION MINIMA DE DIAGNOSTICO
// Sin subcomponentes, sin imports externos. Solo lee
// output_html de Supabase y lo renderiza.
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

async function getReport(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('astrodorado_user_reports')
    .select('id, status, output_html, report_slug, generated_at, error_message')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[informes/page] supabase error:', error);
    throw new Error('db_error: ' + error.message);
  }

  return data;
}

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) notFound();

  // Render simple, sin subcomponentes
  if (report.status !== 'ready') {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#f0ce5a' }}>Informe en estado: {report.status}</h1>
        <p>ID: {id}</p>
        {report.error_message && (
          <pre style={{ background: 'rgba(255,0,0,0.1)', padding: 16, borderRadius: 4, marginTop: 16 }}>
            {report.error_message}
          </pre>
        )}
        <p style={{ marginTop: 24, fontSize: 12, color: 'rgba(240,229,204,0.5)' }}>
          (Recarga esta pagina en unos segundos si tu informe aun se esta generando)
        </p>
      </div>
    );
  }

  if (!report.output_html) {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh' }}>
        <h1>Informe vacio</h1>
        <p>Status=ready pero output_html es null</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#050510', color: '#f0e5cc', minHeight: '100vh', padding: 24 }}>
      <header style={{ maxWidth: 780, margin: '0 auto 32px', paddingBottom: 16, borderBottom: '1px solid rgba(212,175,55,0.3)' }}>
        <h1 style={{ fontSize: 24, color: '#f0ce5a', margin: 0, fontFamily: 'serif' }}>
          {report.report_slug === 'ayurveda' ? 'Carta Ayurvedica' : 'Informe'}
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(240,229,204,0.5)', margin: '8px 0 0' }}>
          ID: {id.slice(0, 8)}...
        </p>
      </header>
      <main
        style={{
          maxWidth: 780,
          margin: '0 auto',
          fontFamily: 'Georgia, serif',
          lineHeight: 1.8,
          color: 'rgba(240,229,204,0.88)',
        }}
        dangerouslySetInnerHTML={{ __html: report.output_html }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        main h1, main h2, main h3 { color: #f0ce5a; font-family: serif; }
        main strong { color: #f0ce5a; }
        main em { color: rgba(240,206,90,0.9); }
        main p { margin: 0 0 20px; }
        main ul, main ol { padding-left: 24px; }
        main table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        main th, main td { padding: 8px 12px; border: 1px solid rgba(212,175,55,0.2); text-align: left; }
        main th { background: rgba(212,175,55,0.08); color: #f0ce5a; }
      `}} />
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return {
    title: 'Informe ' + id.slice(0, 8) + ' | AstroDorado',
    robots: { index: false, follow: false },
  };
}