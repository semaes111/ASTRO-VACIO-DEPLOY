'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ExitoContent() {
  const params = useSearchParams();
  const reportId = params.get('report_id');
  const [status, setStatus] = useState<'waiting' | 'ready' | 'error'>('waiting');

  useEffect(() => {
    if (!reportId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/informe-status?report_id=${reportId}`);
        const data = await res.json();
        if (data.status === 'ready') { setStatus('ready'); clearInterval(interval); }
        else if (data.status === 'error') { setStatus('error'); clearInterval(interval); }
      } catch { /* retry */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [reportId]);

  return (
    <div style={{
      minHeight: '100vh', background: '#050510', color: '#f0e5cc',
      padding: 80, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: 64, marginBottom: 24, color: '#d4af37' }}>
          {status === 'waiting' ? 'O' : status === 'ready' ? 'OK' : 'X'}
        </div>
        <h1 style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 40, color: '#d4af37', fontWeight: 400, margin: '0 0 16px',
        }}>
          {status === 'waiting' && 'Generando tu informe'}
          {status === 'ready' && 'Tu informe esta listo'}
          {status === 'error' && 'Ha habido un problema'}
        </h1>
        <p style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif',
          fontSize: 20, fontStyle: 'italic', color: '#c2a572',
          margin: '0 0 40px',
        }}>
          {status === 'waiting' && 'Claude Sonnet esta escribiendo tu lectura. 3-5 minutos.'}
          {status === 'ready' && 'Puedes leerlo online y descargarlo en PDF.'}
          {status === 'error' && 'Tu pago esta registrado. Contactanos para resolverlo.'}
        </p>
        {status === 'ready' && reportId && (
          <Link href={`/informes/carta_natal/${reportId}`} style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
            color: '#050510', textDecoration: 'none', borderRadius: 8,
            fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
            fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          }}>Ver mi informe</Link>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh', background: '#050510', color: '#f0e5cc',
      padding: 80, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: 64, marginBottom: 24, color: '#d4af37' }}>O</div>
        <h1 style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 40, color: '#d4af37', fontWeight: 400, margin: 0,
        }}>Cargando...</h1>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ExitoContent />
    </Suspense>
  );
}
