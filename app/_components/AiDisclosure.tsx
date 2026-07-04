/**
 * Aviso de transparencia de IA — Reglamento (UE) 2024/1689 (art. 50).
 *
 * Para superficies del frontend que muestran contenido generado con IA que NO
 * pasa por el motor de informes (p.ej. el horóscopo diario, generado por
 * app/api/cron/daily-horoscope). Mismo texto legal que los informes.
 * Server Component puro (sin estado); estilos Tailwind del tema AstroDorado.
 */
export function AiDisclosure() {
  return (
    <aside
      role="note"
      aria-label="Aviso de contenido generado con inteligencia artificial"
      className="mx-auto mt-12 max-w-3xl rounded-lg border border-[#D4A853]/20 bg-[#0A0014]/60 px-5 py-4 text-xs leading-relaxed text-[#E8E0D0]/60"
    >
      <p className="mb-1 font-semibold text-[#D4A853]/80">
        Contenido generado con inteligencia artificial
      </p>
      <p>
        Este contenido ha sido elaborado de forma total o parcial mediante sistemas de
        inteligencia artificial. Aviso conforme al{' '}
        <span className="whitespace-nowrap">Reglamento (UE) 2024/1689</span> (Reglamento de
        Inteligencia Artificial). Contenido de carácter simbólico-interpretativo; no constituye
        asesoramiento médico, financiero, jurídico ni profesional.
      </p>
    </aside>
  );
}
