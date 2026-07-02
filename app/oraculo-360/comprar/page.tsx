import { notFound } from 'next/navigation';
import { getCatalogFromDB } from '@/lib/supabase/catalog';
import ComprarOraculo360Client from './ComprarOraculo360Client';

// ISR alineado con el TTL del cache del catálogo (5 min).
export const revalidate = 300;

export default async function ComprarOraculo360Page() {
  // Fuente única: vista public.astrodorado_reports (solo activos).
  const products = await getCatalogFromDB();
  const oraculo = products.find((p) => p.product_type === 'oraculo_360');
  if (!oraculo) notFound();
  return <ComprarOraculo360Client oraculo={oraculo} />;
}
