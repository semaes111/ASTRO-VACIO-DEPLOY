#!/usr/bin/env node
/**
 * upload-zodiac-images.mjs
 *
 * Extrae las 12 imágenes base64 embebidas en astrodorado-v6-hq.html
 * y las sube al bucket `zodiac-images` de Supabase Storage.
 *
 * Uso:
 *   node scripts/upload-zodiac-images.mjs <ruta-al-html> [--dry-run] [--force]
 *
 * Variables de entorno requeridas (excepto en --dry-run):
 *   SUPABASE_URL                 (https://bpazmmbjjducdmxgfoum.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY    (service role key del dashboard Supabase)
 *
 * Flags:
 *   --dry-run  Extrae pero NO sube (vuelca imágenes a ./.zodiac-images-extracted/)
 *   --force    Sobreescribe imágenes ya existentes en el bucket
 *
 * Dependencias: Node.js 18+ (fetch nativo, no necesita npm install).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { argv, exit, env } from "node:process";

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
const BUCKET = "zodiac-images";

const SIGNS = [
  "aries", "tauro", "geminis", "cancer",
  "leo", "virgo", "libra", "escorpio",
  "sagitario", "capricornio", "acuario", "piscis",
];

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");
const htmlPath = argv.find((a, i) => i >= 2 && !a.startsWith("--"));

// ---------------------------------------------------------------------
// Validación previa
// ---------------------------------------------------------------------
if (!htmlPath) {
  console.error("ERROR: falta la ruta al HTML.");
  console.error("Uso: node scripts/upload-zodiac-images.mjs <ruta-al-html> [--dry-run] [--force]");
  exit(1);
}

if (!existsSync(htmlPath)) {
  console.error(`ERROR: no se encuentra el archivo ${htmlPath}`);
  exit(1);
}

if (!DRY_RUN) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("ERROR: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidas.");
    console.error('  export SUPABASE_URL="https://bpazmmbjjducdmxgfoum.supabase.co"');
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    exit(1);
  }
}

// ---------------------------------------------------------------------
// Extracción de imágenes base64 del HTML
// ---------------------------------------------------------------------
console.log(`> Leyendo ${htmlPath}...`);
const html = await readFile(htmlPath, "utf-8");
console.log(`  (${(html.length / 1024).toFixed(0)} KB)`);

/**
 * Las imágenes están como data:image/<tipo>;base64,<datos>
 * El HTML v6-hq las ordena por signo zodiacal (Aries, Tauro, ..., Piscis).
 * Tomamos las primeras 12 en orden de aparición.
 */
const base64Pattern = /data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)/g;
const matches = [...html.matchAll(base64Pattern)];

console.log(`> Encontradas ${matches.length} imágenes base64 embebidas.`);

if (matches.length < 12) {
  console.error(`ERROR: esperaba al menos 12 imágenes, encontré ${matches.length}`);
  exit(1);
}

const images = matches.slice(0, 12).map((m, idx) => {
  const mimeSuffix = m[1] === "jpg" ? "jpeg" : m[1];
  const extension = m[1] === "jpg" ? "jpg" : m[1];
  return {
    sign: SIGNS[idx],
    mimeType: `image/${mimeSuffix}`,
    extension,
    base64: m[2],
    buffer: Buffer.from(m[2], "base64"),
  };
});

console.log("\n> Mapeo de imágenes (orden en HTML):");
for (const img of images) {
  const sizeKb = (img.buffer.length / 1024).toFixed(0);
  console.log(`  ${img.sign.padEnd(13)} -> ${img.mimeType.padEnd(10)} | ${sizeKb} KB`);
}

// ---------------------------------------------------------------------
// Dry-run: volcar imágenes a disco para verificación visual
// ---------------------------------------------------------------------
if (DRY_RUN) {
  const outDir = path.resolve("./.zodiac-images-extracted");
  await mkdir(outDir, { recursive: true });
  for (const img of images) {
    const outPath = path.join(outDir, `${img.sign}.${img.extension}`);
    await writeFile(outPath, img.buffer);
  }
  console.log(`\nDRY-RUN completo. Revisa visualmente las imágenes en ${outDir}`);
  console.log("Si el mapeo signo <-> imagen es correcto, ejecuta SIN --dry-run para subirlas.");
  exit(0);
}

// ---------------------------------------------------------------------
// Upload a Supabase Storage
// ---------------------------------------------------------------------
console.log(`\n> Subiendo al bucket '${BUCKET}' de ${SUPABASE_URL}...`);

let okCount = 0;
let skipCount = 0;
let errCount = 0;

for (const img of images) {
  const objectPath = `${img.sign}.${img.extension}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;

  // Si no es --force, saltamos si ya existe
  if (!FORCE) {
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) {
        console.log(`  [SKIP]  ${objectPath} (ya existe — usa --force para sobreescribir)`);
        skipCount++;
        continue;
      }
    } catch {
      /* si HEAD falla, seguimos con el upload */
    }
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": img.mimeType,
        "x-upsert": FORCE ? "true" : "false",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: img.buffer,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`  [FAIL]  ${objectPath} -> HTTP ${res.status}: ${body.slice(0, 200)}`);
      errCount++;
      continue;
    }

    const sizeKb = (img.buffer.length / 1024).toFixed(0);
    console.log(`  [OK]    ${objectPath} (${sizeKb} KB)`);
    okCount++;
  } catch (e) {
    console.error(`  [ERROR] ${objectPath} -> ${e.message}`);
    errCount++;
  }
}

// ---------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------
console.log("\n==================================================");
console.log(`Subidas:   ${okCount}`);
console.log(`Saltadas:  ${skipCount}`);
console.log(`Errores:   ${errCount}`);
console.log(`Total:     12`);
console.log("==================================================");

if (errCount > 0) exit(1);

if (okCount > 0 || skipCount > 0) {
  console.log("\nURLs públicas para verificar (pega en el navegador):");
  for (const img of images) {
    console.log(`  ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${img.sign}.${img.extension}`);
  }
}

console.log("\nListo: las URLs públicas ya coinciden con image_url de astrodorado.zodiac_signs.");
