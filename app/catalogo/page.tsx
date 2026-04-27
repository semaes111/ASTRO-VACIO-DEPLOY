import Link from 'next/link';
import { CATALOG, ORACULO_360_SAVINGS, ORACULO_360_SUM_INDIVIDUAL } from '@/lib/catalog';

export const metadata = {
  title: 'Catalogo - Astro Dorado',
  description: 'Seis tradiciones milenarias interpretadas por IA, mas el Oraculo 360 que las reune todas.',
};

export const dynamic = 'force-static';

export default function CatalogoPage() {
  // Filtrado por is_active: oculta los 22 productos del nuevo patrón hasta que
  // se ingeste su template (el trigger DB activa is_active=true automáticamente,
  // pero esta página es force-static y consume CATALOG hardcoded en build time).
  const individuales = CATALOG.filter((p) => p.is_active && p.product_type !== 'oraculo_360');
  const oraculo = CATALOG.find((p) => p.product_type === 'oraculo_360')!;

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#f0e5cc', padding: '80px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <header style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{
            fontSize: 13, color: '#7a5e0f', letterSpacing: 4,
            textTransform: 'uppercase', marginBottom: 20,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}>
            Astro Dorado - Catalogo
          </div>
          <h1 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 400,
            lineHeight: 1.1, color: '#d4af37', margin: '0 0 20px',
          }}>
            Elige tu <em style={{ fontStyle: 'italic', color: '#f0ce5a' }}>consulta</em>
          </h1>
          <p style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 20, color: '#c2a572', maxWidth: 620, margin: '0 auto',
            lineHeight: 1.5, fontStyle: 'italic',
          }}>
            Seis tradiciones milenarias interpretadas por IA, o el Oraculo 360 que las reune todas en un solo volumen.
          </p>
        </header>

        <section style={{ marginBottom: 80 }}>
          <h2 style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 28, fontWeight: 400, color: '#d4af37',
            textAlign: 'center', marginBottom: 40,
          }}>
            Informes individuales
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 24,
          }}>
            {individuales.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </section>

        <section style={{
          border: '2px solid #d4af37',
          borderRadius: 16,
          padding: 48,
          background: 'linear-gradient(135deg, rgba(122,94,15,0.12) 0%, rgba(212,175,55,0.05) 100%)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{
              display: 'inline-block',
              background: '#d4af37', color: '#050510',
              fontSize: 11, padding: '4px 14px', borderRadius: 999,
              letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700,
              marginBottom: 16,
            }}>
              Premium - Ahorra {ORACULO_360_SAVINGS} EUR
            </span>
            <h2 style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 48, fontWeight: 400, color: '#d4af37', margin: '0 0 8px',
            }}>
              {oraculo.name_es}
            </h2>
            <p style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 20, fontStyle: 'italic', color: '#c2a572',
              margin: '0 0 24px',
            }}>
              {oraculo.tagline}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 16, marginBottom: 24 }}>
              <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 64, color: '#d4af37', fontWeight: 400 }}>
                {oraculo.price_eur} EUR
              </span>
              <span style={{ fontSize: 18, color: '#7a5e0f', textDecoration: 'line-through' }}>
                {ORACULO_360_SUM_INDIVIDUAL} EUR
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/ejemplos/oraculo_360" style={{
                padding: '14px 32px', border: '1px solid #7a5e0f',
                color: '#d4af37', textDecoration: 'none', borderRadius: 8,
                fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                Ver ejemplo
              </Link>
              <Link href="/oraculo-360/comprar" style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
                color: '#050510', textDecoration: 'none', borderRadius: 8,
                fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
                fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
              }}>
                Comprar Oraculo 360
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function ProductCard({ product }: { product: typeof CATALOG[0] }) {
  return (
    <div style={{
      border: '1px solid rgba(212,175,55,0.2)',
      borderRadius: 12,
      padding: 28,
      background: 'rgba(122,94,15,0.06)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        fontSize: 10, color: '#7a5e0f', letterSpacing: 3,
        textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace',
      }}>
        {product.category}
      </div>
      <h3 style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 26, fontWeight: 500, color: '#d4af37', margin: 0,
      }}>
        {product.name_es}
      </h3>
      <p style={{
        fontFamily: 'Cormorant Garamond, Georgia, serif',
        fontSize: 17, fontStyle: 'italic', color: '#c2a572',
        margin: 0, lineHeight: 1.4, minHeight: 48,
      }}>
        {product.tagline}
      </p>
      <p style={{
        fontSize: 14, color: '#a68d5a', margin: 0, lineHeight: 1.6,
        flex: 1,
      }}>
        {product.short_description}
      </p>
      <div style={{
        fontFamily: 'Playfair Display, Georgia, serif',
        fontSize: 36, color: '#d4af37', fontWeight: 400,
      }}>
        {product.price_eur} EUR
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href={`/ejemplos/${product.product_type}`} style={{
          flex: 1, padding: '10px', textAlign: 'center',
          border: '1px solid rgba(212,175,55,0.3)',
          color: '#c2a572', textDecoration: 'none', borderRadius: 6,
          fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          Ver ejemplo
        </Link>
        <Link href={`/informes/${product.product_type}/nuevo`} style={{
          flex: 1, padding: '10px', textAlign: 'center',
          background: '#d4af37', color: '#050510',
          textDecoration: 'none', borderRadius: 6,
          fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
          fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
        }}>
          Comprar
        </Link>
      </div>
    </div>
  );
}
