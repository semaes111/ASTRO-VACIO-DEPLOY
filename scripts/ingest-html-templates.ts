/**
 * scripts/ingest-html-templates.ts
 *
 * Pipeline de ingesta: zips de HTMLs (Kimi/Bolt) → tabla astrodorado.report_templates
 *
 * Flujo:
 *   1. Desempaqueta cada zip en /tmp/astrodorado-ingest/{slug}/
 *   2. Localiza el .html principal dentro del zip
 *   3. Lanza Puppeteer headless, carga el HTML, espera a que React hidrate
 *   4. Captura el outerHTML del documento ya renderizado
 *   5. Limpia scripts React/Babel de unpkg y postMessage edit-mode
 *   6. Valida tamaño < 500 KB (warning si mayor)
 *   7. Inserta en astrodorado.report_templates como source='puppeteer_render'
 *   8. Activa la nueva versión desactivando la anterior (transaccional)
 *
 * Uso:
 *   npx tsx scripts/ingest-html-templates.ts --dry-run
 *   npx tsx scripts/ingest-html-templates.ts --slug=evento-vehiculo
 *   npx tsx scripts/ingest-html-templates.ts --all
 *
 * Env vars requeridas:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INGEST_ZIPS_DIR          (path a la carpeta con los .zip, default: ./zips)
 *   INGEST_WORK_DIR          (scratch dir, default: /tmp/astrodorado-ingest)
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer, { type Browser, type Page } from 'puppeteer';

// =====================================================
// CONFIGURACIÓN
// =====================================================

interface SlugMapping {
  slug: string;
  zipFileName: string;
  displayName: string;
}

/**
 * Mapa declarativo zip → slug del catálogo.
 * El slug DEBE coincidir exactamente con astrodorado.reports.slug.
 * Los zips son nombres de archivo literales en INGEST_ZIPS_DIR.
 */
const SLUG_MAPPINGS: SlugMapping[] = [
  // Oráculo
  { slug: 'carta-natal', zipFileName: 'Kimi_Agent_Diseño Carta Natal.zip', displayName: 'Carta Natal' },
  { slug: 'revolucion-solar', zipFileName: 'Kimi_Agent_Revolución Solar Web.zip', displayName: 'Revolución Solar' },
  { slug: 'numerologia', zipFileName: 'Kimi_Agent_Diseño web Numerología Personal.zip', displayName: 'Numerología' },
  { slug: 'iching', zipFileName: 'Kimi_Agent_I-Ching Personal Web.zip', displayName: 'I-Ching' },
  { slug: 'kabbalah', zipFileName: 'Kimi_Agent_Diseño Web Cábala AstroDorado.zip', displayName: 'Kabbalah' },
  { slug: 'karma', zipFileName: 'Kimi_Agent_Karma y Vidas Pasadas Web.zip', displayName: 'Karma' },
  // Relaciones
  { slug: 'pareja-sinastria', zipFileName: 'Kimi_Agent_Web Sinastría de Pareja.zip', displayName: 'Sinastría Pareja' },
  { slug: 'familiar', zipFileName: 'Kimi_Agent_Compatibilidad Familiar Web.zip', displayName: 'Compatibilidad Familiar' },
  { slug: 'amistad-karmica', zipFileName: 'Kimi_Agent_Diseño web Amistad Kármica.zip', displayName: 'Amistad Kármica' },
  { slug: 'relaciones-360', zipFileName: 'Kimi_Agent_Relaciones 360 Bundle.zip', displayName: 'Relaciones 360' },
  // Eventos
  { slug: 'evento-boda', zipFileName: 'BODA.zip', displayName: 'Elección de Boda' },
  { slug: 'evento-firma-juicio', zipFileName: 'CONTRATO JUICIO.zip', displayName: 'Firma Contrato / Juicio' },
  { slug: 'evento-inmueble', zipFileName: 'CASA.zip', displayName: 'Compra Inmueble' },
  { slug: 'evento-vehiculo', zipFileName: 'vehiculo.zip', displayName: 'Compra Vehículo' },
  // Negocios
  { slug: 'neg-carta-empresa', zipFileName: 'Kimi_Agent_Carta Natal Empresarial.zip', displayName: 'Carta Natal Empresarial' },
  { slug: 'neg-financiero-anual', zipFileName: 'Kimi_Agent_Año Financiero Web.zip', displayName: 'Año Financiero' },
  { slug: 'neg-marca-timing', zipFileName: 'MARCA.zip', displayName: 'Timing de Marca' },
];

const ZIPS_DIR = process.env.INGEST_ZIPS_DIR ?? './zips';
const WORK_DIR = process.env.INGEST_WORK_DIR ?? '/tmp/astrodorado-ingest';
const MAX_TEMPLATE_BYTES = 500 * 1024; // 500 KB
const HYDRATION_TIMEOUT_MS = 15_000;
const MAX_RETRIES_PER_TEMPLATE = 2;

// =====================================================
// LOGGING ESTRUCTURADO
// =====================================================

type LogLevel = 'info' | 'warn' | 'error' | 'success';

function log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  const emoji = { info: '🔵', warn: '🟡', error: '🔴', success: '🟢' }[level];
  const timestamp = new Date().toISOString().slice(11, 19);
  const ctx = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  console.log(`${emoji} [${timestamp}] ${message}${ctx}`);
}

// =====================================================
// CLI ARG PARSING
// =====================================================

interface CliArgs {
  dryRun: boolean;
  slugFilter: string | null;
  runAll: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const runAll = argv.includes('--all');
  const slugArg = argv.find((a) => a.startsWith('--slug='));
  const slugFilter = slugArg ? slugArg.split('=')[1] ?? null : null;

  if (!dryRun && !runAll && !slugFilter) {
    console.error('❌ Debes pasar --dry-run, --all, o --slug=<slug>');
    console.error('   Ejemplos:');
    console.error('     npx tsx scripts/ingest-html-templates.ts --dry-run');
    console.error('     npx tsx scripts/ingest-html-templates.ts --slug=evento-vehiculo');
    console.error('     npx tsx scripts/ingest-html-templates.ts --all');
    process.exit(1);
  }

  return { dryRun, slugFilter, runAll };
}

// =====================================================
// UNZIP (cross-platform: unzip en Linux/Mac, tar -xf en Windows 10+, idempotente)
// =====================================================

function unzipToDir(zipPath: string, targetDir: string): void {
  if (!existsSync(zipPath)) {
    throw new Error(`Zip no encontrado: ${zipPath}`);
  }

  // Limpiar dir previo para idempotencia
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  try {
    if (process.platform === 'win32') {
      // Windows 10+ trae tar.exe (bsdtar) nativo que descomprime zips.
      // Más fiable que Expand-Archive con caracteres especiales (ñ, Á, espacios).
      execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'pipe' });
    } else {
      // Linux/Mac: usar unzip system binary
      execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'pipe' });
    }
  } catch (err) {
    throw new Error(`Fallo al descomprimir ${basename(zipPath)}: ${(err as Error).message}`);
  }
}

/**
 * Encuentra el .html principal dentro de un directorio descomprimido.
 * Estrategia: busca recursivamente archivos .html, ignora __MACOSX y
 * prioriza el más grande (típicamente el informe principal vs helpers).
 */
function findPrimaryHtml(dir: string): string {
  const htmls: Array<{ path: string; size: number }> = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__MACOSX' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        const size = statSync(full).size;
        htmls.push({ path: full, size });
      }
    }
  }

  walk(dir);

  if (htmls.length === 0) {
    throw new Error(`No se encontró ningún .html en ${dir}`);
  }

  // El HTML principal es típicamente el más grande
  htmls.sort((a, b) => b.size - a.size);
  return htmls[0].path;
}

// =====================================================
// PUPPETEER: renderizar React → HTML estático
// =====================================================

async function renderWithPuppeteer(browser: Browser, htmlPath: string): Promise<string> {
  const rawHtml = readFileSync(htmlPath, 'utf-8');

  const page: Page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // Capturar errores de consola
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // Cargar HTML crudo. waitUntil='networkidle0' = esperar a que Google Fonts / unpkg terminen.
    await page.setContent(rawHtml, { waitUntil: 'networkidle0', timeout: HYDRATION_TIMEOUT_MS });

    // Esperar a que React hidrate: #root debe tener al menos 1 hijo con contenido.
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root !== null && root.children.length > 0 && root.textContent!.trim().length > 50;
      },
      { timeout: HYDRATION_TIMEOUT_MS },
    );

    // Scroll completo para forzar lazy-loads e IntersectionObservers (muchos HTMLs
    // tienen .section{opacity:0} que solo pasa a visible con scroll).
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 80);
      });
    });

    // Dar un último respiro para animaciones GSAP/transiciones
    await new Promise((r) => setTimeout(r, 1000));

    // Forzar visibilidad de todas las .section (eliminar opacity:0 dependiente de IntersectionObserver)
    await page.evaluate(() => {
      document.querySelectorAll('.section').forEach((el) => el.classList.add('visible'));
    });

    const fullHtml = await page.evaluate(() => {
      // Clonamos el DOM para poder limpiarlo sin afectar el render activo
      const clone = document.documentElement.cloneNode(true) as HTMLElement;

      // ELIMINACIÓN 1: scripts unpkg (React, ReactDOM, Babel Standalone)
      clone.querySelectorAll('script[src*="unpkg.com"]').forEach((s) => s.remove());

      // ELIMINACIÓN 2: scripts tipo text/babel (ya ejecutados, no sirven)
      clone.querySelectorAll('script[type="text/babel"]').forEach((s) => s.remove());

      // ELIMINACIÓN 3: template tags del builder (ej: __bundler_thumbnail)
      clone.querySelectorAll('template[id^="__bundler"]').forEach((t) => t.remove());

      // ELIMINACIÓN 4: scripts inline con postMessage edit mode
      clone.querySelectorAll('script:not([src])').forEach((s) => {
        const content = s.textContent ?? '';
        if (
          content.includes('__activate_edit_mode') ||
          content.includes('__edit_mode_available') ||
          content.includes('__bundler_thumbnail')
        ) {
          s.remove();
        }
      });

      // ELIMINACIÓN 5: panel de tweaks (dev tool del builder)
      clone.querySelectorAll('.tweaks-panel').forEach((t) => t.remove());

      return '<!DOCTYPE html>\n' + clone.outerHTML;
    });

    if (consoleErrors.length > 0) {
      log('warn', `Render produjo ${consoleErrors.length} errores de consola`, {
        sample: consoleErrors.slice(0, 3),
      });
    }

    return fullHtml;
  } finally {
    await page.close();
  }
}

// =====================================================
// VALIDACIÓN DEL HTML LIMPIO
// =====================================================

interface ValidationResult {
  ok: boolean;
  warnings: string[];
  byteSize: number;
}

function validateCleanedHtml(html: string): ValidationResult {
  const warnings: string[] = [];
  const byteSize = Buffer.byteLength(html, 'utf-8');

  // Check 1: debe empezar por <!DOCTYPE o <html
  const trimmed = html.trim().toLowerCase();
  if (!trimmed.startsWith('<!doctype') && !trimmed.startsWith('<html')) {
    return { ok: false, warnings: ['HTML no empieza por DOCTYPE ni <html>'], byteSize };
  }

  // Check 2: tamaño razonable
  if (byteSize > MAX_TEMPLATE_BYTES) {
    warnings.push(
      `Template grande: ${(byteSize / 1024).toFixed(1)} KB > ${MAX_TEMPLATE_BYTES / 1024} KB recomendado`,
    );
  }

  // Check 3: no debe contener referencias unpkg
  if (html.includes('unpkg.com')) {
    warnings.push('HTML todavía referencia unpkg.com (React/Babel no eliminados)');
  }

  // Check 4: no debe contener postMessage edit-mode
  if (html.includes('__activate_edit_mode') || html.includes('__edit_mode_available')) {
    warnings.push('HTML contiene postMessage edit-mode del builder');
  }

  // Check 5: debe tener contenido real (al menos 1000 chars de texto)
  const textOnly = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (textOnly.length < 1000) {
    warnings.push(`Contenido de texto muy corto (${textOnly.length} chars). React posiblemente no hidrató.`);
  }

  return { ok: true, warnings, byteSize };
}

// =====================================================
// SUPABASE: insertar template + desactivar anterior
// =====================================================

interface SupabaseUpsertResult {
  inserted: boolean;
  newVersion: number;
}

async function upsertTemplate(
  supabase: ReturnType<typeof createClient>,
  slug: string,
  htmlTemplate: string,
  notes: string,
): Promise<SupabaseUpsertResult> {
  // 1. Obtener versión máxima actual para este slug
  const { data: existing, error: selErr } = await supabase
    .from('astrodorado_report_templates')
    .select('version, is_active')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1);

  if (selErr) throw new Error(`Error consultando versiones: ${selErr.message}`);

  const currentMaxVersion = existing && existing.length > 0 ? (existing[0].version as number) : 0;
  const newVersion = currentMaxVersion + 1;

  // 2. Desactivar la versión actualmente activa (si existe)
  //    IMPORTANTE: unique partial index nos obliga a desactivar antes de insertar otra active
  if (existing && existing.length > 0 && existing[0].is_active === true) {
    const { error: deactErr } = await supabase
      .from('astrodorado_report_templates')
      .update({ is_active: false })
      .eq('slug', slug)
      .eq('is_active', true);

    if (deactErr) throw new Error(`Error desactivando versión anterior: ${deactErr.message}`);
  }

  // 3. Insertar la nueva versión activa
  const { error: insErr } = await supabase
    .from('astrodorado_report_templates')
    .insert({
      slug,
      html_template: htmlTemplate,
      source: 'puppeteer_render',
      version: newVersion,
      is_active: true,
      notes,
      data_schema: [],
    });

  if (insErr) throw new Error(`Error insertando template: ${insErr.message}`);

  return { inserted: true, newVersion };
}

// =====================================================
// PROCESAR UN SLUG
// =====================================================

interface ProcessResult {
  slug: string;
  success: boolean;
  newVersion?: number;
  byteSize?: number;
  warnings: string[];
  error?: string;
}

async function processSlug(
  browser: Browser,
  supabase: ReturnType<typeof createClient>,
  mapping: SlugMapping,
  dryRun: boolean,
): Promise<ProcessResult> {
  const { slug, zipFileName, displayName } = mapping;
  const zipPath = join(ZIPS_DIR, zipFileName);
  const extractDir = join(WORK_DIR, slug);

  log('info', `Procesando: ${displayName} (${slug})`);

  try {
    // 1. Unzip
    unzipToDir(zipPath, extractDir);

    // 2. Localizar HTML principal
    const htmlPath = findPrimaryHtml(extractDir);
    const originalSize = statSync(htmlPath).size;
    log('info', `  → HTML localizado`, { path: basename(htmlPath), size: `${(originalSize / 1024).toFixed(1)} KB` });

    // 3. Render con Puppeteer (con retries)
    let cleanedHtml = '';
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_TEMPLATE; attempt++) {
      try {
        cleanedHtml = await renderWithPuppeteer(browser, htmlPath);
        break;
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES_PER_TEMPLATE) {
          log('warn', `  → Retry ${attempt}/${MAX_RETRIES_PER_TEMPLATE}`, { error: lastError.message });
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (!cleanedHtml) throw lastError ?? new Error('Render falló sin error específico');

    // 4. Validar resultado
    const validation = validateCleanedHtml(cleanedHtml);
    if (!validation.ok) {
      throw new Error(`Validación falló: ${validation.warnings.join('; ')}`);
    }
    log('info', `  → Render completo`, {
      bytes: `${(validation.byteSize / 1024).toFixed(1)} KB`,
      reduction: `${((1 - validation.byteSize / originalSize) * 100).toFixed(0)}%`,
    });

    // 5. Upsert a Supabase (skip si dry-run)
    let newVersion: number | undefined;
    if (!dryRun) {
      const notes = `Ingested from ${zipFileName} · Original: ${(originalSize / 1024).toFixed(1)} KB · Cleaned: ${(validation.byteSize / 1024).toFixed(1)} KB · ${new Date().toISOString()}`;
      const result = await upsertTemplate(supabase, slug, cleanedHtml, notes);
      newVersion = result.newVersion;
      log('success', `  ✓ Template insertado`, { slug, version: newVersion });
    } else {
      log('info', `  (dry-run: no insert)`);
    }

    return {
      slug,
      success: true,
      newVersion,
      byteSize: validation.byteSize,
      warnings: validation.warnings,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    log('error', `  ✗ Fallo en ${slug}`, { error: errorMsg });
    return {
      slug,
      success: false,
      warnings: [],
      error: errorMsg,
    };
  }
}

// =====================================================
// MAIN
// =====================================================

async function main(): Promise<void> {
  const args = parseArgs();
  log('info', '=== Pipeline de ingesta de templates AstroDorado ===');
  log('info', 'Configuración', {
    zipsDir: ZIPS_DIR,
    workDir: WORK_DIR,
    dryRun: args.dryRun,
    filter: args.slugFilter ?? (args.runAll ? 'all' : 'dry-run'),
  });

  // Validar env vars (solo si no es dry-run)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!args.dryRun && (!SUPABASE_URL || !SERVICE_KEY)) {
    log('error', 'Env vars faltantes: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Validar que el dir de zips existe
  if (!existsSync(ZIPS_DIR)) {
    log('error', `Directorio de zips no existe: ${ZIPS_DIR}`);
    process.exit(1);
  }

  // Filtrar mappings según flags
  const toProcess = args.slugFilter
    ? SLUG_MAPPINGS.filter((m) => m.slug === args.slugFilter)
    : SLUG_MAPPINGS;

  if (toProcess.length === 0) {
    log('error', `Ningún slug coincide con el filtro`, { filter: args.slugFilter });
    process.exit(1);
  }

  // Validar zips existentes antes de lanzar Puppeteer
  const missingZips = toProcess.filter((m) => !existsSync(join(ZIPS_DIR, m.zipFileName)));
  if (missingZips.length > 0) {
    log('error', 'Zips faltantes (abortando antes de empezar)', {
      missing: missingZips.map((m) => m.zipFileName),
    });
    process.exit(1);
  }

  // Crear clientes
  const supabase = args.dryRun
    ? null
    : createClient(SUPABASE_URL!, SERVICE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  log('info', 'Lanzando Puppeteer headless...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: ProcessResult[] = [];
  try {
    for (const mapping of toProcess) {
      const result = await processSlug(browser, supabase as NonNullable<typeof supabase>, mapping, args.dryRun);
      results.push(result);
    }
  } finally {
    await browser.close();
  }

  // Resumen final
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log('');
  log('info', '=== RESUMEN ===');
  log(succeeded.length === results.length ? 'success' : 'warn', `Procesados: ${results.length}`, {
    ok: succeeded.length,
    ko: failed.length,
  });

  if (succeeded.length > 0) {
    console.log('');
    log('success', 'Templates exitosos:');
    for (const r of succeeded) {
      console.log(
        `  ✓ ${r.slug.padEnd(22)} ${r.byteSize ? `${(r.byteSize / 1024).toFixed(1).padStart(6)} KB` : ''} ${r.newVersion ? `v${r.newVersion}` : '(dry-run)'}${r.warnings.length > 0 ? ` ⚠ ${r.warnings.length} warnings` : ''}`,
      );
    }
  }

  if (failed.length > 0) {
    console.log('');
    log('error', 'Templates fallidos:');
    for (const r of failed) {
      console.log(`  ✗ ${r.slug.padEnd(22)} ${r.error ?? 'error desconocido'}`);
    }
    process.exit(1);
  }

  log('success', 'Pipeline completado sin errores');
}

main().catch((err) => {
  log('error', 'Fallo no controlado', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
