'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #d4a853, #a67c2e)',
        color: '#0a0a0f', border: 'none', borderRadius: 20,
        fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
        cursor: 'pointer', fontFamily: "'Cinzel', Georgia, serif",
      }}
    >
      ↓ Guardar PDF
    </button>
  );
}
