// =====================================================
// EstadoEspera - renderizado SSR para status:
//   - pending_payment (esperando Stripe webhook)
//   - paid (pagado, esperando que arranque el generador)
// =====================================================

interface Props {
  variant: 'pending_payment' | 'paid';
  reportId: string;
  productName: string;
  estimatedMinutes?: number;
}

export default function EstadoEspera({
  variant,
  reportId,
  productName,
  estimatedMinutes,
}: Props) {
  const isPending = variant === 'pending_payment';

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
            color: isPending ? '#9c7e1f' : '#d4af37',
          }}
        >
          {isPending ? '⧗' : '✧'}
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
          {isPending ? 'Esperando confirmación de pago' : 'En cola para generación'}
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'rgba(240,229,204,0.7)',
            margin: '0 0 24px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          {isPending ? (
            <>
              Tu solicitud de <strong style={{ color: '#f0ce5a' }}>{productName}</strong>{' '}
              ha sido registrada. Estamos confirmando el pago con Stripe. Este paso
              suele tardar unos segundos; si tu pago se completó correctamente, esta
              página se actualizará automáticamente.
            </>
          ) : (
            <>
              Tu <strong style={{ color: '#f0ce5a' }}>{productName}</strong> está en cola
              para generación. En unos instantes nuestro oráculo comenzará a escribirlo.
              La generación completa tomará aproximadamente {estimatedMinutes ?? 6}{' '}
              minutos.
            </>
          )}
        </p>

        <a
          href={`/informes/${reportId}`}
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
          Actualizar estado
        </a>

        <p
          style={{
            marginTop: 32,
            fontSize: 10,
            color: 'rgba(240,229,204,0.25)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          id: {reportId.slice(0, 8)}... · estado: {variant}
        </p>
      </div>
    </div>
  );
}
