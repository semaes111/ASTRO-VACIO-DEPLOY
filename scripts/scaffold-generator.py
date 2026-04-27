#!/usr/bin/env python3
"""
scripts/scaffold-generator.py — Clonador programático de workers.

Dado un slug del catálogo, genera `lib/generators/<slug>/{prompt,generate}.ts`
clonando la estructura de `evento-vehiculo` y sustituyendo:

  - Constantes del producto (SLUG, PRIMARY_COLOR, ACCENT_COLOR, etc.)
  - Nombres de funciones y tipos (PascalCase del slug)
  - Validación de inputs según `required_inputs` del producto en DB
  - Wrapper HTML con clase y data-product propios

Lo que NO genera:
  - El SYSTEM_PROMPT específico del producto. Genera un placeholder con
    TODO y comentarios. El usuario debe redactar el system prompt
    manualmente con el conocimiento astrológico del producto.
  - Productos con natal_chart_array (socios, partners): el scaffolder
    los marca como FIXME — requieren orchestración custom.
  - Productos con 2 natal_charts (sinastría/relaciones): no soportado
    en v1 del scaffolder. Requiere computeNatalChart x2 + sinastría.

Uso:

    # Generar un solo worker:
    python3 scripts/scaffold-generator.py --slug=evento-viaje

    # Dry run (no escribe archivos):
    python3 scripts/scaffold-generator.py --slug=evento-viaje --dry-run

    # Generar todos los slugs con required_inputs simple (1 person + datos):
    python3 scripts/scaffold-generator.py --all-electives

Pre-requisitos:
  - psycopg o requests + token de Supabase para leer el catálogo
  - Por simplicidad este script lee el catálogo desde un JSON local
    (`scripts/_catalog_snapshot.json`) generado con:
        npx tsx scripts/dump-catalog.ts > scripts/_catalog_snapshot.json

  Si quieres lectura directa de DB, ajusta `load_catalog()`.

Limitaciones conocidas:
  - No actualiza `scripts/test-generator.ts` automáticamente. Tras
    scaffoldear, edita ese archivo y añade:
      · import del nuevo generator
      · entry en WORKERS
      · entry en INPUT_FIXTURES
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_PROMPT = REPO_ROOT / "lib" / "generators" / "evento-vehiculo" / "prompt.ts"
TEMPLATE_GENERATE = REPO_ROOT / "lib" / "generators" / "evento-vehiculo" / "generate.ts"
GENERATORS_DIR = REPO_ROOT / "lib" / "generators"
CATALOG_SNAPSHOT = REPO_ROOT / "scripts" / "_catalog_snapshot.json"

# Slugs que NO se pueden scaffoldear automáticamente con el patrón electivo
UNSUPPORTED_SLUGS = {
    # Bundles (orquestan otros workers, no son workers individuales)
    "oraculo-360", "relaciones-360", "eventos-360", "negocios-360",
    # Sinastrías de 2 personas
    "pareja-sinastria", "pareja-destino", "familiar", "kamasutra-astro",
    "amistad-karmica", "evento-boda", "neg-contratacion",
    # Múltiples personas
    "neg-socios",
    # No requieren persona (solo empresa)
    "neg-carta-empresa", "neg-marca-timing",
    # Worker custom ya implementado
    "evento-vehiculo", "evento-mudanza",
    # Worker legacy que NO sigue el patrón
    "ayurveda",
}

# ---------------------------------------------------------------------------
# Utilidades de naming
# ---------------------------------------------------------------------------

def slug_to_camel(slug: str) -> str:
    """evento-viaje → eventoViaje"""
    parts = slug.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

def slug_to_pascal(slug: str) -> str:
    """evento-viaje → EventoViaje"""
    return "".join(p.capitalize() for p in slug.split("-"))

def slug_to_short(slug: str) -> str:
    """evento-viaje → ev (2-3 chars para CSS class prefix)"""
    parts = slug.split("-")
    if len(parts) == 1:
        return parts[0][:3]
    # Inicial de cada parte
    return "".join(p[0] for p in parts)

# ---------------------------------------------------------------------------
# Catálogo
# ---------------------------------------------------------------------------

def load_catalog() -> list[dict[str, Any]]:
    """Carga el snapshot del catálogo desde `scripts/_catalog_snapshot.json`.

    Si no existe, lanza error con instrucciones de cómo generarlo.
    """
    if not CATALOG_SNAPSHOT.exists():
        sys.exit(
            f"❌ No existe {CATALOG_SNAPSHOT}.\n"
            "   Genera el snapshot ejecutando:\n"
            "     npx tsx scripts/dump-catalog.ts > scripts/_catalog_snapshot.json\n"
            "   O copia manualmente la salida del SELECT en astrodorado.reports."
        )
    with CATALOG_SNAPSHOT.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        sys.exit(f"❌ {CATALOG_SNAPSHOT} no contiene un array JSON")
    return data

def get_product(catalog: list[dict[str, Any]], slug: str) -> dict[str, Any]:
    for p in catalog:
        if p["slug"] == slug:
            return p
    sys.exit(f"❌ No existe el producto '{slug}' en el catálogo")

# ---------------------------------------------------------------------------
# Generación de validación de inputs
# ---------------------------------------------------------------------------

def emit_validate_inputs_ts(required_inputs: list[Any]) -> str:
    """A partir de required_inputs (mixto string|object), genera el bloque TS
    de validación que va dentro de validateInputs().

    Soporta:
      - text (string non-empty)
      - date (regex YYYY-MM-DD)
      - time (regex HH:MM o HH:MM:SS, opcional)
      - select (enum from options)
      - integer (parseInt + isFinite)
      - natal_chart (skip — lo procesa resolveBirthData)
      - natal_chart_array (FIXME)
    """
    lines: list[str] = []
    fields_to_return: list[str] = []  # nombres de variables locales

    for ri in required_inputs:
        # Normalizar a forma objeto
        if isinstance(ri, str):
            obj = {"name": ri, "type": "text", "required": True}
        else:
            obj = ri

        name = obj["name"]
        typ = obj.get("type", "text")
        required = obj.get("required", True)
        camel = slug_to_camel(name)

        # natal_chart se procesa después en resolveBirthData
        if typ == "natal_chart":
            continue

        # natal_chart_array no soportado
        if typ == "natal_chart_array":
            lines.append(
                f"  // FIXME: required_input '{name}' (natal_chart_array) "
                f"no soportado por scaffolder.\n"
                f"  // Implementación manual: validar input_data.{name} es array "
                f"y procesar cada item con resolveBirthData."
            )
            continue

        if typ == "text":
            if required:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  if (typeof {camel}Raw !== 'string' || {camel}Raw.trim().length === 0) {{\n"
                    f"    throw new Error(\"input_data.{name} es requerido (string no vacío)\");\n"
                    f"  }}\n"
                    f"  const {camel} = {camel}Raw.trim();"
                )
            else:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  const {camel} = typeof {camel}Raw === 'string' && {camel}Raw.trim().length > 0\n"
                    f"    ? {camel}Raw.trim()\n"
                    f"    : null;"
                )
            fields_to_return.append(camel)

        elif typ == "date":
            if required:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  if (typeof {camel}Raw !== 'string') {{\n"
                    f"    throw new Error(\"input_data.{name} es requerido (string: 'YYYY-MM-DD')\");\n"
                    f"  }}\n"
                    f"  if (!/^\\d{{4}}-\\d{{2}}-\\d{{2}}$/.test({camel}Raw)) {{\n"
                    f"    throw new Error(`input_data.{name} no tiene formato YYYY-MM-DD: '${{{camel}Raw}}'`);\n"
                    f"  }}\n"
                    f"  const {camel} = {camel}Raw;"
                )
            else:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  const {camel} = typeof {camel}Raw === 'string' && /^\\d{{4}}-\\d{{2}}-\\d{{2}}$/.test({camel}Raw)\n"
                    f"    ? {camel}Raw\n"
                    f"    : null;"
                )
            fields_to_return.append(camel)

        elif typ == "time":
            lines.append(
                f"  const {camel}Raw = inputData.{name};\n"
                f"  const {camel} = typeof {camel}Raw === 'string' && /^\\d{{2}}:\\d{{2}}/.test({camel}Raw)\n"
                f"    ? {camel}Raw\n"
                f"    : null;"
            )
            fields_to_return.append(camel)

        elif typ == "integer":
            if required:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  const {camel} = typeof {camel}Raw === 'number' && Number.isFinite({camel}Raw) ? {camel}Raw\n"
                    f"    : typeof {camel}Raw === 'string' ? Number.parseInt({camel}Raw, 10)\n"
                    f"    : Number.NaN;\n"
                    f"  if (!Number.isFinite({camel})) {{\n"
                    f"    throw new Error(\"input_data.{name} es requerido (entero)\");\n"
                    f"  }}"
                )
            else:
                lines.append(
                    f"  const {camel}Raw = inputData.{name};\n"
                    f"  const {camel} = typeof {camel}Raw === 'number' && Number.isFinite({camel}Raw) ? {camel}Raw\n"
                    f"    : typeof {camel}Raw === 'string' && Number.isFinite(Number.parseInt({camel}Raw, 10)) ? Number.parseInt({camel}Raw, 10)\n"
                    f"    : null;"
                )
            fields_to_return.append(camel)

        elif typ == "select":
            options = obj.get("options", [])
            if not options:
                lines.append(
                    f"  // FIXME: input '{name}' es 'select' sin options definidas. Edita manualmente."
                )
                continue
            options_ts = ", ".join(json.dumps(o) for o in options)
            lines.append(
                f"  const {camel}Raw = inputData.{name};\n"
                f"  if (typeof {camel}Raw !== 'string') {{\n"
                f"    throw new Error(\"input_data.{name} es requerido (string)\");\n"
                f"  }}\n"
                f"  const ALLOWED_{name.upper()} = [{options_ts}] as const;\n"
                f"  type {slug_to_pascal(name)}Type = typeof ALLOWED_{name.upper()}[number];\n"
                f"  if (!(ALLOWED_{name.upper()} as readonly string[]).includes({camel}Raw)) {{\n"
                f"    throw new Error(`input_data.{name} inválido: '${{{camel}Raw}}'. ` +\n"
                f"      `Valores permitidos: ${{ALLOWED_{name.upper()}.join(', ')}}`);\n"
                f"  }}\n"
                f"  const {camel} = {camel}Raw as {slug_to_pascal(name)}Type;"
            )
            fields_to_return.append(camel)

        else:
            lines.append(
                f"  // FIXME: tipo '{typ}' para input '{name}' no reconocido por scaffolder."
            )

    return "\n\n".join(lines), fields_to_return

# ---------------------------------------------------------------------------
# Generación del archivo prompt.ts
# ---------------------------------------------------------------------------

def emit_prompt_ts(slug: str, product: dict[str, Any]) -> str:
    pascal = slug_to_pascal(slug)
    short = slug_to_short(slug)

    return f'''/**
 * Prompt para el informe "{product['name_es']}" (slug: {slug}).
 *
 * Producto del catálogo:
 *   slug:               {slug}
 *   name_es:            {product['name_es']}
 *   tagline:            "{product['tagline']}"
 *   product_type:       {product['product_type']}
 *   tier:               {product['tier']} (€{float(product['price_eur']):.0f})
 *   theme_slug:         {product['theme_slug']}
 *   primary_color:      {product['primary_color']}
 *   accent_color:       {product['accent_color']}
 *   hero_icon:          {product['hero_icon']}
 *   word_count_target:  {product['word_count_target']}
 *   ai_model:           {product['ai_model']}
 *   estimated_minutes:  {product['estimated_minutes']}
 *
 * AUTO-GENERADO POR scripts/scaffold-generator.py
 * El SYSTEM_PROMPT siguiente es un PLACEHOLDER. Edítalo manualmente con el
 * conocimiento astrológico específico del producto antes de poner el worker
 * en producción.
 */

import type {{ NatalChart }} from '@/lib/astronomy/planets';

export interface {pascal}PromptInput {{
  userName: string;
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  chart: NatalChart;
  /** Tránsitos a la fecha clave del producto (definir según el caso) */
  transitChart: NatalChart;
  /** Día de la semana del evento (en español) */
  eventDayOfWeek: string;
  primaryColor: string;
  accentColor: string;
  templateHtml: string;
  // FIXME: añadir aquí los campos específicos del producto
  // (ej: vehicleType, currentAddress, projectType, etc.)
}}

export interface {pascal}Prompt {{
  system: string;
  user: string;
}}

// ============================================================
// SYSTEM PROMPT — PLACEHOLDER, EDITAR MANUALMENTE
// ============================================================
const SYSTEM_PROMPT = `Eres un astrólogo especializado en {product['name_es']} (TODO: refinar especialización exacta).

REGLAS DE REDACCIÓN:
1. Escribes en español de España, en segunda persona singular.
2. Cada afirmación se ancla en una posición astronómica concreta del input.
3. Tono pragmático, evita esoterismo vacío.
4. No inventas datos. Si no hay birth_time, no calculas ascendente.

REGLAS DE FORMATO HTML:
- Devuelves solo HTML semántico válido, SIN <html>, <head>, <body>.
- Usa <section class="{short}-section" id="seccion-{{N}}"> para cada sección.
- Títulos <h2> para cada sección, <h3> para subsecciones.
- <em> para términos técnicos, <strong> para alertas.
- Una tabla <table class="{short}-table"> máximo.

LONGITUD OBJETIVO: {product['word_count_target']} palabras.

TODO: añadir reglas específicas de {product['name_es']} aquí.`;

// ============================================================
// USER PROMPT BUILDER
// ============================================================

function formatChartBlock(chart: NatalChart, label: string): string {{
  const planets = [
    ['Sol',      chart.sun],
    ['Luna',     chart.moon],
    ['Mercurio', chart.mercury],
    ['Venus',    chart.venus],
    ['Marte',    chart.mars],
    ['Júpiter',  chart.jupiter],
    ['Saturno',  chart.saturn],
    ['Rahu',     chart.rahu],
    ['Ketu',     chart.ketu],
  ] as const;
  const lines: string[] = [`${{label}}:`];
  for (const [name, p] of planets) {{
    lines.push(
      `  ${{name.padEnd(10)}} ${{p.sign_tropical.padEnd(12)}} ` +
      `${{p.degree_in_sign_tropical.toFixed(2).padStart(6)}}° (trop) | ` +
      `${{p.sign_sidereal.padEnd(12)}} ${{p.degree_in_sign_sidereal.toFixed(2).padStart(6)}}° (sid)`,
    );
  }}
  if (chart.ascendant) {{
    lines.push(
      `  ${{'Ascend.'.padEnd(10)}} ${{chart.ascendant.sign_tropical.padEnd(12)}} ` +
      `${{chart.ascendant.degree_in_sign_tropical.toFixed(2).padStart(6)}}° (trop)`,
    );
  }} else {{
    lines.push('  Ascendente: no calculable (falta hora de nacimiento)');
  }}
  return lines.join('\\n');
}}

function findMajorTransits(natal: NatalChart, transit: NatalChart): string[] {{
  const ASPECTS: Array<[number, string]> = [
    [0, 'conjunción'], [60, 'sextil'], [90, 'cuadratura'],
    [120, 'trígono'], [180, 'oposición'],
  ];
  const ORB = 6;
  const natalPlanets: Array<[string, number]> = [
    ['Sol', natal.sun.longitude_tropical],
    ['Luna', natal.moon.longitude_tropical],
    ['Mercurio', natal.mercury.longitude_tropical],
    ['Venus', natal.venus.longitude_tropical],
    ['Marte', natal.mars.longitude_tropical],
    ['Júpiter', natal.jupiter.longitude_tropical],
    ['Saturno', natal.saturn.longitude_tropical],
  ];
  const transitPlanets: Array<[string, number]> = [
    ['Sol-tr', transit.sun.longitude_tropical],
    ['Luna-tr', transit.moon.longitude_tropical],
    ['Mercurio-tr', transit.mercury.longitude_tropical],
    ['Venus-tr', transit.venus.longitude_tropical],
    ['Marte-tr', transit.mars.longitude_tropical],
    ['Júpiter-tr', transit.jupiter.longitude_tropical],
    ['Saturno-tr', transit.saturn.longitude_tropical],
  ];
  const out: string[] = [];
  for (const [tName, tLon] of transitPlanets) {{
    for (const [nName, nLon] of natalPlanets) {{
      let diff = Math.abs(tLon - nLon) % 360;
      if (diff > 180) diff = 360 - diff;
      for (const [angle, aspectName] of ASPECTS) {{
        const orb = Math.abs(diff - angle);
        if (orb < ORB) {{
          const sign = orb < 1 ? '⚠️' : orb < 3 ? '◉' : '◯';
          out.push(`${{sign}} ${{tName}} ${{aspectName}} ${{nName}} (orbe ${{orb.toFixed(1)}}°)`);
        }}
      }}
    }}
  }}
  return out;
}}

export function build{pascal}Prompt(input: {pascal}PromptInput): {pascal}Prompt {{
  const {{
    userName, birthDate, birthTime, birthPlace,
    chart, transitChart, eventDayOfWeek,
    primaryColor, accentColor, templateHtml,
  }} = input;

  const natalBlock = formatChartBlock(chart, 'CARTA NATAL');
  const transitBlock = formatChartBlock(transitChart, 'TRÁNSITOS al evento');
  const aspects = findMajorTransits(chart, transitChart);
  const aspectsBlock = aspects.length > 0
    ? aspects.map(a => `  ${{a}}`).join('\\n')
    : '  (Sin aspectos mayores con orbe < 6°)';

  const templateExcerpt = templateHtml.length > 8000
    ? templateHtml.slice(0, 8000) + '\\n<!-- ... template continúa, truncado ... -->'
    : templateHtml;

  const userPrompt = `Genera el informe "{product['name_es']}" para ${{userName}}.

DATOS DEL TITULAR
=================
Nombre: ${{userName}}
Fecha de nacimiento: ${{birthDate}}
Hora de nacimiento: ${{birthTime ?? '(no disponible)'}}
Lugar de nacimiento: ${{birthPlace ?? '(no especificado)'}}

POSICIONES PLANETARIAS
======================
${{natalBlock}}

${{transitBlock}}

ASPECTOS MAYORES (tránsito → natal, orbe < 6°)
==============================================
${{aspectsBlock}}

PALETA VISUAL: primario ${{primaryColor}}, acento ${{accentColor}} (no usar en HTML que devuelves).

REFERENCIA DE ESTILO (template):
\\`\\`\\`html
${{templateExcerpt}}
\\`\\`\\`

INSTRUCCIONES FINALES:
1. Genera HTML semántico siguiendo las reglas del system prompt.
2. Empieza con <section class="{short}-section" id="seccion-1">
3. NO incluyas <html>, <head>, <body>, ni texto fuera de las <section>.

Comienza ahora.`;

  return {{ system: SYSTEM_PROMPT, user: userPrompt }};
}}
'''

# ---------------------------------------------------------------------------
# Generación del archivo generate.ts
# ---------------------------------------------------------------------------

def emit_generate_ts(slug: str, product: dict[str, Any]) -> str:
    pascal = slug_to_pascal(slug)
    camel = slug_to_camel(slug)
    short = slug_to_short(slug)
    primary = product["primary_color"]
    accent = product["accent_color"]

    validate_block, _ = emit_validate_inputs_ts(product["required_inputs"])

    return f'''/**
 * Orchestrator del generador "{product['name_es']}" (slug: {slug}).
 *
 * AUTO-GENERADO POR scripts/scaffold-generator.py a partir del template
 * de evento-vehiculo. Tras scaffoldear, revisa:
 *   1. El SYSTEM_PROMPT en ./prompt.ts (debes redactarlo manualmente)
 *   2. La interface {pascal}PromptInput (puede necesitar campos extra)
 *   3. El cuerpo de validateInputs() — completa los campos específicos
 *   4. El wrapInHtmlDocument — adapta el header con el copy del producto
 */

import {{ createAdminClient }} from '@/lib/supabase/admin';
import {{ generateWithSonnet }} from '@/lib/ai/sonnet';
import {{ computeNatalChart }} from '@/lib/astronomy/planets';
import {{ loadTemplate }} from '@/lib/generators/_shared/template-loader';
import {{
  resolveBirthData,
  countWords,
  escapeHtml,
}} from '@/lib/generators/_shared/birth-data';
import {{
  sanitizeGeneratedHtml,
  assertValidReportHtml,
}} from '@/lib/generators/_shared/html-sanitizer';
import {{
  markGenerationStarted,
  markGenerationReady,
  markGenerationError,
}} from '@/lib/generators/_shared/report-updater';
import {{ build{pascal}Prompt }} from './prompt';

const SLUG = '{slug}';
const PRIMARY_COLOR = '{primary}';
const ACCENT_COLOR = '{accent}';
const MIN_OUTPUT_WORDS = 800;
const MAX_TOKENS = 12000;
const TEMPERATURE = 0.65;

export interface Generate{pascal}Result {{
  html: string;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  model_used: string;
  word_count: number;
}}

const DAY_OF_WEEK_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
] as const;

// ---------------------------------------------------------------------------
// Validación de inputs específicos
// ---------------------------------------------------------------------------

interface {pascal}Inputs {{
  // FIXME: añadir aquí los nombres y tipos de campos retornados
  // según el cuerpo de validateInputs() generado abajo.
  eventDayOfWeek: string;
  eventDateUTC: Date;
}}

function validateInputs(inputData: Record<string, unknown>): {pascal}Inputs {{
{validate_block}

  // FIXME: detectar el campo "principal" de fecha (date_target / event_date / etc.)
  // y construir Date UTC + day_of_week. El scaffolder usa el primer campo `date`
  // que encuentra como referencia temporal. Ajusta si tu producto tiene varios.
  // Actualmente apunta a `_TODO_DATE_FIELD_` — reemplaza por el nombre real.

  const dateForTransit = ''; // FIXME: poner aquí el campo de fecha principal
  const eventDateUTC = new Date(`${{dateForTransit}}T12:00:00Z`);
  if (Number.isNaN(eventDateUTC.getTime())) {{
    throw new Error(`Fecha del evento no válida: '${{dateForTransit}}'`);
  }}
  const eventDayOfWeek = DAY_OF_WEEK_ES[eventDateUTC.getUTCDay()]!;

  return {{
    // FIXME: devolver aquí todos los campos validados arriba
    eventDayOfWeek,
    eventDateUTC,
  }};
}}

// ---------------------------------------------------------------------------
// Wrapper visual
// ---------------------------------------------------------------------------

function wrapInHtmlDocument(innerHtml: string, userName: string): string {{
  const userNameEsc = escapeHtml(userName);
  return `<article class="{short}-report" data-product="{slug}" data-user="${{userNameEsc}}">
<header class="{short}-report-header">
  <p class="{short}-report-eyebrow">{product['name_es']} · AstroDorado</p>
  <h1>{product['tagline']}, ${{userNameEsc}}</h1>
  <p class="{short}-report-subtitle">{product['short_description']}</p>
</header>
${{innerHtml}}
<footer class="{short}-report-footer">
  <p>Este informe es un análisis astrológico complementario al juicio profesional. Toma siempre las precauciones materiales que correspondan.</p>
</footer>
</article>`;
}}

// ---------------------------------------------------------------------------
// Función pública principal
// ---------------------------------------------------------------------------

export async function generate{pascal}(userReportId: string): Promise<Generate{pascal}Result> {{
  if (!userReportId) {{
    throw new Error('generate{pascal}: userReportId requerido');
  }}
  const supabase = createAdminClient();

  const {{ data: ur, error: urErr }} = await supabase
    .from('astrodorado_user_reports')
    .select('id, user_id, report_slug, input_data, status')
    .eq('id', userReportId)
    .single();
  if (urErr || !ur) {{
    throw new Error(`user_report ${{userReportId}} no encontrado: ${{urErr?.message ?? 'unknown'}}`);
  }}
  if (ur.report_slug !== SLUG) {{
    throw new Error(`report_slug esperado '${{SLUG}}', recibido '${{ur.report_slug}}'`);
  }}
  if (ur.status === 'ready') {{
    throw new Error(`user_report ${{userReportId}} ya está en status='ready'.`);
  }}

  const inputData = (ur.input_data ?? {{}}) as Record<string, unknown>;
  const validated = validateInputs(inputData);

  let resolvedBirth;
  try {{
    resolvedBirth = resolveBirthData(inputData, '');
  }} catch {{
    const {{ data: user, error: userErr }} = await supabase
      .from('astrodorado_users')
      .select('id, email, birth_date, birth_time, birth_place')
      .eq('id', ur.user_id)
      .single();
    if (userErr || !user || !user.birth_date) {{
      throw new Error(
        `Sin datos de nacimiento para user ${{ur.user_id}}: ${{userErr?.message ?? 'no birth_date'}}`,
      );
    }}
    const fallback = user.email?.split('@')[0] ?? 'cliente';
    resolvedBirth = resolveBirthData(
      {{ person: {{ name: fallback, birth_date: user.birth_date, birth_time: user.birth_time, birth_place: user.birth_place }} }},
      fallback,
    );
  }}

  const template = await loadTemplate(SLUG);
  if (!template) {{
    throw new Error(`No hay template activo para slug='${{SLUG}}' en astrodorado.report_templates.`);
  }}

  const natalChart = computeNatalChart(
    resolvedBirth.birth_date_utc,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );
  const transitChart = computeNatalChart(
    validated.eventDateUTC,
    resolvedBirth.coords.lat,
    resolvedBirth.coords.lng,
  );

  await markGenerationStarted(userReportId);

  try {{
    const {{ system, user: userPrompt }} = build{pascal}Prompt({{
      userName: resolvedBirth.name,
      birthDate: resolvedBirth.birth_date,
      birthTime: resolvedBirth.birth_time ?? undefined,
      birthPlace: resolvedBirth.birth_place ?? undefined,
      chart: natalChart,
      transitChart,
      eventDayOfWeek: validated.eventDayOfWeek,
      primaryColor: PRIMARY_COLOR,
      accentColor: ACCENT_COLOR,
      templateHtml: template.html_template,
      // FIXME: añadir aquí los campos específicos del producto
    }});

    const ai = await generateWithSonnet({{
      system, user: userPrompt,
      max_tokens: MAX_TOKENS, temperature: TEMPERATURE,
    }});

    const sanitized = sanitizeGeneratedHtml(ai.content);
    if (sanitized.removed.scripts > 0 || sanitized.removed.iframes > 0 || sanitized.removed.inlineHandlers > 0) {{
      // eslint-disable-next-line no-console
      console.warn(`[{slug}] sanitizer eliminó contenido sospechoso:`, sanitized.removed);
    }}

    const finalHtml = wrapInHtmlDocument(sanitized.html, resolvedBirth.name);
    assertValidReportHtml(finalHtml);

    const wordCount = countWords(finalHtml);
    if (wordCount < MIN_OUTPUT_WORDS) {{
      throw new Error(`HTML solo tiene ${{wordCount}} palabras (mín ${{MIN_OUTPUT_WORDS}}).`);
    }}

    const tokensUsed = ai.tokens_in + ai.tokens_out;
    await markGenerationReady(userReportId, {{
      output_html: finalHtml,
      tokens_used: tokensUsed,
      model_used: ai.model_used,
      actual_cost_usd: ai.cost_usd,
      generation_duration_ms: ai.duration_ms,
    }});

    return {{
      html: finalHtml,
      tokens_used: tokensUsed,
      cost_usd: ai.cost_usd,
      duration_ms: ai.duration_ms,
      model_used: ai.model_used,
      word_count: wordCount,
    }};
  }} catch (err) {{
    const message = err instanceof Error ? err.message : String(err);
    try {{
      await markGenerationError(userReportId, message);
    }} catch (markErr) {{
      // eslint-disable-next-line no-console
      console.error(`[{slug}] markGenerationError falló:`, markErr);
    }}
    throw err;
  }}
}}
'''

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def scaffold_one(slug: str, catalog: list[dict[str, Any]], dry_run: bool) -> bool:
    if slug in UNSUPPORTED_SLUGS:
        print(f"  ⏭️  {slug}: en UNSUPPORTED_SLUGS — sálta scaffolder, implementa manualmente")
        return False

    product = get_product(catalog, slug)
    out_dir = GENERATORS_DIR / slug
    prompt_path = out_dir / "prompt.ts"
    generate_path = out_dir / "generate.ts"

    if prompt_path.exists() or generate_path.exists():
        print(f"  ⚠️  {slug}: ya existen archivos — no sobrescribe (usa --force)")
        return False

    prompt_content = emit_prompt_ts(slug, product)
    generate_content = emit_generate_ts(slug, product)

    if dry_run:
        print(f"  [DRY] {slug}: generaría {len(prompt_content)} + {len(generate_content)} bytes")
        return True

    out_dir.mkdir(parents=True, exist_ok=True)
    prompt_path.write_text(prompt_content)
    generate_path.write_text(generate_content)
    print(f"  ✅ {slug}: {prompt_path.relative_to(REPO_ROOT)} + {generate_path.relative_to(REPO_ROOT)}")
    print(f"     RECUERDA: editar manualmente SYSTEM_PROMPT y los FIXME en validateInputs/buildPrompt")
    return True

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", help="Slug a scaffoldear")
    parser.add_argument("--all-electives", action="store_true", help="Scaffoldea todos los productos del Reino Eventos no implementados")
    parser.add_argument("--dry-run", action="store_true", help="No escribe archivos")
    args = parser.parse_args()

    if not args.slug and not args.all_electives:
        parser.print_help()
        sys.exit(1)

    catalog = load_catalog()
    print(f"Catálogo cargado: {len(catalog)} productos")

    if args.slug:
        scaffold_one(args.slug, catalog, args.dry_run)
    elif args.all_electives:
        eventos = [p for p in catalog if p["category"] == "eventos" and not p["is_bundle"]]
        print(f"Productos Reino Eventos no-bundle: {len(eventos)}")
        for p in eventos:
            scaffold_one(p["slug"], catalog, args.dry_run)

    print("")
    print("Tras scaffoldear, no olvides:")
    print("  1. Editar SYSTEM_PROMPT en cada prompt.ts")
    print("  2. Completar los FIXME en validateInputs() de cada generate.ts")
    print("  3. Añadir el worker a scripts/test-generator.ts (WORKERS + INPUT_FIXTURES)")
    print("  4. Ingestar el template HTML: npm run ingest:one -- --slug=<SLUG>")
    print("  5. Probar: npx tsx scripts/test-generator.ts --slug=<SLUG>")

if __name__ == "__main__":
    main()
