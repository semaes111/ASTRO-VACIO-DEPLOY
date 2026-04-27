#!/usr/bin/env tsx
/**
 * scripts/test-evento-vehiculo.ts — Test E2E del worker `evento-vehiculo`.
 *
 * Crea un user_report sintético, llama al worker, verifica el resultado y
 * limpia. NO toca Stripe ni el cliente real — solo prueba el pipeline:
 *
 *     [user fake] → user_report fake → worker → output_html → cleanup
 *
 * Uso:
 *
 *     npx tsx scripts/test-evento-vehiculo.ts
 *     npx tsx scripts/test-evento-vehiculo.ts --keep   # no limpia, deja la fila
 *     npx tsx scripts/test-evento-vehiculo.ts --slug=evento-vehiculo
 *
 * Pre-requisitos:
 *   - Migración 20260422_create_report_templates_view.sql aplicada (ya hecha)
 *   - Template ingestado:
 *       npm run ingest:one -- --slug=evento-vehiculo
 *   - .env.local con:
 *       NEXT_PUBLIC_SUPABASE_URL
 *       SUPABASE_SERVICE_ROLE_KEY
 *       ANTHROPIC_API_KEY
 *
 * Salida esperada (caso éxito):
 *
 *     ✅ Test E2E evento-vehiculo: OK
 *        Tokens:   ~7800
 *        Coste:    ~$0.078
 *        Duración: ~24500ms
 *        Palabras: ~5500
 *        HTML preview: <article class="ev-report" ...
 */

import { createClient } from '@supabase/supabase-js';
import { generateEventoVehiculo } from '../lib/generators/evento-vehiculo/generate';

// ---------------------------------------------------------------------------
// Configuración del test
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = 'test-evento-vehiculo@nexthorizont.test';
const TEST_PERSON = {
  name: 'Sergio Test',
  birth_date: '1980-07-12',  // Sun en Cancer 19°, igual que Sergio real
  birth_time: '14:30',
  birth_place: 'Almería',
};
const TEST_PURCHASE = {
  vehicle_type: 'coche' as const,
  // 30 días desde hoy — fecha futura realista
  purchase_date_target: new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10),
};

// ---------------------------------------------------------------------------
// Setup del cliente (independiente de Next.js — lo invocamos desde Node CLI)
// ---------------------------------------------------------------------------

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Setup: crear (o reutilizar) el user de pruebas
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
// Setup: crear un user_report nuevo en estado pending
// ---------------------------------------------------------------------------

async function createTestUserReport(userId: string): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('astrodorado_user_reports')
    .insert({
      user_id: userId,
      report_slug: 'evento-vehiculo',
      status: 'paid', // saltamos pending_payment para poder generar
      input_data: {
        person: TEST_PERSON,
        vehicle_type: TEST_PURCHASE.vehicle_type,
        purchase_date_target: TEST_PURCHASE.purchase_date_target,
      },
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
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');

  log('🚀 Test E2E: evento-vehiculo');
  log(`   Persona: ${TEST_PERSON.name} · ${TEST_PERSON.birth_date} ${TEST_PERSON.birth_time} ${TEST_PERSON.birth_place}`);
  log(`   Compra:  ${TEST_PURCHASE.vehicle_type} · ${TEST_PURCHASE.purchase_date_target}`);

  let userId: string | null = null;
  let reportId: string | null = null;

  try {
    // 1. Setup
    userId = await ensureTestUser();
    reportId = await createTestUserReport(userId);

    // 2. Lanzar worker
    log('⚙️  Llamando a generateEventoVehiculo... (esto tarda 15-30s)');
    const t0 = Date.now();
    const result = await generateEventoVehiculo(reportId);
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
    log('🔎 Verificaciones:');
    const checks: Array<[string, boolean]> = [
      ['HTML empieza con <article', result.html.trimStart().startsWith('<article')],
      ['HTML termina con </article>', result.html.trimEnd().endsWith('</article>')],
      ['Contiene <section>', result.html.includes('<section')],
      ['Contiene 5 secciones', (result.html.match(/<section/g) ?? []).length >= 5],
      ['No tiene scripts', !/<script/i.test(result.html)],
      ['No tiene iframes', !/<iframe/i.test(result.html)],
      ['No tiene "undefined"', !/\bundefined\b/.test(result.html)],
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
      log('Algunas verificaciones fallaron. Revisa el output_html en la DB:', 'error');
      log(`   SELECT output_html FROM astrodorado.user_reports WHERE id = '${reportId}';`);
      process.exit(2);
    }

    log('');
    log('✅ Test E2E PASÓ');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Test E2E FALLÓ: ${msg}`, 'error');
    if (err instanceof Error && err.stack) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    if (reportId && !keep) {
      await cleanupUserReport(reportId);
    } else if (reportId && keep) {
      log(`(--keep activo) user_report ${reportId} preservado para inspección manual`);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error no capturado:', err);
  process.exit(1);
});
