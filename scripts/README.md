# Scripts de operación — AstroDorado v3

## `upload-zodiac-images.mjs`

Extrae las 12 imágenes zodiacales embebidas en el HTML `astrodorado-v6-hq.html`
(del repo `semaes111/astro-horoscopo`) y las sube al bucket `zodiac-images`
de Supabase Storage.

---

### Requisitos

- Node.js 18+ (usa `fetch` nativo — cero dependencias npm)
- Acceso al archivo `astrodorado-v6-hq.html` (del repo `astro-horoscopo`)
- `SUPABASE_SERVICE_ROLE_KEY` del proyecto `bpazmmbjjducdmxgfoum`

---

### Flujo recomendado (primera vez)

```bash
# 1. Clonar el repo astro-horoscopo localmente
git clone https://github.com/semaes111/astro-horoscopo.git
cd astro-horoscopo

# 2. Exportar variables de entorno
export SUPABASE_URL="https://bpazmmbjjducdmxgfoum.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<pegar-service-role-key>"

# 3. DRY-RUN primero para verificar el mapeo imagen <-> signo
node /ruta/al/astrodorado-v3/scripts/upload-zodiac-images.mjs ./index.html --dry-run

# 4. Abrir manualmente ./.zodiac-images-extracted/ y confirmar visualmente:
#    aries.jpg      -> carnero dorado
#    tauro.jpg      -> toro dorado
#    geminis.jpg    -> gemelos dorados
#    cancer.jpg     -> cangrejo dorado
#    ...etc

# 5. Si todo es correcto, ejecutar SIN --dry-run para subir
node /ruta/al/astrodorado-v3/scripts/upload-zodiac-images.mjs ./index.html

# 6. Verificar en el navegador (ejemplo aries):
#    https://bpazmmbjjducdmxgfoum.supabase.co/storage/v1/object/public/zodiac-images/aries.jpg
```

---

### Flags disponibles

| Flag | Efecto |
|---|---|
| `--dry-run` | Extrae imágenes a `./.zodiac-images-extracted/` pero NO sube nada. Ideal para verificar mapeo. |
| `--force` | Sobreescribe imágenes ya existentes en el bucket (por defecto salta las que ya están). |

---

### Output de ejemplo

```
> Leyendo ./index.html...
  (1821 KB)
> Encontradas 12 imágenes base64 embebidas.

> Mapeo de imágenes (orden en HTML):
  aries         -> image/jpeg | 142 KB
  tauro         -> image/jpeg | 138 KB
  geminis       -> image/jpeg | 145 KB
  ...
  piscis        -> image/jpeg | 141 KB

> Subiendo al bucket 'zodiac-images' de https://bpazmmbjjducdmxgfoum.supabase.co...
  [OK]    aries.jpg (142 KB)
  [OK]    tauro.jpg (138 KB)
  ...
  [OK]    piscis.jpg (141 KB)

==================================================
Subidas:   12
Saltadas:  0
Errores:   0
Total:     12
==================================================
```

---

### Troubleshooting

#### "esperaba al menos 12 imágenes, encontré X"

El HTML que has pasado NO es `astrodorado-v6-hq.html` o le falta alguna imagen
embebida. Comprueba que has clonado `astro-horoscopo` y no `astro-dorado-v2`.

#### "HTTP 401: Unauthorized"

La `SUPABASE_SERVICE_ROLE_KEY` es incorrecta o ha sido rotada. Consigue la nueva
en Supabase Dashboard → Project Settings → API → `service_role` key.

#### "HTTP 400: Bucket not found"

El bucket `zodiac-images` no existe todavía. Ejecuta las migraciones:
```bash
# En Supabase SQL Editor
-- astrodorado_create_zodiac_images_bucket (ya aplicada via MCP)
```

#### "El mapeo signo <-> imagen es incorrecto"

El HTML v6-hq debería tener las imágenes en orden zodiacal (aries, tauro...piscis).
Si el orden difiere, hay 2 opciones:
1. Editar manualmente el script y cambiar el array `SIGNS`
2. Reordenar tras el upload vía Supabase Dashboard → Storage → rename

---

### Idempotencia

El script es **idempotente por defecto**: si una imagen ya existe en el bucket,
la salta con `[SKIP]`. Para forzar sobreescritura usa `--force`.

Esto permite re-ejecutar el script N veces sin consecuencias.

---

### Integración futura con n8n

Una vez validado, este mismo script puede ejecutarse desde n8n cuando se
regeneren imágenes zodiacales (ej: nueva temporada con esculturas en 4K).
El workflow dispararía el script en un contenedor Node efímero pasando el
nuevo HTML como input.
