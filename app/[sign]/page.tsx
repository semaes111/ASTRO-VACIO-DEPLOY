import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getZodiacSigns,
  getZodiacBySlug,
  getReadingBySignAndDate,
} from '@/lib/supabase/horoscopes';
import type { ZodiacSlug } from '@/lib/types/astrodorado';

export const revalidate = 21600; // ISR cada 6h
export const dynamicParams = false; // solo los 12 slugs válidos

interface PageProps {
  params: Promise<{ sign: string }>;
}

// ---------------------------------------------------------------------
// generateStaticParams — pre-rende las 12 páginas en build
// ---------------------------------------------------------------------
export async function generateStaticParams() {
  const signs = await getZodiacSigns();
  return signs.map((s) => ({ sign: s.slug }));
}

// ---------------------------------------------------------------------
// Metadata dinámica por signo (SEO)
// ---------------------------------------------------------------------
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sign } = await params;
  const zodiac = await getZodiacBySlug(sign as ZodiacSlug);

  if (!zodiac) return { title: 'Signo no encontrado' };

  const url = `https://astrodorado.com/${zodiac.slug}`;

  return {
    title: `Horóscopo ${zodiac.name_es} Hoy | AstroDorado`,
    description: zodiac.seo_description,
    alternates: { canonical: url },
    openGraph: {
      title: `Horóscopo de ${zodiac.name_es} hoy`,
      description: zodiac.seo_description,
      url,
      images: [{ url: zodiac.image_url, width: 800, height: 800 }],
    },
  };
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default async function SignPage({ params }: PageProps) {
  const { sign } = await params;
  const zodiac = await getZodiacBySlug(sign as ZodiacSlug);
  if (!zodiac) notFound();

  const reading = await getReadingBySignAndDate(zodiac.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Horóscopo ${zodiac.name_es} hoy`,
    description: reading?.energy_general ?? zodiac.seo_description,
    datePublished: reading?.created_at ?? new Date().toISOString(),
    author: { '@type': 'Organization', name: 'AstroDorado' },
    publisher: {
      '@type': 'Organization',
      name: 'NextHorizont AI',
      logo: { '@type': 'ImageObject', url: 'https://astrodorado.com/logo.png' },
    },
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0014] via-[#1A0028] to-[#0A0014] text-[#E8E0D0]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-[#E8E0D0]/50">
          <a href="/" className="hover:text-[#D4A853]">Inicio</a>
          <span className="mx-2">/</span>
          <span>{zodiac.name_es}</span>
        </nav>

        <header className="flex flex-col items-center text-center">
          <div className="relative h-48 w-48">
            <Image
              src={zodiac.image_url}
              alt={`Escultura dorada de ${zodiac.name_es}`}
              fill
              sizes="192px"
              priority
              className="object-contain"
            />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-[#D4A853] md:text-5xl">
            {zodiac.name_es}
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.25em] text-[#E8E0D0]/50">
            {zodiac.date_start} — {zodiac.date_end} · {zodiac.element} · Regente:{' '}
            {zodiac.ruling_planet}
          </p>
        </header>

        {reading ? (
          <section className="mt-12 space-y-8">
            <div>
              <h2 className="mb-3 text-sm uppercase tracking-widest text-[#D4A853]/70">
                Energía general
              </h2>
              <p className="text-lg leading-relaxed">{reading.energy_general}</p>
            </div>

            {reading.costar_phrase ? (
              <blockquote className="border-l-2 border-[#D4A853]/60 pl-4 text-lg italic text-[#F5DC90]">
                «{reading.costar_phrase}»
              </blockquote>
            ) : null}

            {hasLevels(reading) ? (
              <LevelIndicators
                amor={reading.nivel_amor}
                fortuna={reading.nivel_fortuna}
                salud={reading.nivel_salud}
                trabajo={reading.nivel_trabajo}
                energia={reading.nivel_energia}
              />
            ) : null}

            {reading.advice ? (
              <div className="rounded-xl border border-[#D4A853]/30 bg-[#140028]/80 p-6">
                <h2 className="mb-2 text-sm uppercase tracking-widest text-[#D4A853]/70">
                  Consejo del día
                </h2>
                <p className="text-lg italic">{reading.advice}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {reading.lucky_number !== null ? (
                <Fact label="Número" value={String(reading.lucky_number)} />
              ) : null}
              {reading.lucky_color ? (
                <Fact label="Color" value={reading.lucky_color} />
              ) : null}
              {reading.featured_area ? (
                <Fact label="Área" value={reading.featured_area} />
              ) : null}
            </div>
          </section>
        ) : (
          <p className="mt-12 text-center italic text-[#E8E0D0]/50">
            El oráculo de hoy aún se está componiendo. Vuelve en unos minutos.
          </p>
        )}
      </article>
    </main>
  );
}

// ---------------------------------------------------------------------
// Type guard — los 5 niveles están presentes
// ---------------------------------------------------------------------
function hasLevels(
  r: { nivel_amor: number | null; nivel_fortuna: number | null; nivel_salud: number | null; nivel_trabajo: number | null; nivel_energia: number | null },
): r is {
  nivel_amor: number;
  nivel_fortuna: number;
  nivel_salud: number;
  nivel_trabajo: number;
  nivel_energia: number;
} {
  return (
    r.nivel_amor !== null &&
    r.nivel_fortuna !== null &&
    r.nivel_salud !== null &&
    r.nivel_trabajo !== null &&
    r.nivel_energia !== null
  );
}

// ---------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------
function LevelIndicators(props: {
  amor: number;
  fortuna: number;
  salud: number;
  trabajo: number;
  energia: number;
}) {
  const items: { label: string; value: number }[] = [
    { label: 'Amor', value: props.amor },
    { label: 'Fortuna', value: props.fortuna },
    { label: 'Salud', value: props.salud },
    { label: 'Trabajo', value: props.trabajo },
    { label: 'Energía', value: props.energia },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center">
          <div
            className="relative h-20 w-6 overflow-hidden rounded-full border border-[#D4A853]/30"
            role="meter"
            aria-label={it.label}
            aria-valuenow={it.value}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#D4A853] to-[#F5DC90]"
              style={{ height: `${it.value}%` }}
            />
          </div>
          <span className="mt-2 text-xs text-[#E8E0D0]/70">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#D4A853]/20 bg-[#0A0014]/60 px-3 py-4">
      <p className="text-xs uppercase tracking-widest text-[#E8E0D0]/50">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#D4A853]">{value}</p>
    </div>
  );
}
