import type { Metadata } from 'next';
import Image from 'next/image';
import { getLandingData } from '@/lib/supabase/horoscopes';
import type { CurrentHoroscope } from '@/lib/types/astrodorado';

// ISR cada 6 horas para que el horóscopo del día esté fresco
export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'AstroDorado — Horóscopo diario personalizado con IA',
  description:
    'Descubre tu horóscopo diario personalizado con IA astrológica de precisión. 12 signos, amor, trabajo y suerte actualizados cada día.',
  keywords: [
    'horóscopo diario',
    'astrología',
    'signos zodiacales',
    'predicciones',
    'carta natal',
    'tarot',
  ],
  openGraph: {
    title: 'AstroDorado — Tu oráculo dorado diario',
    description:
      'El horóscopo que te dice exactamente qué hacer hoy, basado en astrología de precisión.',
    type: 'website',
    locale: 'es_ES',
    url: 'https://astrodorado.com',
    siteName: 'AstroDorado',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AstroDorado — Horóscopo diario personalizado',
    description:
      'Predicciones astrológicas de precisión cada día. 12 signos, 5 niveles, 1 oráculo dorado.',
  },
  alternates: { canonical: 'https://astrodorado.com' },
};

export default async function HomePage() {
  const { horoscopes, hero, pricing, tagline } = await getLandingData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0014] via-[#1A0028] to-[#0A0014] text-[#E8E0D0]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'AstroDorado',
            url: 'https://astrodorado.com',
            description: tagline?.text ?? metadata.description,
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://astrodorado.com/{sign}',
              'query-input': 'required name=sign',
            },
          }),
        }}
      />

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-16 text-center">
        <h1 className="bg-gradient-to-r from-[#D4A853] via-[#F5DC90] to-[#D4A853] bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl">
          AstroDorado
        </h1>
        {tagline ? (
          <p className="mt-6 text-lg text-[#E8E0D0]/80 md:text-xl">{tagline.text}</p>
        ) : null}
      </section>

      <section
        aria-label="Los 12 signos del zodiaco"
        className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {horoscopes.map((h) => (
          <ZodiacCard key={h.sign_id} horoscope={h} />
        ))}
      </section>

      {hero ? (
        <section className="sticky bottom-0 border-t border-[#D4A853]/30 bg-[#0A0014]/95 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 sm:flex-row">
            <a
              href={hero.url}
              className="rounded-full bg-gradient-to-r from-[#E74C3C] to-[#C0392B] px-8 py-3 font-semibold text-white shadow-lg shadow-red-500/30 transition hover:scale-105"
            >
              {hero.text}
            </a>
            {pricing ? (
              <span className="mt-2 text-sm text-[#E8E0D0]/60 sm:ml-4 sm:mt-0">
                Desde {pricing.monthly_eur.toFixed(2)} €/mes
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ZodiacCard({ horoscope }: { horoscope: CurrentHoroscope }) {
  return (
    <a
      href={`/${horoscope.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-[#D4A853]/25 bg-gradient-to-br from-[#140028]/90 to-[#0A0014]/95 transition hover:border-[#D4A853]/60"
      aria-label={`Ver horóscopo de ${horoscope.name_es} hoy`}
    >
      <div className="relative aspect-square">
        <Image
          src={horoscope.image_url}
          alt={`Escultura dorada de ${horoscope.name_es}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h2 className="text-xl font-semibold text-[#D4A853]">{horoscope.name_es}</h2>
        <p className="mt-1 text-xs uppercase tracking-wider text-[#E8E0D0]/50">
          {horoscope.element} · {horoscope.ruling_planet}
        </p>
        {horoscope.advice ? (
          <p className="mt-3 line-clamp-3 text-sm text-[#E8E0D0]/80">{horoscope.advice}</p>
        ) : (
          <p className="mt-3 text-sm italic text-[#E8E0D0]/40">
            Generando el oráculo de hoy...
          </p>
        )}
      </div>
    </a>
  );
}
