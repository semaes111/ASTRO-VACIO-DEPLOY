import Link from 'next/link';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CATALOG, type ProductType, getCatalogProductByType } from '@/lib/catalog';
import { DEMO_CHARACTER } from '@/lib/demo-character';
import { notFound } from 'next/navigation';

type Params = { params: Promise<{ productType: string }> };

export async function generateStaticParams() {
  return CATALOG.map((p) => ({ productType: p.product_type }));
}

const PRODUCT_TYPE_VALUES: ProductType[] = [
  'carta_natal', 'revolucion_solar', 'numerologia',
  'iching', 'horoscopo_chino', 'kabbalah', 'oraculo_360',
];

export default async function EjemploPage({ params }: Params) {
  const { productType: rawProductType } = await params;
  if (!PRODUCT_TYPE_VALUES.includes(rawProductType as ProductType)) {
    notFound();
  }
  const productType = rawProductType as ProductType;
  const product = getCatalogProductByType(productType);
  if (!product) notFound();

  let demoHtml: string | null = null;
  try {
    const demoPath = path.join(
      process.cwd(),
      'public',
      'demo-reports',
      `${productType}.html`
    );
    demoHtml = await fs.readFile(demoPath, 'utf-8');
  } catch { /* demo no generado aun */ }

  return (
    <div style={{ minHeight: '100vh', background: '#050510', color: '#f0e5cc' }}>
      <header style={{
        padding: '24px 32px', borderBottom: '0.5px solid rgba(212,175,55,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'rgba(5,5,16,0.95)',
        backdropFilter: 'blur(12px)', zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#7a5e0f', letterSpacing: 3,
            textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>Ejemplo publico</div>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 22, color: '#d4af37', fontWeight: 500 }}>{product.name_es}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/catalogo" style={{ color: '#7a5e0f', textDecoration: 'none',
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2 }}>Catalogo</Link>
          <Link href={`/informes/${productType}/nuevo`} style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
            color: '#050510', textDecoration: 'none', borderRadius: 6,
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
          }}>Comprar {product.price_eur} EUR</Link>
        </div>
      </header>

      <div style={{
        padding: '12px 32px', background: 'rgba(212,175,55,0.08)',
        borderBottom: '0.5px solid rgba(212,175,55,0.2)',
        fontFamily: 'Cormorant Garamond, Georgia, serif',
        fontSize: 15, fontStyle: 'italic', color: '#c2a572',
        textAlign: 'center',
      }}>
        Este es un ejemplo completo usando datos de {DEMO_CHARACTER.full_name} ({DEMO_CHARACTER.birth_date}).
        Tu informe sera unico, generado con tus datos reales.
      </div>

      {demoHtml ? (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
          <article
            dangerouslySetInnerHTML={{ __html: demoHtml }}
            style={{
              fontFamily: 'Cormorant Garamond, Georgia, serif',
              fontSize: 18, lineHeight: 1.7, color: '#f0e5cc',
            }}
          />
        </div>
      ) : (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '120px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>{product.icon_emoji}</div>
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 40, color: '#d4af37', fontWeight: 400, margin: '0 0 16px' }}>{product.name_es}</h2>
          <p style={{ fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: 22, fontStyle: 'italic', color: '#c2a572',
            margin: '0 0 24px', lineHeight: 1.5 }}>{product.tagline}</p>
          <p style={{ fontSize: 16, color: '#a68d5a', margin: '0 0 32px', lineHeight: 1.6 }}>
            {product.short_description}
          </p>
          <div style={{
            padding: '20px 32px', background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8,
            fontSize: 14, color: '#7a5e0f',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1,
          }}>
            Ejemplo publico en preparacion. Mientras tanto puedes comprar tu informe personal.
          </div>
          <div style={{ marginTop: 40 }}>
            <Link href={`/informes/${productType}/nuevo`} style={{
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #f0ce5a 0%, #d4af37 50%, #9c7e1f 100%)',
              color: '#050510', textDecoration: 'none', borderRadius: 8,
              fontSize: 13, letterSpacing: 2, textTransform: 'uppercase',
              fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
              boxShadow: '0 8px 32px rgba(212,175,55,0.35)',
            }}>Comprar por {product.price_eur} EUR</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { productType } = await params;
  const product = getCatalogProductByType(productType as ProductType);
  return {
    title: product ? `Ejemplo ${product.name_es} - Astro Dorado` : 'Ejemplo',
    description: product?.short_description,
  };
}