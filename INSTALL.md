# ASTRO DORADO - Oraculo 360 Bundle

## Instalacion en el VPS

Asume que ya tienes el repo clonado en /tmp/ad-informes/v3/

### PASO 1: Extraer el bundle al repo

```bash
cd /tmp/ad-informes/v3

# Descargar el bundle (el zip ya esta en Supabase Storage)
curl -o /tmp/ad-oraculo-bundle.zip \
  "https://bpazmmbjjducdmxgfoum.supabase.co/storage/v1/object/public/astrodorado-reports/bundles/oraculo360-v1.zip"

# Extraer sobrescribiendo
unzip -o /tmp/ad-oraculo-bundle.zip -d /tmp/ad-informes/v3/

# Verificar estructura
ls app/catalogo/
ls app/pricing/
ls app/ejemplos/
ls app/api/stripe/
ls lib/
```

### PASO 2: Instalar dependencias nuevas

```bash
npm install stripe @anthropic-ai/sdk
```

### PASO 3: Configurar variables de entorno en Vercel

Via Vercel CLI o Dashboard > astrodorado-app > Settings > Environment Variables:

```
STRIPE_SECRET_KEY=sk_live_...            # Stripe secret key de produccion
STRIPE_WEBHOOK_SECRET=whsec_...           # Webhook signing secret
ANTHROPIC_API_KEY=sk-ant-api03-...        # Ya tienes
NEXT_PUBLIC_APP_URL=https://astrodorado-app.vercel.app
INTERNAL_API_SECRET=<generar uuid aleatorio>

# Ya configurados (no tocar):
NEXT_PUBLIC_SUPABASE_URL=https://bpazmmbjjducdmxgfoum.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<existente>
```

### PASO 4: Crear productos en Stripe

Con tu cuenta Stripe ya existente:

1. Dashboard > Products > Add product
2. Crear 7 productos con estos precios:
   - Carta Natal: 29 EUR (one-time)
   - Revolucion Solar: 24 EUR (one-time)
   - Numerologia: 19 EUR (one-time)
   - I-Ching: 22 EUR (one-time)
   - Horoscopo Chino: 22 EUR (one-time)
   - Kabbalah: 25 EUR (one-time)
   - Oraculo 360: 129 EUR (one-time)

3. Copiar los 7 price_id generados
4. Actualizar en Supabase con SQL Editor:

```sql
update astrodorado.reports set stripe_price_id = 'price_xxx' where slug = 'carta-natal';
-- repetir para cada uno
```

### PASO 5: Configurar webhook Stripe

1. Stripe Dashboard > Developers > Webhooks > Add endpoint
2. URL: https://astrodorado-app.vercel.app/api/stripe/webhook
3. Events: checkout.session.completed
4. Copiar Signing secret > guardar en STRIPE_WEBHOOK_SECRET en Vercel

### PASO 6: Commit y deploy

```bash
cd /tmp/ad-informes/v3
git add -A
git commit -m "feat(oraculo-360): catalogo completo 7 productos con Stripe"
git push
```

Vercel hace deploy automatico. Tiempo ~90s.

### PASO 7: Verificar

Abrir y probar:
- https://astrodorado-app.vercel.app/catalogo
- https://astrodorado-app.vercel.app/pricing
- https://astrodorado-app.vercel.app/ejemplos/carta_natal
- https://astrodorado-app.vercel.app/informes/carta_natal/nuevo

### PASO 8 (opcional): Generar ejemplos demo con IA

Pendiente para proxima sesion: script que llama a Sonnet 4.5
con datos de Alma Suarez Montes para generar los 6 JSON demo
y guardarlos en public/demo-reports/*.html

## Troubleshooting

### Build falla con "Cannot find module"
Algun import esta roto. Revisa los paths con @/ que deben coincidir
con el tsconfig.json paths existente del repo.

### Stripe checkout devuelve 500
Verifica STRIPE_SECRET_KEY en Vercel.
Si usas price_data (dinamico), no necesitas stripe_price_id aun.

### Webhook no dispara
Verifica que la URL del webhook este bien configurada en Stripe
y que STRIPE_WEBHOOK_SECRET coincida.

## Estado del bundle

FASE 1 COMPLETA: Schema Supabase con 7 productos
FASE 2 COMPLETA: Paginas catalogo y pricing publicas
FASE 3 COMPLETA: Ejemplos publicos (rutas listas, HTMLs demo pendientes)
FASE 4 COMPLETA: Formularios de entrada generico + checkout Stripe
FASE 5 COMPLETA: Webhook Stripe + dispatcher de generadores
FASE 6 PARCIAL: Solo Carta Natal activa; resto stubs coming soon

Proximas sesiones:
- Generar los 6 JSON demo de Alma con Sonnet 4.5
- Implementar los 6 generadores reales (revolucion, numerologia, etc)
- Implementar orchestrator del Oraculo 360
- Implementar capitulo sintesis convergente
