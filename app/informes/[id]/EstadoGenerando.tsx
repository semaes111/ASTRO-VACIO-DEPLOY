'use client';

// =====================================================
// EstadoGenerando - visible mientras el worker VPS genera
// Auto-polling: cada 20s comprueba si el status cambio
// Hace un soft reload si pasa a ready/error
// =====================================================

import { useEffect, useState } from 'react';

interface Props {
  reportId: string;
  startedAt: string | null;
  productName: string;
  estimatedMinutes: number;
}

export default function EstadoGenerando({
  reportId,
  startedAt,
  productName,
  estimatedMinutes,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(
    startedAt ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) : 0
  );

  // Contador en vivo
  useEffect(() => {
    const iv = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Polling: refresca la pagina cada 20s para comprobar si cambio el status
  useEffect(() => {
    const iv = setInterval(() => {
      window.location.reload();
    }, 20_000);
    return () => clearInterval(iv);
  }, []);

  const estimatedSec = estimatedMinutes * 60;
  const progressPct = Math.min(95, Math.round((elapsedSec / estimatedSec) * 100));

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
      <div
        style={{
          maxWidth: 540,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Icono girando */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 32px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px solid rgba(212,175,55,0.15)',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px solid transparent',
              borderTopColor: '#d4af37',
              borderRadius: '50%',
              animation: 'astro-spin 1.2s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 32,
              color: '#d4af37',
            }}
          >
            ✦
          </div>
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            margin: '0 0 12px',
            letterSpacing: '0.08em',
            color: '#f0ce5a',
          }}
        >
          Escribiendo tu {productName}
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'rgba(240,229,204,0.7)',
            margin: '0 0 32px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          }}
        >
          Nuestro oráculo está conectando los hilos de tu carta. Cada palabra se
          compone con precisión astronómica y tradición milenaria. Este proceso
          toma entre 3 y 6 minutos.
        </p>

        {/* Barra de progreso */}
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'rgba(212,175,55,0.12)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #9c7e1f 0%, #d4af37 50%, #f0ce5a 100%)',
              borderRadius: 3,
              transition: 'width 1s ease-out',
            }}
          />
        </div>

        <div
          style={{
            fontSize: 12,
            color: 'rgba(240,229,204,0.5)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '0.1em',
          }}
        >
          TRANSCURRIDO {formatElapsed(elapsedSec)} / ESTIMADO {estimatedMinutes} MIN
        </div>

        <p
          style={{
            marginTop: 32,
            fontSize: 11,
            color: 'rgba(240,229,204,0.35)',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          Esta página se refresca automáticamente. Puedes cerrarla y volver más
          tarde; el informe seguirá generándose y lo encontrarás listo al regresar.
        </p>

        <p
          style={{
            marginTop: 12,
            fontSize: 10,
            color: 'rgba(240,229,204,0.25)',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          id: {reportId.slice(0, 8)}...
        </p>
      </div>

      <style>{`
        @keyframes astro-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
