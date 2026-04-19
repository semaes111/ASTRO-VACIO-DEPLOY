// =====================================================
// /informes/[id] - Orchestrator multi-tipo
// =====================================================
// Rutea por status -> UI apropiada
// Si status=ready, rutea por report_slug -> componente especifico
// Soporta: carta-natal (template premium legacy) + cualquier otro con output_html
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

import EstadoGenerando from './EstadoGenerando';
import EstadoEspera from './EstadoEspera';
import EstadoError from './EstadoError';
import InformeCartaNatalPremium from './InformeCartaNatalPremium';
import InformeGenerico from './InformeGenerico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

interface UserReport {
  id: string;
  user_id: string;
  report_slug: string;
  status: 'pending_payment' | 'paid' | 'generating' | 'ready' | 'error' | 'expired' | 'refunded';
  input_data: Record<string, unknown> | null;
  output_html: string | null;
  life_cycles_snapshot: Record<string, unknown> | null;
  generation_started_at: string | null;
  generated_at: string | null;
  error_message: string | null;
  tokens_used: number | null;
  actual_cost_usd: number | null;
}

interface NatalChart {
  sun_sign: string;
  sun_degree: number | null;
  moon_sign: string;
  moon_degree: number | null;
  rising_sign: string | null;
  rising_degree: number | null;
  dominant_element: string | null;
}

interface ReportMeta {
  slug: string;
  name_es: string;
  category: string;
  product_type: string | null;
  tagline: string | null;
  theme_slug: string | null;
  primary_color: string | null;
  accent_color: string | null;
  hero_icon: string | null;
  estimated_minutes: number | null;
}

async function getReport(id: string): Promise<{
  report: UserReport | null;
  chart: NatalChart | null;
  meta: ReportMeta | null;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: report } = await supabase
    .from('astrodorado_user_reports')
    .select(
      'id, user_id, report_slug, status, input_data, output_html, life_cycles_snapshot, generation_started_at, generated_at, error_message, tokens_used, actual_cost_usd'
    )
    .eq('id', id)
    .single();

  if (!report) return { report: null, chart: null, meta: null };

  // Metadata del producto para estilos
  const { data: meta } = await supabase
    .from('astrodorado_reports')
    .select(
      'slug, name_es, category, product_type, tagline, theme_slug, primary_color, accent_color, hero_icon, estimated_minutes'
    )
    .eq('slug', report.report_slug)
    .single();

  // Solo cargamos natal_chart si es carta-natal (los demas no lo necesitan)
  let chart: NatalChart | null = null;
  if (report.report_slug === 'carta-natal') {
    const { data } = await supabase
      .from('astrodorado_natal_charts')
      .select('sun_sign, sun_degree, moon_sign, moon_degree, rising_sign, rising_degree, dominant_element')
      .eq('user_id', report.user_id)
      .maybeSingle();
    chart = data as NatalChart | null;
  }

  return {
    report: report as UserReport,
    chart,
    meta: meta as ReportMeta | null,
  };
}

export default async function InformePage({ params }: Params) {
  const { id } = await params;
  const { report, chart, meta } = await getReport(id);

  if (!report) notFound();

  // ============ ROUTING POR STATUS ============
  switch (report.status) {
    case 'pending_payment':
      return (
        <EstadoEspera
          variant="pending_payment"
          reportId={report.id}
          productName={meta?.name_es ?? 'Tu informe'}
        />
      );

    case 'paid':
      return (
        <EstadoEspera
          variant="paid"
          reportId={report.id}
          productName={meta?.name_es ?? 'Tu informe'}
          estimatedMinutes={meta?.estimated_minutes ?? 6}
        />
      );

    case 'generating':
      return (
        <EstadoGenerando
          reportId={report.id}
          startedAt={report.generation_started_at}
          productName={meta?.name_es ?? 'Tu informe'}
          estimatedMinutes={meta?.estimated_minutes ?? 6}
        />
      );

    case 'error':
      return (
        <EstadoError
          reportId={report.id}
          errorMessage={report.error_message}
          productName={meta?.name_es ?? 'Tu informe'}
        />
      );

    case 'expired':
    case 'refunded':
      return (
        <EstadoError
          reportId={report.id}
          errorMessage={
            report.status === 'expired'
              ? 'Este informe ha expirado.'
              : 'Este informe ha sido reembolsado.'
          }
          productName={meta?.name_es ?? 'Tu informe'}
        />
      );

    case 'ready':
      break; // sigue abajo

    default:
      notFound();
  }

  // ============ ROUTING POR TIPO DE INFORME (status=ready) ============

  // Carta natal mantiene el template premium legacy (design ornado Sergio)
  if (report.report_slug === 'carta-natal' && chart) {
    return <InformeCartaNatalPremium report={report} chart={chart} />;
  }

  // Todos los demas (ayurveda, numerologia, iching, kabbalah, horoscopo-chino,
  // revolucion-solar, oraculo-360, y los 30 productos del catalogo) usan el
  // componente generico que renderiza output_html con el design system base.
  if (!report.output_html) {
    return (
      <EstadoError
        reportId={report.id}
        errorMessage="El informe esta marcado como listo pero no tiene contenido generado. Contacta con soporte."
        productName={meta?.name_es ?? 'Tu informe'}
      />
    );
  }

  return <InformeGenerico report={report} meta={meta} />;
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const { report, meta } = await getReport(id);

  if (!report) {
    return { title: 'Informe no encontrado | AstroDorado' };
  }

  const title = meta?.name_es
    ? `${meta.name_es} | AstroDorado`
    : 'Tu informe | AstroDorado';

  return {
    title,
    description: meta?.tagline ?? 'Tu carta personalizada con astrologia de precision.',
    robots: { index: false, follow: false },
  };
}
