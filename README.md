# AstroDorado v3

> Horóscopo diario con IA · Astrología de precisión · Modelo freemium → VIP
> Parte del portfolio de 10 negocios automatizados de **NextHorizont AI**

[![Stack](https://img.shields.io/badge/stack-Next.js%2015%20%2B%20Supabase-gold)]()
[![Deploy](https://img.shields.io/badge/deploy-Dokploy%20%2B%20Docker-blue)]()
[![License](https://img.shields.io/badge/license-Propietario-red)]()

---

## 📐 Arquitectura

Consulta [ADR-0001](./docs/adr/ADR-0001-arquitectura-deployment.md) para el
razonamiento completo de la decisión.

```
Usuario → Cloudflare (CDN/WAF/DNS)
         └→ VPS Hostinger + Dokploy + Traefik (SSL auto)
            └→ astro-web (Next.js 15 dockerizado) ←→ Supabase + n8n + AstrologyAPI + Stripe
```

---

## 🚀 Quick Start

### 1. Variables de entorno

```bash
cp .env.example .env.local
# Rellenar con tus claves reales
```

### 2. Ejecutar migraciones Supabase

```bash
# Opción A: Supabase CLI
supabase db push

# Opción B: Desde el Dashboard SQL Editor
# Copiar el contenido de supabase/migrations/20260416120000_astrodorado_landing.sql
# y pegarlo en: https://supabase.com/dashboard/project/bpazmmbjjducdmxgfoum/sql/new
```

### 3. Validar la migración con tests SQL

```bash
psql "$DATABASE_URL" -f supabase/tests/001_landing.test.sql
# Todas las líneas deben decir "PASS:"
```

### 4. Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 5. Tests

```bash
npm run type-check    # TypeScript estricto (0 errores)
npm run lint          # ESLint (0 warnings)
npm run test          # Vitest unit tests
npm run test:coverage # coverage (mínimo 80%)
```

---

## 🏗️ Deploy a producción (Dokploy + Hostinger VPS)

### Pre-requisitos

- ✅ VPS Hostinger con Dokploy instalado (IP 31.97.69.100)
- ✅ Red Docker `dokploy-network` existente
- ✅ Traefik con Let's Encrypt configurado
- ✅ DNS `astrodorado.com` apuntando a Cloudflare, Cloudflare apuntando al VPS

### Paso 1: SSH + crear proyecto Dokploy

```bash
# En Dokploy UI (http://31.97.69.100:3000):
Projects → Create → Compose → Name: astrodorado-web
```

### Paso 2: Configurar el compose

Pegar el contenido de `docker-compose.yml` y añadir los secretos en el panel
"Environment Variables" (ver `.env.example` para la lista completa).

### Paso 3: Deploy

```
Dokploy UI → Deploy
```

Esperar ~3 min para el primer build (Docker multi-stage, imagen final ~180 MB).

### Paso 4: Verificar

```bash
# Logs del contenedor
docker logs astrodorado-web --tail 50

# Health check
curl https://astrodorado.com/api/health
# Esperado: {"status":"ok","db":"ok","latency_ms":<100}

# Sitemap
curl https://astrodorado.com/sitemap.xml
```

### Paso 5: Configurar n8n workflow

1. Abrir `https://n8n.nexthorizont.ai`
2. Importar `n8n-workflows/daily-horoscope-v2.json`
3. Configurar credenciales:
   - Anthropic API (ID ya conocido: `8Qq81OHs8p9HF49i`)
   - Supabase (schema: `astrodorado`)
4. Añadir variable de entorno `REVALIDATE_TOKEN` (mismo valor que en `.env.local`)
5. Activar el workflow → cron diario 05:30 UTC

---

## 📁 Estructura

```
astrodorado-v3/
├── app/                    # Next.js 15 App Router
│   ├── layout.tsx          # Layout raíz con fonts
│   ├── page.tsx            # Landing / (ISR 6h)
│   ├── [sign]/page.tsx     # Página por signo (ISR 6h, 12 pre-renderizadas)
│   ├── globals.css         # Tailwind v4 + tokens AstroDorado
│   ├── robots.ts           # robots.txt dinámico
│   ├── sitemap.ts          # sitemap.xml dinámico
│   └── api/
│       ├── health/route.ts     # Health check para Docker
│       └── revalidate/route.ts # ISR on-demand desde n8n
├── lib/
│   ├── supabase/
│   │   ├── server.ts       # Cliente SSR (user) + admin (service_role)
│   │   └── horoscopes.ts   # Queries centralizadas
│   └── types/
│       └── astrodorado.ts  # Tipos TypeScript del dominio
├── __tests__/              # Vitest unit tests
├── supabase/
│   ├── migrations/         # SQL versionado
│   └── tests/              # Tests de integridad SQL
├── n8n-workflows/          # Exports de workflows
├── docs/adr/               # Architecture Decision Records
├── middleware.ts           # Refresco de sesión + protección VIP
├── Dockerfile              # Multi-stage para Dokploy
├── docker-compose.yml      # Servicio + Traefik labels
└── next.config.ts          # output: standalone + headers seguridad
```

---

## 💳 Modelo de negocio

| Tier | Precio | Contenido |
|------|--------|-----------|
| **Free** | 0 € | Landing pública + 12 páginas SEO + horóscopo diario por signo |
| **Telegram suscriptor** | 0 € | Lo anterior + broadcast diario al bot @Astrodorado_bot |
| **VIP mensual** | 9,99 €/mes | Carta natal + tránsitos + numerología + alertas + informes |
| **VIP trimestral** | 25 €/3m | Lo anterior, ahorro ~17% |
| **VIP anual** | 89 €/año | Lo anterior, ahorro ~25% |
| **Informe puntual** | 12-29 € | Compatibilidad, año astrológico, carta relacional |

---

## 🔐 Seguridad

- ✅ RLS habilitado en TODAS las tablas (`pg_tables.rowsecurity = true`)
- ✅ Service role key NUNCA en cliente (solo en Server Components/Actions)
- ✅ Headers de seguridad: HSTS, X-Frame-Options, CSP (pendiente)
- ✅ Stripe webhook con verificación de signature
- ✅ Endpoint ISR protegido con token en header
- ✅ Rutas `/vip/*` y `/admin/*` protegidas por middleware

---

## 📊 Métricas objetivo

| KPI | Objetivo mes 3 | Objetivo mes 6 |
|-----|----------------|----------------|
| Visitas orgánicas/mes | 10k | 100k |
| Suscriptores Telegram | 1k | 10k |
| VIPs activos | 30 | 300 |
| MRR | €300 | €3.000 |
| Lighthouse Performance | ≥ 90 | ≥ 95 |
| Lighthouse SEO | 100 | 100 |

---

## 🔗 Referencias del ecosistema

- **CLAUDE-MASTER.md** — reglas de arquitectura NextHorizont
- **Paperclip** — orquestación de agentes (empresa `AstroDorado`, ID `bbc8b05b`)
- **n8n** — workflows de automatización (`n8n.nexthorizont.ai`)
- **Supabase** — base de datos y auth (project `bpazmmbjjducdmxgfoum`)

---

## 👤 Autor

**Dr. Sergio** · NextHorizont AI SL · El Ejido, Almería
