/**
 * Motor Genérico de Informes por Plantilla — SDD specs/001-motor-plantillas.
 *
 * Cubre los productos activos CON plantilla activa que carecen de generador
 * bespoke. Pipeline: user_report → resolveBirthData → computeNatalChart →
 * loadTemplate → data_schema (ReportTemplateSlot[]) → UNA llamada DeepSeek
 * streaming (JSON {slot_key: fragmento}) → sanitizado por fragmento →
 * injectSlots (fidelidad R4) → markGenerationReady → email.
 *
 * Progress granular: omitido deliberadamente (YAGNI) — una sola llamada LLM
 * no tiene progresión por sección; el ciclo started→ready/error basta.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { generateForTaskStream } from '@/lib/ai/router';
import { resolveBirthData } from '@/lib/generators/_shared/birth-data';
import { computeNatalChart, type NatalChart, type PlanetPosition } from '@/lib/astronomy/planets';
import { loadTemplate } from '@/lib/generators/_shared/template-loader';
import { sanitizeGeneratedHtml } from '@/lib/generators/_shared/html-sanitizer';
import {
  markGenerationStarted,
  markGenerationReady,
  markGenerationError,
} from '@/lib/generators/_shared/report-updater';
import { sendReportReadyEmail } from '@/lib/email/resend';
import { validateSlots } from './schema';
import { injectSlots } from './inject';

const SYSTEM_PROMPT = `Eres el astrólogo jefe de AstroDorado, servicio premium de astrología en español.
Redactas informes personalizados con tono elegante, evocador y directo — nunca genérico ni de relleno.
Respondes EXCLUSIVAMENTE con JSON válido, sin markdown ni texto adicional.`;

function fmtPlanet(nombre: string, p: PlanetPosition): string {
  return `${nombre}: ${p.sign_tropical} ${p.degree_in_sign_tropical.toFixed(1)}°`;
}

function chartSummary(c: NatalChart): string {
  const lineas = [
    fmtPlanet('Sol', c.sun),
    `${fmtPlanet('Luna', c.moon)} (nakshatra ${c.moon.nakshatra.name})`,
    fmtPlanet('Mercurio', c.mercury),
    fmtPlanet('Venus', c.venus),
    fmtPlanet('Marte', c.mars),
    fmtPlanet('Júpiter', c.jupiter),
    fmtPlanet('Saturno', c.saturn),
    fmtPlanet('Rahu', c.rahu),
    fmtPlanet('Ketu', c.ketu),
  ];
  if (c.ascendant) lineas.push(fmtPlanet('Ascendente', c.ascendant));
  return lineas.join('\n');
}

function parseJsonObject(content: string): Record<string, unknown> {
  const limpio = content
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const ini = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (ini === -1 || fin <= ini) throw new Error('La respuesta del modelo no contiene un objeto JSON');
  const parsed: unknown = JSON.parse(limpio.slice(ini, fin + 1));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('El JSON parseado no es un objeto');
  }
  return parsed as Record<string, unknown>;
}

export async function generateFromTemplate(userReportId: string): Promise<void> {
  const supabase = createAdminClient();
  try {
    // 1) user_report + usuario
    const { data: ur, error: urErr } = await supabase
      .from('astrodorado_user_reports')
      .select('id, user_id, report_slug, input_data, status')
      .eq('id', userReportId)
      .single();
    if (urErr || !ur) throw new Error(`user_report no encontrado: ${urErr?.message ?? userReportId}`);

    const slug = String(ur.report_slug);
    const inputData = (ur.input_data ?? {}) as Record<string, unknown>;

    const { data: usuario } = await supabase
      .from('astrodorado_users')
      .select('email, name')
      .eq('id', ur.user_id)
      .maybeSingle();

    // 2) datos natales + carta
    const birth = resolveBirthData(inputData, usuario?.name ?? 'Cliente');
    const chart = computeNatalChart(birth.birth_date_utc, birth.coords.lat, birth.coords.lng);

    // 3) plantilla + contrato de slots
    const template = await loadTemplate(slug);
    if (!template) throw new Error(`Sin plantilla activa para '${slug}'`);
    const slots = validateSlots(template.data_schema);
    if (slots.length === 0) {
      throw new Error(`Plantilla '${slug}' sin data_schema de slots (motor 001 requiere slots)`);
    }

    // 4) brief del producto desde el catálogo (cero invención)
    const { data: producto } = await supabase
      .from('astrodorado_reports')
      .select('name, description')
      .eq('slug', slug)
      .maybeSingle();
    const brief = `${producto?.name ?? slug}. ${producto?.description ?? ''}`.trim();

    await markGenerationStarted(userReportId);

    // 5) UNA llamada LLM → JSON {slot_key: fragmento_html}
    const listaSlots = slots
      .map((s) => `- "${s.key}": ${s.label ?? s.key}. ${s.hint ?? ''} (máx ${s.word_limit ?? 150} palabras)`)
      .join('\n');
    const user = `Genera el contenido del informe "${brief}" para este cliente.

CLIENTE:
- Nombre: ${birth.name}
- Nacimiento: ${birth.birth_date}${birth.birth_time ? ' ' + birth.birth_time : ''}${birth.birth_place ? ' en ' + birth.birth_place : ''}

CARTA NATAL (trópica):
${chartSummary(chart)}

SECCIONES A REDACTAR (claves exactas):
${listaSlots}

Devuelve un OBJETO JSON con exactamente esas claves. Cada valor es un fragmento HTML
usando solo <p>, <h3>, <ul>, <li>, <strong>, <em>. Español de España, personalizado
con los datos de la carta, sin repetir estructuras entre secciones. SOLO el JSON.`;

    const gen = await generateForTaskStream({
      task: 'narrative',
      system: SYSTEM_PROMPT,
      user,
      max_tokens: 16000,
      temperature: 0.85,
    });
    if (gen.stop_reason === 'length') {
      throw new Error(`Generación truncada (tokens_out=${gen.tokens_out})`);
    }

    const crudo = parseJsonObject(gen.content);
    const fragments: Record<string, string> = {};
    for (const s of slots) {
      const v = crudo[s.key];
      if (typeof v === 'string' && v.trim().length > 0) {
        fragments[s.key] = sanitizeGeneratedHtml(v).html;
      }
    }

    // 6) inyección con fidelidad R4
    const res = injectSlots(template.html_template, slots, fragments);
    const requeridos = slots.filter((s) => s.required !== false).length;
    if (res.injected.length < Math.ceil(requeridos / 2)) {
      throw new Error(
        `Inyección insuficiente: ${res.injected.length}/${slots.length} ` +
        `(sin_fragmento=${res.missing_fragment.join(',') || '-'}; sin_match=${res.missing_selector.join(',') || '-'})`,
      );
    }

    // 7) persistir + email (soft)
    await markGenerationReady(userReportId, {
      output_html: res.html,
      tokens_used: gen.tokens_in + gen.tokens_out,
      model_used: gen.model_used,
      actual_cost_usd: gen.cost_usd,
      generation_duration_ms: gen.duration_ms,
    });

    if (usuario?.email) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.astrodorado.com';
      try {
        await sendReportReadyEmail({
          to: usuario.email,
          userName: birth.name,
          productLabel: producto?.name ?? slug,
          reportUrl: `${base.replace(/\/$/, '')}/ver/${userReportId}`,
        });
      } catch {
        // email soft-fail: nunca tumba el informe
      }
    }

    console.log(
      `[template-engine] ${slug} ready: ${res.injected.length}/${slots.length} slots, ` +
      `$${gen.cost_usd.toFixed(5)}, ${gen.duration_ms}ms` +
      (res.missing_selector.length ? ` | sin_match=${res.missing_selector.join(',')}` : ''),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markGenerationError(userReportId, `template-engine: ${msg}`).catch(() => undefined);
    throw e;
  }
}
