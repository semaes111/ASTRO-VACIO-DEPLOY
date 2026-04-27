import Link from 'next/link';
import { CATALOG, ORACULO_360_SAVINGS, ORACULO_360_SUM_INDIVIDUAL } from '@/lib/catalog';

export const metadata = {
  title: 'Precios - Astro Dorado',
  description: 'Compara los 6 informes individuales o descubre el Oraculo 360 con ahorro.',
};

export const dynamic = 'force-static';

export default function PricingPage() {
  // is_active filter — ver app/catalogo/page.tsx para rationale.
  const individuales = CATALOG.filter((p) => p.is_active && p.product_type !== 'oraculo_360');
  const oraculo = CATALOG.find((p) => p.product_type === 'oraculo_360')!;

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#f0e5cc', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        <header style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{
            fontSize: 13, color: '#7a5e0f', letterSpacing: 4,
            textTransform: 'uppercase', marginBottom: 20,
            fontFamily: 'JetBrains Mono, monospace',
          }}>Precios</div>
          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(40px, 6vw, 60px)', fontWeight: 400,
            lineHeight: 1.1, color: '#d4af37', margin: '0 0 16px',
          }}>
            Dos formas de <em style={{ color: '#f0ce5a' }}>conocerte</em>
          </h1>
          <p style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 20, color: '#c2a572', maxWidth: 640, margin: '0 auto',
            lineHeight: 1.5, fontStyle: 'italic',
          }}>
            Compra los informes que te interesan o entra al volumen completo con un solo pago.
          </p>
        </header>

        <div style={{ marginBottom: 60 }}>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 24, fontWeight: 400, color: '#d4af37',
            textAlign: 'center', marginBottom: 24,
          }}>Comparativa</h2>
          <div style={{
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 12, overflow: 'hidden',
            background: 'rgba(122,94,15,0.04)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ background: 'rgba(212,175,55,0.08)' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#a68d5a', fontWeight: 400 }}>Informe</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#a68d5a', fontWeight: 400 }}>Palabras</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#a68d5a', fontWeight: 400 }}>Precio</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {individuales.map((p) => (
                  <tr key={p.slug} style={{ borderTop: '0.5px solid rgba(212,175,55,0.15)' }}>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, color: '#d4af37' }}>{p.name_es}</div>
                      <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 14, fontStyle: 'italic', color: '#a68d5a' }}>{p.tagline}</div>
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#c2a572' }}>
                      {(p.word_count_target / 1000).toFixed(1)}K
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22, color: '#d4af37' }}>
                      {p.price_eur} EUR
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <Link href={`/informes/${p.product_type}/nuevo`} style={{
                        padding: '8px 14px', border: '1px solid #7a5e0f',
                        color: '#d4af37', textDecoration: 'none', borderRadius: 6,
                        fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>Comprar</Link>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '0.5px solid rgba(212,175,55,0.15)', background: 'rgba(122,94,15,0.08)' }}>
                  <td style={{ padding: '18px 20px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#a68d5a', textTransform: 'uppercase', letterSpacing: 2 }}>Suma individual</td>
                  <td></td>
                  <td style={{ padding: '18px 20px', textAlign: 'right', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, color: '#a68d5a', textDecoration: 'line-through' }}>
                    {ORACULO_360_SUM_INDIVIDUAL} EUR
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{
          border: '2px solid #d4af37', borderRadius: 16, padding: 48,
          background: 'linear-gradient(135deg, rgba(122,94,15,0.15) 0%, rgba(212,175,55,0.05) 100%)',
          textAlign: 'center',
        }}>
          <span style={{
            display: 'inline-block', background: '#d4af37', color: '#050510',
            fontSize: 11, padding: '4px 14px', borderRadius: 999,
            letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 20,
          }}>Premium - Ahorra {ORACULO_360_SAVINGS} EUR</span>

          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 54, fontWeight: 400, color: '#d4af37', margin: '0 0 8px',
          }}>{oraculo.name_es}</h2>

          <p style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 22, fontStyle: 'italic', color: '#c2a572', margin: '0 0 32px',
          }}>{oraculo.tagline}</p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
            <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 72, color: '#d4af37' }}>
              {oraculo.price_eur} EUR
            </span>
            <span style={{ fontSize: 20, color: '#7a5e0f', textDecoration: 'line-through' }}>
              {ORACULO_360_SUM_INDIVIDUAL} EUR
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16, maxWidth: 720, margin: '0 auto 32px',
            textAlign: 'left',
          }}>
            {individuales.map((p) => (
              <div key={p.slug} style={{
                fontSize: 14, color: '#c2a572',
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                padding: '8px 12px',
                borderLeft: '2px solid #7a5e0f',
              }}>
                + {p.name_es} ({p.tagline})
              </div>
            ))}
            <div style={{
              fontSize: 14, color: '#f0ce5a',
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              padding: '8px 12px',
              borderLeft: '2px solid #d4af37',
              gridColumn: '1 / -1',
              fontWeight: 600,
            }}>
              + Capitulo EXCLUSIVO de sintesis convergente (no disponible sueltos)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/ejemplos/oraculo_360" style={{
              padding: '14px 32px', border: '1px solid #7a5e0f',
              color: '#d4af37', textDecoration: 'none', borderRadius: 8,
              fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
            }}>Ver ejemplo</Link>
            <Link href="/oraculo-360/comprar" style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
              color: '#050510', textDecoration: 'none', borderRadius: 8,
              fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
              fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
            }}>Comprar Oraculo 360</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
