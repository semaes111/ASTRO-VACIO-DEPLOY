'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { getCatalogProductByType, type ProductType } from '@/lib/catalog';

export default function NuevoInformePage() {
  const params = useParams();
  const productType = params.productType as ProductType;
  const product = getCatalogProductByType(productType);

  const [form, setForm] = useState({
    full_name: '', birth_date: '', birth_time: '',
    birth_place: '', hebrew_name: '',
    revolution_year: new Date().getFullYear(),
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) {
    return (
      <div style={{ padding: 80, color: '#d4af37', textAlign: 'center' }}>
        Producto no encontrado
      </div>
    );
  }

  const needs = product.required_inputs;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const dataInputs: Record<string, string | number> = {
        full_name: form.full_name,
      };
      if (needs.includes('birth_date')) dataInputs.birth_date = form.birth_date;
      if (needs.includes('birth_time')) dataInputs.birth_time = form.birth_time;
      if (needs.includes('birth_place')) dataInputs.birth_place = form.birth_place;
      if (needs.includes('hebrew_name')) dataInputs.hebrew_name = form.hebrew_name;
      if (needs.includes('revolution_year')) dataInputs.revolution_year = form.revolution_year;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_slug: product!.slug,
          buyer_email: form.email,
          data_inputs: dataInputs,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.checkout_url) {
        throw new Error(json.error || 'Error al iniciar el pago');
      }
      window.location.href = json.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#f0e5cc', padding: '60px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <div style={{
          fontSize: 11, color: '#7a5e0f', letterSpacing: 3,
          textTransform: 'uppercase', marginBottom: 12,
          fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
        }}>Solicitar {product.name_es}</div>

        <h1 style={{
          fontFamily: 'Playfair Display, Georgia, serif',
          fontSize: 40, fontWeight: 400, color: '#d4af37',
          textAlign: 'center', margin: '0 0 16px',
        }}>{product.tagline}</h1>

        <p style={{
          fontFamily: 'Cormorant Garamond, Georgia, serif',
          fontSize: 18, color: '#c2a572', textAlign: 'center',
          margin: '0 0 40px', fontStyle: 'italic', lineHeight: 1.5,
        }}>
          Tu informe se generara tras el pago. Lo recibiras en ~{product.estimated_minutes} minutos.
        </p>

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(122,94,15,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 12, padding: 32,
        }}>

          <Field label="Nombre completo" required>
            <input type="text" required value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>

          {needs.includes('birth_date') && (
            <Field label="Fecha de nacimiento" required>
              <input type="date" required value={form.birth_date}
                onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </Field>
          )}

          {needs.includes('birth_time') && (
            <Field label="Hora de nacimiento" hint="Si no la sabes usa 12:00">
              <input type="time" value={form.birth_time}
                onChange={(e) => setForm({ ...form, birth_time: e.target.value })} />
            </Field>
          )}

          {needs.includes('birth_place') && (
            <Field label="Lugar de nacimiento" required>
              <input type="text" required value={form.birth_place}
                onChange={(e) => setForm({ ...form, birth_place: e.target.value })}
                placeholder="Madrid Espana" />
            </Field>
          )}

          {needs.includes('hebrew_name') && (
            <Field label="Nombre hebreo (opcional)">
              <input type="text" value={form.hebrew_name}
                onChange={(e) => setForm({ ...form, hebrew_name: e.target.value })} />
            </Field>
          )}

          {needs.includes('revolution_year') && (
            <Field label="Ano del pronostico" required>
              <input type="number" required min="2020" max="2050"
                value={form.revolution_year}
                onChange={(e) => setForm({ ...form, revolution_year: Number(e.target.value) })} />
            </Field>
          )}

          <Field label="Tu email" required hint="Donde recibiras el informe">
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>

          {error && (
            <div style={{
              padding: 12, background: 'rgba(200,16,46,0.1)',
              border: '1px solid rgba(200,16,46,0.3)', borderRadius: 6,
              color: '#ff6b6b', fontSize: 14, marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '16px',
            background: loading ? '#7a5e0f' : 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
            color: '#050510', border: 'none', borderRadius: 8,
            fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
            fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Redirigiendo...' : `Pagar ${product.price_eur} EUR con Stripe`}
          </button>

          <div style={{
            marginTop: 16, textAlign: 'center',
            fontSize: 11, color: '#7a5e0f',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1,
          }}>
            Pago seguro via Stripe - Tarjeta Google Pay Apple Pay
          </div>

        </form>
      </div>
    </div>
  );
}

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block', fontSize: 12, color: '#a68d5a',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2,
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: '#d4af37' }}> *</span>}
      </label>
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
      {hint && <div style={{
        marginTop: 4, fontSize: 12, color: '#7a5e0f',
        fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic',
      }}>{hint}</div>}
    </div>
  );
}