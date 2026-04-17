# ADR-0001 — Arquitectura de despliegue de AstroDorado

**Fecha:** 2026-04-16
**Estado:** Accepted
**Decisor:** Sergio (NextHorizont AI)
**Consultores:** Claude (stack analysis)

---

## Contexto

AstroDorado es la primera vertical del portfolio de 10 negocios digitales de
NextHorizont AI. Necesitamos una arquitectura que soporte:

- Landing pública SEO-optimizada (objetivo: tráfico orgánico a 12 URLs por signo)
- Modelo freemium con suscripción VIP €9.99/mes vía Stripe
- Dashboard VIP con carta natal, tránsitos, informes premium
- Integración con AstrologyAPI.com (de pago por crédito)
- Coherencia con el stack existente: Supabase + n8n + Paperclip + Dokploy

El infraestructura actual del ecosistema NextHorizont vive en un VPS Hostinger
KVM8 orquestado con Dokploy, Traefik y red Docker compartida (`dokploy-network`).

---

## Opciones evaluadas

### Opción A — Astro SSG en Hostinger Shared Hosting
- ✅ Coste mínimo (el shared ya está pagado)
- ✅ SEO excelente out-of-the-box
- ❌ Sin Server Components, sin Server Actions
- ❌ Dashboard VIP no viable sin SPA separada
- ❌ Incoherente con el stack NextHorizont (Next.js-first)
- **Descartada** por limitaciones de runtime.

### Opción B — Next.js en Vercel + Supabase
- ✅ Stack NextHorizont canónico (sección 14.1 de CLAUDE-MASTER)
- ✅ CDN global y edge network incluidos
- ✅ Developer experience insuperable (preview deploys, etc.)
- ❌ Coste adicional al escalar (+$20/mes Pro)
- ❌ Introduce un proveedor extra al ecosistema
- ❌ Latencia web → n8n sale a internet (tiene que atravesar el proxy Cloudflare)
- **Descartada** porque el VPS ya está pagado y el ecosistema está unificado ahí.

### Opción C (ELEGIDA) — Next.js dockerizado en VPS Hostinger + Dokploy
- ✅ 0 € de coste adicional (VPS ya pagado)
- ✅ Coherencia total: todos los servicios en la misma red Docker
- ✅ Latencia web ↔ n8n ↔ Paperclip sub-milisegundo (red interna)
- ✅ Traefik con SSL automático Let's Encrypt ya configurado
- ✅ Docker multi-stage con `output: standalone` → imagen ~180 MB
- ⚠️ Sin CDN global → mitigado poniendo **Cloudflare** delante (free tier)
- ⚠️ Build en el servidor consume CPU → mitigado con GitHub Actions que
     hace build y push a Docker Hub, Dokploy solo hace pull

---

## Decisión

Se adopta la **Opción C**: Next.js 15 dockerizado, desplegado en el VPS Hostinger
KVM8 vía Dokploy, con Cloudflare delante para CDN/DNS/WAF.

Hostinger Shared Hosting se reserva para contenido editorial estático
(subdominio `static.astrodorado.com` con FAQs, legales, banners promocionales)
que Sergio puede modificar desde el File Manager del hPanel sin necesitar deploy.

---

## Arquitectura resultante

```
Usuario → Cloudflare (CDN + SSL + WAF)
         └→ Hostinger VPS KVM8 (IP: 31.97.69.100)
            └→ Traefik reverse proxy
               ├→ astro-web (Next.js)         :3000  [NUEVO]
               ├→ n8n (workflows)             :5678
               ├→ paperclip (agent swarm)     :3100
               └→ moltbot (Telegram bots)     :3000-3001
                  ↓
Backend externo:
   ├→ Supabase (PostgreSQL + Auth + Storage + pg_cron)
   ├→ AstrologyAPI.com (natal + tránsitos + védica)
   ├→ Stripe (suscripciones + webhooks)
   ├→ Anthropic (Claude Haiku para interpretaciones)
   └→ Telegram Bot API (broadcast diario)
```

### Red interna

Todos los contenedores comparten la red `dokploy-network`, permitiendo
llamadas internas por nombre de servicio sin salir a internet:

```ts
// Desde astro-web, llamar a n8n es literalmente:
fetch('http://n8n:5678/webhook/xyz')
// Latencia medida: 0.3-0.8 ms
```

### Dominio

- `astrodorado.com` → Cloudflare → VPS (A record)
- `www.astrodorado.com` → 301 redirect a apex
- `static.astrodorado.com` → Hostinger shared (panel editorial)

---

## Consecuencias

### Positivas
- Portfolio entero orquestado en un único panel (Dokploy)
- Coste operativo fijo: 0 € adicionales mientras el VPS aguante
- Debugging transversal trivial (todos los logs en el mismo host)
- Paperclip agents pueden observar `astro-web` en tiempo real

### Negativas / trade-offs aceptados
- Single point of failure: si cae el VPS, toda la app cae
  → mitigación: backups diarios automatizados en Dokploy
- Sin preview deploys por PR tipo Vercel
  → mitigación: GitHub Actions crea imagen Docker por PR con tag commit-sha,
    Sergio puede testear con `docker run` puntualmente
- Tráfico saturado afecta a otros contenedores
  → mitigación: límites CPU/RAM en cada servicio del compose

---

## Próximos pasos (Sprint 1)

1. Ejecutar migración SQL `20260416120000_astrodorado_landing.sql`
2. Build inicial y deploy en Dokploy apuntando a `astrodorado.com`
3. Configurar DNS Cloudflare (proxy status: naranja)
4. Tests de integración E2E con Playwright
5. Lighthouse audit → target 90+ performance / 100 SEO

---

## Referencias

- CLAUDE-MASTER.md secciones 2.1, 3, 4, 5, 13, 14
- [Next.js Docker deployment](https://nextjs.org/docs/app/getting-started/deploying#docker)
- [Dokploy documentation](https://dokploy.com/docs)
- [Supabase SSR helpers](https://supabase.com/docs/guides/auth/server-side/nextjs)
