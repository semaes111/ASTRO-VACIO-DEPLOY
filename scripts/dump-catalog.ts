#!/usr/bin/env tsx
/**
 * scripts/dump-catalog.ts — Volcado del catálogo de DB a JSON local.
 *
 * Lee astrodorado.reports y escribe a stdout un JSON con los 30 productos.
 * Lo usa `scripts/scaffold-generator.py` como fuente de datos.
 *
 * Uso:
 *
 *     # Dump a stdout:
 *     npx tsx scripts/dump-catalog.ts
 *
 *     # Guardar a archivo (Bash / Mac / Linux):
 *     npx tsx scripts/dump-catalog.ts > scripts/_catalog_snapshot.json
 *
 *     # Guardar a archivo (PowerShell — Windows):
 *     npx tsx scripts/dump-catalog.ts | Out-File scripts/_catalog_snapshot.json -Encoding utf8
 *
 * Pre-requisitos:
 *     .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 *
 * Cuándo regenerar el snapshot:
 *   - Cuando se añade un producto nuevo a astrodorado.reports
 *   - Cuando se cambia el `tier`, `is_active`, `required_inputs` de un producto
 *   - Antes de scaffoldear un worker para asegurar que tienes el shape actual
 *
 * NO commitees el snapshot generado si tu equipo trabaja con bases distintas
 * (dev vs staging vs prod). En ese caso, gitignorea `_catalog_snapshot.json`.
 * Si tu equipo trabaja contra una sola DB de fuente única, sí puedes
 * commitearlo para que el scaffolder funcione sin acceso a Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const COLUMNS = [
  'slug', 'name_es', 'short_description', 'price_eur',
  'product_type', 'category', 'tier',
  'is_bundle', 'is_active', 'is_featured',
  'display_order', 'tagline', 'theme_slug',
  'primary_color', 'accent_color',
  'hero_icon', 'icon_emoji',
  'generator_function', 'word_count_target',
  'estimated_minutes', 'has_public_example',
  'required_inputs', 'ai_model',
].join(', ');

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      '❌ Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Leemos del schema astrodorado directamente porque astrodorado_reports
  // (la wrapper view en public) puede filtrar is_active=true. Aquí queremos
  // TODOS los productos (incluidos los pre-launch).
  const { data, error } = await supabase
    .schema('astrodorado')
    .from('reports')
    .select(COLUMNS)
    .order('display_order', { ascending: true });

  if (error) {
    console.error(`❌ Error consultando astrodorado.reports: ${error.message}`);
    process.exit(2);
  }

  if (!data || data.length === 0) {
    console.error('⚠️  La tabla astrodorado.reports está vacía.');
    process.exit(3);
  }

  // Escribir a stdout para que sea redirigible. El stderr lleva info de progreso
  // que NO contamina el JSON.
  console.error(`✅ Volcando ${data.length} productos a stdout...`);
  process.stdout.write(JSON.stringify(data, null, 2));
  process.stdout.write('\n');
}

main().catch((err) => {
  console.error('Error no capturado:', err);
  process.exit(1);
});
