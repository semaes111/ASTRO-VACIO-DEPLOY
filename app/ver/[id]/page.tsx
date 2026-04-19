// =====================================================
// /ver/[id] - Ruta publica para mostrar informes
// Creada desde cero, aislada de /informes/* que tiene
// algo roto en edge cache de Vercel.
// =====================================================

import { createClient } from '@supabase/supabase-js';

type Params = { params: Promise<{ id: string }> };

export default async function VerInformePage({ params }: Params) {
  const { id } = await params;

  // Validar formato UUID basico antes de tocar Supabase
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#f0ce5a' }}>Identificador invalido</h1>
        <p>El ID proporcionado no tiene formato UUID valido.</p>
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh' }}>
        <h1 style={{ color: '#ff6b6b' }}>Error de configuracion</h1>
        <p>Variables de entorno Supabase no disponibles.</p>
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: report, error } = await supabase
    .from('astrodorado_user_reports')
    .select('id, status, output_html, report_slug, generated_at, error_message')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh' }}>
        <h1 style={{ color: '#ff6b6b' }}>Error al consultar el informe</h1>
        <pre style={{ background: 'rgba(255,0,0,0.1)', padding: 16, borderRadius: 4, fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {error.message}
        </pre>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ color: '#f0ce5a' }}>Informe no encontrado</h1>
        <p>No existe ningun informe con ID {id.slice(0, 8)}...</p>
      </div>
    );
  }

  // Estados previos a ready
  if (report.status !== 'ready' || !report.output_html) {
    const mensaje =
      report.status === 'generating' ? 'Tu informe se esta generando. Tarda de 3 a 6 minutos.' :
      report.status === 'paid' ? 'Pago confirmado. El informe arrancara a generarse en breve.' :
      report.status === 'pending_payment' ? 'Pendiente de pago.' :
      report.status === 'error' ? 'Ha habido un problema generando tu informe.' :
      'Estado: ' + report.status;

    return (
      <div style={{ padding: 40, background: '#050510', color: '#f0e5cc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ color: '#f0ce5a', fontFamily: 'Georgia, serif', fontSize: 28, marginTop: 80, textAlign: 'center' }}>
          AstroDorado
        </h1>
        <p style={{ textAlign: 'center', fontSize: 16, marginTop: 32, lineHeight: 1.6 }}>
          {mensaje}
        </p>
        {report.status === 'generating' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(240,229,204,0.5)', marginTop: 16 }}>
            Recarga esta pagina en unos minutos.
          </p>
        )}
        {report.error_message && (
          <pre style={{ background: 'rgba(255,0,0,0.08)', padding: 16, borderRadius: 4, fontSize: 12, marginTop: 24, whiteSpace: 'pre-wrap' }}>
            {report.error_message}
          </pre>
        )}
      </div>
    );
  }

  // Estado ready: render del output_html
  const productName = report.report_slug === 'ayurveda' ? 'Carta Ayurvedica' : 'Informe';
  const fecha = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div style={{ background: '#050510', color: '#f0e5cc', minHeight: '100vh' }}>
      <header style={{
        maxWidth: 780, margin: '0 auto', padding: '32px 24px 16px',
        borderBottom: '1px solid rgba(212,175,55,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(240,229,204,0.45)', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }}>
            Astro Dorado
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#f0ce5a', margin: '4px 0 0', fontWeight: 600 }}>
            {productName}
          </h1>
        </div>
        {fecha && (
          <div style={{ fontSize: 11, color: 'rgba(240,229,204,0.45)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em' }}>
            {fecha.toUpperCase()}
          </div>
        )}
      </header>

      <main
        style={{
          maxWidth: 780, margin: '0 auto', padding: '40px 24px 96px',
          fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.8,
          color: 'rgba(240,229,204,0.88)',
        }}
        dangerouslySetInnerHTML={{ __html: report.output_html }}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        main h1, main h2 { color: #f0ce5a; font-family: Georgia, serif; margin: 48px 0 16px; font-weight: 600; line-height: 1.3; }
        main h1 { font-size: 28px; }
        main h2 { font-size: 22px; border-bottom: 1px solid rgba(212,175,55,0.15); padding-bottom: 8px; }
        main h3 { color: #d4af37; font-family: Georgia, serif; font-size: 18px; margin: 32px 0 12px; }
        main h4 { color: #d4af37; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin: 24px 0 10px; }
        main p { margin: 0 0 18px; }
        main strong { color: #f0ce5a; font-weight: 600; }
        main em { color: rgba(240,206,90,0.9); font-style: italic; }
        main blockquote { border-left: 2px solid #d4af37; padding: 4px 0 4px 20px; margin: 28px 0; font-style: italic; color: rgba(240,229,204,0.75); }
        main ul, main ol { margin: 16px 0 24px; padding-left: 24px; }
        main li { margin-bottom: 6px; line-height: 1.7; }
        main table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; background: rgba(212,175,55,0.03); border: 1px solid rgba(212,175,55,0.15); }
        main th { background: rgba(212,175,55,0.1); color: #f0ce5a; padding: 10px 14px; text-align: left; font-family: Georgia, serif; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(212,175,55,0.25); }
        main td { padding: 10px 14px; border-bottom: 1px solid rgba(212,175,55,0.08); color: rgba(240,229,204,0.82); }
        main hr { border: none; height: 1px; background: linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent); margin: 40px 0; }
      ` }} />

      <footer style={{
        maxWidth: 780, margin: '0 auto', padding: '24px 24px 48px',
        borderTop: '1px solid rgba(212,175,55,0.15)', textAlign: 'center',
      }}>
        <p style={{ fontSize: 11, color: 'rgba(240,229,204,0.4)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', margin: '0 0 6px' }}>
          N{String.fromCharCode(186)} {id.slice(0, 8).toUpperCase()}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(240,229,204,0.4)', margin: 0 }}>
          AstroDorado {String.fromCharCode(183)} NextHorizont AI
        </p>
      </footer>
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: 'Tu informe | AstroDorado',
    robots: { index: false, follow: false },
  };
}