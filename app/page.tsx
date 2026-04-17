import type { Metadata } from 'next';
import { getLandingData } from '@/lib/supabase/horoscopes';
import AstroDoradoClient from './_components/AstroDoradoClient';

// ISR cada 6 horas — los horóscopos se actualizan a las 05:30 UTC
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'AstroDorado — Horóscopo diario con IA de precisión',
  description:
    'Los astros hablan, la IA traduce. Horóscopo diario personalizado para los 12 signos. ' +
    'Carta natal completa + 10 oráculos ancestrales. Desde €9,99/mes — primera semana gratis.',
  alternates: { canonical: 'https://astrodorado.com' },
  openGraph: {
    title: 'AstroDorado — El oráculo dorado del día',
    description: 'Horóscopo personalizado con IA. Los astros hablan, la IA traduce.',
    url: 'https://astrodorado.com',
    type: 'website',
    locale: 'es_ES',
    siteName: 'AstroDorado',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AstroDorado — Horóscopo diario con IA',
    description: 'Tu carta natal + 10 oráculos ancestrales cada mañana.',
  },
};

export default async function HomePage() {
  const { horoscopes, pricing, telegramBot, tagline } = await getLandingData();

  return (
    <AstroDoradoClient
      horoscopes={horoscopes}
      pricing={pricing}
      telegramBot={telegramBot}
      tagline={tagline}
    />
  );
}
