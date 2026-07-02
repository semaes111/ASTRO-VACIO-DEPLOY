import { notFound } from 'next/navigation';
import { getCatalogFromDB } from '@/lib/supabase/catalog';
import NuevoInformeClient from './NuevoInformeClient';

type Params = { params: Promise<{ productType: string }> };

// ISR alineado con el TTL del cache del catálogo (5 min).
export const revalidate = 300;

export default async function NuevoInformePage({ params }: Params) {
  const { productType } = await params;
  // Fuente única: vista public.astrodorado_reports (solo activos).
  const products = await getCatalogFromDB();
  const product = products.find((p) => p.product_type === productType);
  if (!product) notFound();
  return <NuevoInformeClient product={product} />;
}
