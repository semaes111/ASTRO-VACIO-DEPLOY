// =====================================================
// InformeGenerico - renderiza output_html de user_reports
// Soporta Ayurveda, Numerologia, I-Ching, Kabbalah, etc.
// Estilos inline (dark luxury) + clases especificas .ayu-*
// =====================================================

import styles from './estilos-ayurveda.module.css';

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
      {/* ============ HEADER ============ */}
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

      {/* ============ HERO ============ */}
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

      {/* ============ BODY (output_html) ============ */}
      <main
        className={styles.informeBody}
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '32px 24px 96px',
        }}
        dangerouslySetInnerHTML={{ __html: report.output_html ?? '' }}
      />

      {/* ============ FOOTER ============ */}
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
