'use client';

import { useState } from 'react';
import { CATALOG, ORACULO_360_SAVINGS } from '@/lib/catalog';

export default function ComprarOraculo360Page() {
  const oraculo = CATALOG.find((p) => p.product_type === 'oraculo_360')!;
  const [form, setForm] = useState({
    full_name: '', birth_date: '', birth_time: '',
    birth_place: '', hebrew_name: '', email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_slug: oraculo.slug,
          buyer_email: form.email,
          data_inputs: form,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.checkout_url) throw new Error(json.error || 'error');
      window.location.href = json.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#f0e5cc', padding: '60px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <span style={{
          display: 'inline-block', background: '#d4af37', color: '#050510',
          fontSize: 11, padding: '4px 14px', borderRadius: 999,
          letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
          marginBottom: 16,
        }}>Premium Ahorro {ORACULO_360_SAVINGS} EUR</span>

        <h1 style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 48, fontWeight: 400, color: '#d4af37', margin: '0 0 16px',
        }}>Oraculo 360</h1>

        <p style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif',
          fontSize: 22, fontStyle: 'italic', color: '#c2a572',
          margin: '0 0 32px',
        }}>Las seis tradiciones convergen en ti</p>

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(122,94,15,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 12, padding: 32,
        }}>
          <Field label="Nombre completo">
            <input type="text" required value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" required value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </Field>
          <Field label="Hora de nacimiento">
            <input type="time" required value={form.birth_time}
              onChange={(e) => setForm({ ...form, birth_time: e.target.value })} />
          </Field>
          <Field label="Lugar de nacimiento">
            <input type="text" required value={form.birth_place}
              onChange={(e) => setForm({ ...form, birth_place: e.target.value })} />
          </Field>
          <Field label="Nombre hebreo (opcional)">
            <input type="text" value={form.hebrew_name}
              onChange={(e) => setForm({ ...form, hebrew_name: e.target.value })} />
          </Field>
          <Field label="Email de entrega">
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>

          {error && <div style={{
            padding: 12, color: '#ff6b6b', fontSize: 14, marginBottom: 12,
          }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '18px',
            background: loading ? '#7a5e0f' : 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
            color: '#050510', border: 'none', borderRadius: 8,
            fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
            fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Redirigiendo...' : `Comprar Oraculo 360 - ${oraculo.price_eur} EUR`}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 12, color: '#a68d5a',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2,
        textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</label>
      <div style={{
        background: 'rgba(5,5,16,0.5)',
        border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6,
      }}>
        <style>{`
          input { width: 100%; padding: 12px 14px; background: transparent;
                  border: none; color: #f0e5cc; font-size: 15px;
                  font-family: Cormorant Garamond, Georgia, serif; outline: none; }
        `}</style>
        {children}
      </div>
    </div>
  );
}
