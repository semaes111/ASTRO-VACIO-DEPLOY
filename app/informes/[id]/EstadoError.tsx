// =====================================================
// EstadoError - renderizado para status error/expired/refunded
// =====================================================

interface Props {
  reportId: string;
  errorMessage: string | null;
  productName: string;
}

export default function EstadoError({ reportId, errorMessage, productName }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050510',
        color: '#f0e5cc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: "'Cinzel', serif",
      }}
    >
      <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 48,
            marginBottom: 24,
            color: '#a05a3a',
          }}
        >
          ⚠
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: '0 0 16px',
            letterSpacing: '0.08em',
            color: '#f0ce5a',
          }}
        >
          Hemos tenido un contratiempo
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'rgba(240,229,204,0.7)',
            margin: '0 0 20px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Tu <strong style={{ color: '#f0ce5a' }}>{productName}</strong> no ha podido
          generarse correctamente. Nuestro equipo ha sido notificado y recibirás una
          actualización en breve. Si has pagado, tu cargo será reembolsado automáticamente
          en 24-48h.
        </p>

        {errorMessage && (
          <div
            style={{
              background: 'rgba(160,90,58,0.08)',
              border: '1px solid rgba(160,90,58,0.25)',
              borderRadius: 6,
              padding: '12px 16px',
              margin: '0 0 24px',
              fontSize: 12,
              color: 'rgba(240,229,204,0.55)',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textAlign: 'left',
              wordBreak: 'break-word',
            }}
          >
            {errorMessage}
          </div>
        )}

        <a
          href="/catalogo"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: 'transparent',
            border: '1px solid rgba(212,175,55,0.4)',
            color: '#f0ce5a',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Volver al catálogo
        </a>

        <p
          style={{
            marginTop: 32,
            fontSize: 10,
            color: 'rgba(240,229,204,0.25)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          id: {reportId.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
}
