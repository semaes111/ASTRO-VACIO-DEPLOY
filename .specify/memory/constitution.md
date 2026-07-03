# Constitución — ASTRO-VACIO-DEPLOY (NextHorizont AI)
Principios embebidos de la skill spec-driven-development (v. completa en el skill):
1. TypeScript estricto: prohibido `any`; `unknown`+narrowing; tipos derivados.
2. Acceso a datos Server-First; desviaciones (Route Handlers/Server Actions/cliente) justificadas.
3. Seguridad por defecto: RLS en toda tabla; secretos solo en servidor.
4. Test-First no negociable (rojo→verde→refactor); integración para Route Handlers y contratos.
5. Simplicidad/YAGNI; RSC-first; sin abstracciones sin problema concreto.
Stack: Next.js 15 App Router · Supabase (RLS) · TS strict · Vercel.
