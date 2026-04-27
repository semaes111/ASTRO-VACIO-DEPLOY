# ADR-002 · Patrón canónico de workers de generación de informes

**Estado:** Aceptado
**Fecha:** 2026-04-22 (rev. 2026-04-28: añadido calendario alternativo S5.2/S6)
**Contexto:** PR #1 (Turnos 2-6) del Roadmap del ADR-001
**Supersede:** parcialmente el patrón legacy de `lib/generators/ayurveda/`

---

## 1. Contexto y motivación

AstroDorado tiene un catálogo de **30 productos** (ver `astrodorado.reports`). De ellos:

| Categoría | Cantidad | Ejemplo | Patrón |
|---|---:|---|---|
| Oráculo simples | 8 | carta-natal, kabbalah | Legacy (Ayurveda-style) |
| Eventos electivos | 7 | evento-vehiculo, evento-mudanza | **Patrón canónico** (este ADR) |
| Negocios simples | 5 | neg-inicio-proyecto | Patrón canónico (con adaptación) |
| Relaciones (2 personas) | 5 | pareja-sinastria | Custom (NO usa este patrón) |
| Bundles | 4 | oraculo-360, eventos-360 | Custom (orquesta otros workers) |
| Otros | 1 | karma | Patrón canónico (sin tránsitos) |

Sin un patrón unificado, cada worker se implementa de forma ligeramente distinta, lo que produce:

- Duplicación de helpers (`lookupCity`, `buildBirthDateUTC`, `escapeHtml`, etc.)
- Inconsistencia en cómo se persiste el resultado en `user_reports`
- Cliente Supabase mal elegido (`createClient` vs `createAdminClient`)
- Sanitización de HTML inconsistente entre productos

**Decisión:** definir un patrón canónico documentado, con helpers compartidos en `lib/generators/_shared/`, y un scaffolder programático que lo replique.

---

## 2. Patrón canónico

### 2.1. Estructura de archivos

```
lib/generators/<slug>/
├── prompt.ts      → buildXxxPrompt(input): { system, user }
└── generate.ts    → generateXxx(userReportId): Promise<GenerateXxxResult>
```

**No** se crea un `types.ts` separado. Los tipos van inline:
- En `prompt.ts`: `XxxPromptInput` + `XxxPrompt` (ambos `export interface`)
- En `generate.ts`: `GenerateXxxResult` + tipos privados de validación

### 2.2. Imports obligatorios del orchestrator

Todos los `generate.ts` que sigan este patrón importan:

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWithSonnet } from '@/lib/ai/sonnet';
import { computeNatalChart } from '@/lib/astronomy/planets';
import { loadTemplate } from '@/lib/generators/_shared/template-loader';
import {
  resolveBirthData,
  countWords,
  escapeHtml,
} from '@/lib/generators/_shared/birth-data';
import {
  sanitizeGeneratedHtml,
  assertValidReportHtml,
} from '@/lib/generators/_shared/html-sanitizer';
import {
  markGenerationStarted,
  markGenerationReady,
  markGenerationError,
} from '@/lib/generators/_shared/report-updater';
import { buildXxxPrompt } from './prompt';
```

### 2.3. Constantes obligatorias

```typescript
const SLUG = '<slug>';                    // exactamente el slug en astrodorado.reports
const PRIMARY_COLOR = '<#hex>';           // de astrodorado.reports.primary_color
const ACCENT_COLOR = '<#hex>';            // de astrodorado.reports.accent_color
const MIN_OUTPUT_WORDS = 800;             // umbral mínimo razonable; target en DB
const MAX_TOKENS = 12000;                 // suficiente para 5500 palabras objetivo
const TEMPERATURE = 0.65;                 // 0.6-0.75 según necesidad de creatividad
```

### 2.4. Flujo del orchestrator (10 pasos)

```
1. Leer user_report y validar slug
2. Validar inputs específicos del producto (validateInputs)
3. Resolver birth data (resolveBirthData con fallback al user logueado)
4. Cargar template HTML (loadTemplate, cached)
5. Calcular natal chart del titular
6. Calcular transit chart en la fecha clave del producto
7. markGenerationStarted (transición atómica de status)
8. Construir prompt + generateWithSonnet (llamada a Claude)
9. Sanitizar HTML + assertValidReportHtml + countWords
10. markGenerationReady (persistir resultado y transicionar status='ready')
```

Cualquier excepción tras el paso 7 se captura, persiste como `markGenerationError`, y se relanza al caller.

### 2.5. validateInputs

Cada worker tiene su propia `validateInputs(inputData)` que:

1. Valida cada campo de `required_inputs` (de la fila de DB)
2. Lanza errores con mensajes claros (qué falta, qué formato)
3. Retorna un objeto tipado con los inputs ya saneados
4. Convierte fechas string a `Date` UTC + computes el día de la semana en español

### 2.6. wrapInHtmlDocument

Envuelve el HTML que devuelve Claude con un `<article class="<short>-report">` que contiene:

- Header con eyebrow ("<Producto> · AstroDorado"), `<h1>` con tagline, subtitle con datos clave
- El HTML interno (las 5 secciones que Claude devolvió)
- Footer con disclaimer legal

`<short>` es un prefijo CSS de 2-3 caracteres único por producto:
- `ev` → evento-vehiculo
- `emz` → evento-mudanza (mz para distinguirlo)
- `eb` → evento-boda
- `ay` → ayurveda (legacy)

### 2.7. Calendario alternativo (S5.2 / S6 según producto)

A partir de la versión actual del PR, todo worker que siga el patrón canónico **debe incluir un bloque de calendario alternativo**: una sección dedicada a listar los mejores días alternativos en una ventana de ±90 días alrededor de la fecha objetivo, junto con los peores días a evitar. Esto permite al cliente decidir si mantiene su fecha o la mueve, sin que el sistema le presione.

Implementación: el orchestrator llama a `findOptimalDays(natalChart, window)` (de `lib/generators/_shared/optimal-days.ts`) antes de construir el prompt, y pasa el resultado al builder como `alternativeDays: OptimalDay[]` y `daysToAvoid: OptimalDay[]`. El user prompt incluye un bloque pre-formateado con esos datos para que el LLM los use sin inventar.

Ubicación dentro del informe:

| Producto | Estructura previa | Dónde va el calendario |
|---|---|---|
| `evento-mudanza` | S5 = Calendario | S5 se subdivide en 5.1 (alrededor del día objetivo) y 5.2 (alternativas) |
| `evento-vehiculo` | S5 = Ritual del primer viaje (no era calendario) | Se añade **S6** nueva al final, dedicada al calendario alternativo |
| Workers nuevos scaffoldeados | sin estructura previa | Sección final dedicada (genéricamente "Calendario alternativo") |

Reglas del prompt para esta sección:

1. Si el día objetivo es **razonable**, NO presionar al cliente para que cambie. Enmarca la sección como _"por si la logística externa te obliga a moverla"_.
2. Si el día objetivo es **desfavorable** (lo determinaste en la sección de análisis del día), sí adviértelo claramente y enmarca las alternativas como recomendación más fuerte.
3. **NO inventes días**. Usa SOLO los listados en el bloque `DÍAS ALTERNATIVOS` del user prompt. El scoring que ahí aparece es trazable y auditable; los días inventados rompen ese contrato.
4. Cada alternativa debe acompañarse de su justificación astrológica concreta basada en las razones del scoring.

Coste de cómputo: `findOptimalDays` ejecuta ~30ms × N días en la ventana. Para 90 días, ~2.7s. El call site del worker debe estar consciente de este coste; si el worker corre en un Route Handler con timeout, debe estar dentro del límite (Vercel default = 10s/serverless).

Ver §6 para la API completa de `findOptimalDays`.

---

## 3. Cuándo aplica este patrón

✅ **APLICA** si el producto cumple TODAS estas condiciones:

1. Tiene **una sola persona** como titular (input `person` o legacy `birth_date`/`birth_time`/`birth_place`)
2. Tiene **una fecha clave** (de evento/compra/lanzamiento) sobre la que calcular tránsitos
3. Tiene **template HTML** pre-diseñado en `astrodorado.report_templates`
4. La generación es de **un solo paso** (no requiere orquestar otros workers)

Productos del catálogo que cumplen:
- evento-vehiculo ✓ (implementado)
- evento-mudanza ✓ (implementado)
- evento-firma-juicio (pendiente)
- evento-inmueble (pendiente)
- evento-viaje (pendiente)
- evento-ritual (pendiente)
- karma (pendiente — sin tránsitos pero sí 1 person + 1 chart)
- neg-inicio-proyecto (pendiente — 1 person + target_launch_date)
- neg-financiero-anual (pendiente — 1 person + target_year)

## 4. Cuándo NO aplica

❌ **NO APLICA** y requiere implementación custom:

| Caso | Productos | Razón |
|---|---|---|
| Sinastría (2 personas) | pareja-sinastria, pareja-destino, familiar, kamasutra-astro, amistad-karmica, evento-boda, neg-contratacion | Necesita 2 charts natales + sinastría |
| Múltiples personas (3+) | neg-socios | Necesita N charts + comparación grupal |
| Sin natal chart de persona | neg-carta-empresa, neg-marca-timing | Solo founding_date, no person |
| Bundle | oraculo-360, relaciones-360, eventos-360, negocios-360 | Orquesta otros workers |
| Worker legacy | ayurveda | Usa patrón propio anterior; respetado, no migrado |

**Regla:** si dudas, mira `lib/generators/_template_unsupported/README.md` (TODO crear cuando se implemente el primer worker custom).

---

## 5. Cómo añadir un worker nuevo

### 5.1. Vía scaffolder (recomendado para productos que aplican)

```bash
# 1. Genera el snapshot del catálogo (una sola vez):
npx tsx scripts/dump-catalog.ts > scripts/_catalog_snapshot.json

# 2. Scaffoldea el worker:
python3 scripts/scaffold-generator.py --slug=evento-viaje

# 3. Edita los archivos generados:
#    - lib/generators/evento-viaje/prompt.ts → redactar SYSTEM_PROMPT
#    - lib/generators/evento-viaje/generate.ts → completar FIXME en validateInputs

# 4. Registrar en el test runner:
#    - scripts/test-generator.ts → añadir a WORKERS y INPUT_FIXTURES

# 5. Ingestar template:
npm run ingest:one -- --slug=evento-viaje

# 6. Probar:
npx tsx scripts/test-generator.ts --slug=evento-viaje
```

### 5.2. Manual (para workers que no aplican el patrón)

1. Crear `lib/generators/<slug>/{prompt,generate}.ts` siguiendo la estructura
2. Usar los helpers de `_shared/` siempre que sea posible (sanitizer, updater)
3. NO duplicar `lookupCity` ni `buildBirthDateUTC` — siempre desde `_shared/birth-data.ts`
4. Si necesitas computar 2 charts (sinastría), llama `computeNatalChart` 2 veces
5. Documentar las desviaciones del patrón en el JSDoc del orchestrator

---

## 6. Helpers compartidos (`lib/generators/_shared/`)

| Archivo | Exports principales |
|---|---|
| `birth-data.ts` | `lookupCity`, `buildBirthDateUTC`, `escapeHtml`, `countWords`, `resolveBirthData` |
| `template-loader.ts` | `loadTemplate(slug)` con cache LRU + TTL |
| `html-sanitizer.ts` | `sanitizeGeneratedHtml`, `assertValidReportHtml` |
| `report-updater.ts` | `markGenerationStarted`, `markGenerationReady`, `markGenerationError` |
| `optimal-days.ts` | `findOptimalDays(natal, window)`, `buildWindowAroundTarget(target, opts)`, tipos `OptimalDay` y `OptimalDaysResult` |

Todos usan `createAdminClient` (service_role). Ningún helper depende de cookies de Next, así que funcionan en Route Handlers, scripts CLI, cron jobs, y Edge Functions.

---

## 7. Métricas y observabilidad

Cada worker debe persistir en `user_reports`:

| Campo | Tipo | Origen |
|---|---|---|
| `output_html` | text | HTML final tras `wrapInHtmlDocument` |
| `tokens_used` | int | `ai.tokens_in + ai.tokens_out` |
| `model_used` | text | `ai.model_used` (siempre `claude-sonnet-4-5-20250929` por ahora) |
| `actual_cost_usd` | numeric | `ai.cost_usd` calculado por `generateWithSonnet` |
| `generation_duration_ms` | int | `ai.duration_ms` |
| `generated_at` | timestamptz | momento de markGenerationReady |
| `status` | enum | `generating` → `ready` o `error` |
| `error_message` | text | si `status='error'`, mensaje legible |

Esto permite calcular en SQL:
- Coste medio por producto: `AVG(actual_cost_usd) GROUP BY report_slug`
- Tiempo medio de generación: `AVG(generation_duration_ms) GROUP BY report_slug`
- Margen real por venta: `amount_paid_eur - (actual_cost_usd * 0.95 EUR/USD)`

---

## 8. Decisiones rechazadas

### 8.1. Generar prompts con plantillas Mustache

**Rechazado** porque el SYSTEM_PROMPT de cada producto requiere conocimiento astrológico específico que no se puede generar mecánicamente. Una plantilla Mustache produciría prompts genéricos que generan informes mediocres. Decisión: el scaffolder produce un placeholder con TODO, y el redactor humano (o un Claude más caro) escribe el prompt real.

### 8.2. Migrar Ayurveda al patrón canónico

**Rechazado** por el principio "no toques lo que funciona". Ayurveda lleva semanas estable y migrarlo introduciría riesgo sin ganancia funcional inmediata. En el futuro, si se necesita refactorizar (ej: integrar con `loadTemplate`), se hará en un PR aparte.

### 8.3. Crear un orchestrator único parametrizable

**Rechazado** porque cada producto tiene validación de inputs específica, wrapper HTML específico, y métricas específicas. Un orchestrator único requeriría una configuración tan compleja que sería peor que tener N workers casi idénticos. Mejor patrón: copy-paste con scaffolder + helpers compartidos para el código verdaderamente reutilizable.

---

## 9. Roadmap de implementación

> **Update 2026-04-28:** los Sprints 2-5 ahora heredan automáticamente el patrón de calendario alternativo (§2.7). El scaffolder genera el código necesario sin intervención manual. La única tarea adicional es validar visualmente que la nueva sección renderiza correctamente con la paleta del producto.

| Sprint | Workers a entregar | Test E2E |
|---|---|---|
| ✅ Sprint 1 (este PR) | evento-vehiculo, evento-mudanza | `test-generator.ts` |
| Sprint 2 | evento-viaje, evento-firma-juicio, evento-inmueble, evento-ritual | Test cada uno |
| Sprint 3 | karma, neg-inicio-proyecto, neg-financiero-anual | Test cada uno |
| Sprint 4 | Workers custom (sinastrías, neg-socios, neg-carta-empresa, neg-marca-timing) | Test individual |
| Sprint 5 | Bundles (oraculo-360, etc.) — orquestación | Test e2e completo |

Cada sprint requiere:
1. Scaffold (si aplica) + redacción del SYSTEM_PROMPT
2. Ingesta del template HTML
3. Test E2E pasando con `--slug=X`
4. Smoke test en staging con datos reales del cliente

---

## 10. Referencias

- ADR-001: Roadmap de los 30 productos del catálogo (no incluido en este PR)
- PATCH-ingest-html-templates.md: detalle del fix de la migración del Turno 1
- `lib/generators/evento-vehiculo/`: implementación de referencia (con S6 calendario alt)
- `lib/generators/evento-mudanza/`: segunda implementación (con S5.2 calendario alt)
- `lib/generators/_shared/optimal-days.ts`: scoring auditable de electional astrology
- `scripts/scaffold-generator.py`: clonador programático (incluye patrón S6 alt)
- `scripts/test-generator.ts`: test runner genérico parametrizable
