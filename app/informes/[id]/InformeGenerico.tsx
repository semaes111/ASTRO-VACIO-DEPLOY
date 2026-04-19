// =====================================================
// InformeGenerico - renderiza output_html de user_reports
// Soporta Ayurveda, Numerologia, I-Ching, Kabbalah, etc.
// Estilos INLINE en <style> tag (sin CSS module)
// =====================================================

interface UserReport {
  id: string;
  report_slug: string;
  output_html: string | null;
  generated_at: string | null;
  input_data: Record<string, unknown> | null;
  tokens_used: number | null;
  actual_cost_usd: number | null;
  life_cycles_snapshot: Record<string, unknown> | null;
}

interface ReportMeta {
  slug: string;
  name_es: string;
  category: string;
  tagline: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hero_icon: string | null;
}

const INFORME_CSS = `
  .ayu-report {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: rgba(240, 229, 204, 0.88);
    line-height: 1.8;
    font-size: 16px;
  }
  .ayu-report-header {
    text-align: center;
    padding: 32px 0;
    margin-bottom: 40px;
    border-bottom: 1px solid rgba(212, 175, 55, 0.15);
  }
  .ayu-report-eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: rgba(240, 229, 204, 0.45);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    margin: 0 0 12px;
  }
  .ayu-report-header h1 {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 32px;
    font-weight: 600;
    color: #f0ce5a;
    letter-spacing: 0.02em;
    line-height: 1.25;
    margin: 0 0 12px;
  }
  .ayu-report-subtitle {
    font-size: 15px;
    color: rgba(240, 229, 204, 0.6);
    font-style: italic;
    margin: 0;
  }
  .ayu-report .ayu-section {
    margin: 48px 0;
    padding: 24px 0;
  }
  .ayu-report .ayu-section + .ayu-section {
    border-top: 1px solid rgba(212, 175, 55, 0.08);
    padding-top: 48px;
  }
  .ayu-report h2 {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 26px;
    font-weight: 600;
    color: #f0ce5a;
    letter-spacing: 0.01em;
    margin: 0 0 24px;
    line-height: 1.3;
  }
  .ayu-report h3 {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 19px;
    font-weight: 500;
    color: #d4af37;
    margin: 32px 0 16px;
    letter-spacing: 0.02em;
  }
  .ayu-report h4 {
    font-size: 14px;
    font-weight: 600;
    color: #d4af37;
    margin: 24px 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .ayu-report p {
    margin: 0 0 20px;
    color: rgba(240, 229, 204, 0.85);
  }
  .ayu-report strong {
    color: #f0ce5a;
    font-weight: 600;
  }
  .ayu-report em {
    color: rgba(240, 206, 90, 0.9);
    font-style: italic;
  }
  .ayu-report blockquote {
    border-left: 2px solid #d4af37;
    margin: 32px 0;
    padding: 8px 0 8px 24px;
    color: rgba(240, 229, 204, 0.75);
    font-style: italic;
    font-size: 17px;
    line-height: 1.7;
  }
  .ayu-report ul,
  .ayu-report ol {
    margin: 16px 0 24px;
    padding-left: 24px;
    color: rgba(240, 229, 204, 0.85);
  }
  .ayu-report li {
    margin-bottom: 8px;
    line-height: 1.7;
  }
  .ayu-report table {
    width: 100%;
    border-collapse: collapse;
    margin: 24px 0;
    background: rgba(212, 175, 55, 0.03);
    border: 1px solid rgba(212, 175, 55, 0.15);
    border-radius: 4px;
    overflow: hidden;
    font-size: 14px;
  }
  .ayu-report thead {
    background: rgba(212, 175, 55, 0.12);
  }
  .ayu-report th {
    padding: 12px 16px;
    text-align: left;
    color: #f0ce5a;
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 600;
    letter-spacing: 0.05em;
    font-size: 13px;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(212, 175, 55, 0.25);
  }
  .ayu-report td {
    padding: 12px 16px;
    color: rgba(240, 229, 204, 0.8);
    border-bottom: 1px solid rgba(212, 175, 55, 0.08);
  }
  .ayu-report hr {
    border: none;
    height: 1px;
    background: linear-gradient(to right, transparent 0%, rgba(212, 175, 55, 0.3) 50%, transparent 100%);
    margin: 48px 0;
  }
  .ayu-report-footer {
    margin-top: 64px;
    padding-top: 24px;
    border-top: 1px solid rgba(212, 175, 55, 0.15);
    text-align: center;
  }
  .ayu-report-footer p {
    font-size: 12px;
    color: rgba(240, 229, 204, 0.4);
    font-style: italic;
    margin: 0;
    line-height: 1.6;
  }
  @media (max-width: 640px) {
    .ayu-report { font-size: 15px; }
    .ayu-report-header h1 { font-size: 26px; }
    .ayu-report h2 { font-size: 22px; }
    .ayu-report h3 { font-size: 17px; }
    .ayu-report table { font-size: 13px; }
    .ayu-report th, .ayu-report td { padding: 8px 10px; }
  }
`;

export default function InformeGenerico({
  report,
  meta,
}: {
  report: UserReport;
  meta: ReportMeta | null;
}) {
  const primaryColor = meta?.primary_color ?? '#d4af37';
  const accentColor = meta?.accent_color ?? '#f0ce5a';
  const productName = meta?.name_es ?? 'Tu informe';
  const heroIcon = meta?.hero_icon ?? '✦';

  const generatedDate = report.generated_at
    ? new Date(report.generated_at).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050510',
        color: '#f0e5cc',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: INFORME_CSS }} />

      <header
        style={{
          padding: '32px 24px',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 980,
          margin: '0 auto',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 18,
            fontWeight: 600,
            color: accentColor,
            textDecoration: 'none',
            letterSpacing: '0.15em',
          }}
        >
          ASTRO DORADO
        </a>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {generatedDate && (
            <span
              style={{
                fontSize: 11,
                color: 'rgba(240,229,204,0.4)',
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                letterSpacing: '0.1em',
              }}
            >
              {generatedDate.toUpperCase()}
            </span>
          )}

          <a
            href={`/informes/${report.id}/pdf`}
            target="_blank"
            rel="noopener"
            style={{
              padding: '8px 18px',
              background: 'transparent',
              border: `1px solid ${primaryColor}66`,
              color: accentColor,
              textDecoration: 'none',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            PDF
          </a>
        </div>
      </header>

      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '64px 24px 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 48,
            color: primaryColor,
            marginBottom: 16,
            lineHeight: 1,
          }}
        >
          {heroIcon}
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'rgba(240,229,204,0.4)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: 16,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          {meta?.category ?? 'informe'} · astro dorado
        </div>

        <h1
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 42,
            fontWeight: 600,
            margin: '0 0 16px',
            color: accentColor,
            letterSpacing: '0.03em',
            lineHeight: 1.2,
          }}
        >
          {productName}
        </h1>

        {meta?.tagline && (
          <p
            style={{
              fontSize: 16,
              color: 'rgba(240,229,204,0.65)',
              maxWidth: 560,
              margin: '0 auto',
              lineHeight: 1.6,
              fontStyle: 'italic',
            }}
          >
            {meta.tagline}
          </p>
        )}
      </div>

      <main
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '32px 24px 96px',
        }}
        dangerouslySetInnerHTML={{ __html: report.output_html ?? '' }}
      />

      <footer
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '32px 24px 64px',
          borderTop: '1px solid rgba(212,175,55,0.15)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: 'rgba(240,229,204,0.35)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '0.1em',
            margin: '0 0 8px',
          }}
        >
          INFORME Nº {report.id.slice(0, 8).toUpperCase()}
        </p>
        <p
          style={{
            fontSize: 11,
            color: 'rgba(240,229,204,0.35)',
            margin: 0,
          }}
        >
          © {new Date().getFullYear()} AstroDorado · NextHorizont AI
        </p>
      </footer>
    </div>
  );
}
