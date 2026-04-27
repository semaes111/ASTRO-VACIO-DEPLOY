#!/usr/bin/env tsx
/**
 * scripts/test-generator.ts — Test E2E genérico para cualquier worker.
 *
 * Versión parametrizable de `test-evento-vehiculo.ts`. Acepta `--slug=X`
 * y construye el `input_data` apropiado según el `required_inputs` del
 * producto en DB. Esto permite probar cualquier worker recién scaffoldeado
 * sin escribir un test específico.
 *
 * Workers soportados directamente (con input_data preconfigurado):
 *   - evento-vehiculo
 *   - evento-mudanza
 *   - (los siguientes se irán añadiendo a INPUT_FIXTURES)
 *
 * Para workers no soportados directamente, usa --input='{...}' con JSON.
 *
 * Uso:
 *
 *     npx tsx scripts/test-generator.ts --slug=evento-vehiculo
 *     npx tsx scripts/test-generator.ts --slug=evento-mudanza
 *     npx tsx scripts/test-generator.ts --slug=evento-mudanza --keep
 *     npx tsx scripts/test-generator.ts --slug=evento-X \
 *         --input='{"foo":"bar","date_x":"2026-06-01"}'
 *
 * Pre-requisitos:
 *   - Migración 20260422_create_report_templates_view.sql aplicada (ya hecha)
 *   - Template ingestado:
 *       npm run ingest:one -- --slug=<SLUG>
 *   - Worker registrado en `WORKERS` (ver más abajo en este archivo)
 *   - .env.local con NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { generateEventoVehiculo } from '../lib/generators/evento-vehiculo/generate';
import { generateEventoMudanza } from '../lib/generators/evento-mudanza/generate';

// ---------------------------------------------------------------------------
// Registry de workers (añade aquí cuando scaffolds un nuevo worker)
// ---------------------------------------------------------------------------

type GeneratorResult = {
  html: string;
  tokens_used: number;
  cost_usd: number;
  duration_ms: number;
  model_used: string;
  word_count: number;
};
type GeneratorFn = (userReportId: string) => Promise<GeneratorResult>;

const WORKERS: Record<string, GeneratorFn> = {
  'evento-vehiculo': generateEventoVehiculo,
  'evento-mudanza':  generateEventoMudanza,
  // Cuando añadas un worker nuevo, importa arriba y añade la línea aquí:
  // 'evento-viaje': generateEventoViaje,
};

// ---------------------------------------------------------------------------
// Fixtures de input_data por producto
// ---------------------------------------------------------------------------
//
// Estos son inputs sintéticos válidos para cada producto. Los datos del
// titular son comunes (TEST_PERSON). Los inputs específicos del evento
// se rellenan según el `required_inputs` del producto en DB.

const TEST_USER_EMAIL = 'test-generator@nexthorizont.test';
const TEST_PERSON = {
  name: 'Sergio Test',
  birth_date: '1980-07-12',
  birth_time: '14:30',
  birth_place: 'Almería',
};

/** Fecha futura realista a 30 días */
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  .toISOString()
  .slice(0, 10);

const INPUT_FIXTURES: Record<string, Record<string, unknown>> = {
  'evento-vehiculo': {
    person: TEST_PERSON,
    vehicle_type: 'coche',
    purchase_date_target: FUTURE_DATE,
  },
  'evento-mudanza': {
    person: TEST_PERSON,
    current_address: 'Calle del Mar 12, 04700 El Ejido, Almería',
    new_address: 'Avenida del Pacífico 45, 04007 Almería',
    move_date_target: FUTURE_DATE,
  },
  // Cuando añadas un worker nuevo, añade su fixture aquí.
};

// ---------------------------------------------------------------------------
// Setup del cliente
// ---------------------------------------------------------------------------

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      '❌ Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.',
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Argumentos CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  slug: string;
  input: Record<string, unknown> | null;
  keep: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let slug = '';
  let inputJson: string | null = null;
  let keep = false;

  for (const arg of argv) {
    if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--input=')) inputJson = arg.slice('--input='.length);
    else if (arg === '--keep') keep = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!slug) {
    console.error('❌ --slug=<slug> es obligatorio.');
    printHelp();
    process.exit(1);
  }

  let input: Record<string, unknown> | null = null;
  if (inputJson) {
    try {
      const parsed = JSON.parse(inputJson) as Record<string, unknown>;
      input = parsed;
    } catch (err) {
      console.error(`❌ --input no es JSON válido: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  return { slug, input, keep };
}

function printHelp(): void {
  console.log(`
Uso:
  npx tsx scripts/test-generator.ts --slug=<SLUG> [--input='{...}'] [--keep]

Opciones:
  --slug=<SLUG>     (obligatorio) Producto a probar. Ejemplos:
                       evento-vehiculo, evento-mudanza
  --input='{...}'   (opcional) JSON con input_data custom. Si no se pasa,
                       se usa el fixture predefinido para ese slug.
  --keep            No borra el user_report al final (útil para inspección).
  --help, -h        Muestra esta ayuda.

Workers registrados:
${Object.keys(WORKERS).map(s => `  - ${s}`).join('\n')}
  `.trim());
}

// ---------------------------------------------------------------------------
// Setup: crear/reutilizar user de pruebas
// ---------------------------------------------------------------------------

async function ensureTestUser(): Promise<string> {
  const supabase = getClient();
  const { data: existing, error: selErr } = await supabase
    .from('astrodorado_users')
    .select('id')
    .eq('email', TEST_USER_EMAIL)
    .maybeSingle();
  if (selErr) {
    throw new Error(`ensureTestUser select: ${selErr.message}`);
  }
  if (existing?.id) {
    log(`→ User de pruebas ya existe: ${existing.id}`);
    return existing.id as string;
  }

  const { data: created, error: insErr } = await supabase
    .from('astrodorado_users')
    .insert({
      email: TEST_USER_EMAIL,
      birth_date: TEST_PERSON.birth_date,
      birth_time: TEST_PERSON.birth_time,
      birth_place: TEST_PERSON.birth_place,
    })
    .select('id')
    .single();
  if (insErr || !created) {
    throw new Error(`ensureTestUser insert: ${insErr?.message ?? 'no rows'}`);
  }
  log(`→ User de pruebas creado: ${created.id}`);
  return created.id as string;
}

// ---------------------------------------------------------------------------
// Crear user_report
// ---------------------------------------------------------------------------

async function createTestUserReport(
  userId: string,
  slug: string,
  inputData: Record<string, unknown>,
): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('astrodorado_user_reports')
    .insert({
      user_id: userId,
      report_slug: slug,
      status: 'paid',
      input_data: inputData,
      amount_paid_eur: 29,
      was_vip_discount_applied: false,
      purchased_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`createTestUserReport: ${error?.message ?? 'no rows'}`);
  }
  log(`→ user_report creado: ${data.id}`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanupUserReport(reportId: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('astrodorado_user_reports')
    .delete()
    .eq('id', reportId);
  if (error) {
    log(`⚠️ cleanup falló: ${error.message}`, 'warn');
  } else {
    log(`→ user_report ${reportId} eliminado`);
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const ts = new Date().toISOString().slice(11, 23);
  const icon = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '·';
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${icon} ${msg}`);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Resolver worker
  const worker = WORKERS[args.slug];
  if (!worker) {
    console.error(
      `❌ Worker no registrado para slug '${args.slug}'. ` +
        `Workers disponibles: ${Object.keys(WORKERS).join(', ')}`,
    );
    process.exit(1);
  }

  // Resolver inputs
  const inputData = args.input ?? INPUT_FIXTURES[args.slug];
  if (!inputData) {
    console.error(
      `❌ No hay fixture para slug '${args.slug}' y no se pasó --input. ` +
        'Añade un fixture en INPUT_FIXTURES o pasa --input con JSON.',
    );
    process.exit(1);
  }

  log(`🚀 Test E2E: ${args.slug}`);
  log(`   Persona:  ${TEST_PERSON.name} · ${TEST_PERSON.birth_date} ${TEST_PERSON.birth_time} ${TEST_PERSON.birth_place}`);
  log(`   Inputs:   ${JSON.stringify(inputData).slice(0, 100)}…`);

  let userId: string | null = null;
  let reportId: string | null = null;

  try {
    // 1. Setup
    userId = await ensureTestUser();
    reportId = await createTestUserReport(userId, args.slug, inputData);

    // 2. Lanzar worker
    log(`⚙️  Llamando a generator de '${args.slug}'... (15-30s típicos)`);
    const t0 = Date.now();
    const result = await worker(reportId);
    const total = Date.now() - t0;

    // 3. Verificar
    log('');
    log('✅ Generación completada');
    log(`   Tokens:    ${result.tokens_used.toLocaleString('es-ES')}`);
    log(`   Coste:     $${result.cost_usd.toFixed(4)}`);
    log(`   Duración:  ${result.duration_ms}ms (worker) + ${total - result.duration_ms}ms (overhead)`);
    log(`   Modelo:    ${result.model_used}`);
    log(`   Palabras:  ${result.word_count.toLocaleString('es-ES')}`);
    log(`   HTML size: ${fmtBytes(Buffer.byteLength(result.html, 'utf8'))}`);
    log('');
    log('   Preview (primeros 200 chars):');
    log(`   ${result.html.slice(0, 200).replace(/\n/g, ' ')}…`);

    // 4. Verificación de invariantes
    log('');
    log('🔎 Verificaciones genéricas:');
    const checks: Array<[string, boolean]> = [
      ['HTML empieza con <article', result.html.trimStart().startsWith('<article')],
      ['HTML termina con </article>', result.html.trimEnd().endsWith('</article>')],
      ['Contiene <section>', result.html.includes('<section')],
      ['Contiene 5+ secciones', (result.html.match(/<section/g) ?? []).length >= 5],
      ['No tiene scripts', !/<script/i.test(result.html)],
      ['No tiene iframes', !/<iframe/i.test(result.html)],
      ['No tiene "undefined" suelto', !/\bundefined\b/.test(result.html)],
      ['No tiene "NaN" suelto', !/\bNaN\b/.test(result.html)],
      ['Word count > 800', result.word_count > 800],
      ['Coste razonable < $0.30', result.cost_usd < 0.3],
    ];
    let okAll = true;
    for (const [desc, pass] of checks) {
      log(`   ${pass ? '✓' : '✗'} ${desc}`, pass ? 'info' : 'error');
      if (!pass) okAll = false;
    }

    if (!okAll) {
      log('');
      log('Algunas verificaciones fallaron. Inspecciona el output_html en la DB:', 'error');
      log(`   SELECT output_html FROM astrodorado.user_reports WHERE id = '${reportId}';`);
      process.exit(2);
    }

    log('');
    log(`✅ Test E2E '${args.slug}' PASÓ`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Test E2E '${args.slug}' FALLÓ: ${msg}`, 'error');
    if (err instanceof Error && err.stack) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    if (reportId && !args.keep) {
      await cleanupUserReport(reportId);
    } else if (reportId && args.keep) {
      log(`(--keep activo) user_report ${reportId} preservado para inspección manual`);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error no capturado:', err);
  process.exit(1);
});
