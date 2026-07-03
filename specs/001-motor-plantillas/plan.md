# PLAN 001 — Motor Genérico de Informes por Plantilla
Estado: PROPUESTA · Depende de: spec.md (freeze)

## Arquitectura (el CÓMO)
Dispatcher fallback ADITIVO en app/api/generate/[productType]/route.ts:
  DISPATCHERS[productType] → bespoke (intacto)
  ∅ y ∃ plantilla activa   → generateFromTemplate(userReportId, slug)   ← NUEVO
  ∅ y ∄ plantilla          → 400 explícito (comportamiento actual)

lib/generators/_template-engine/generate.ts — pipeline:
 1. resolveBirthData(_shared/birth-data)  ← input_data.person del user_report
 2. computeNatalChart (astrología TS in-repo, la de vehiculo)
 3. loadTemplate(slug) (_shared/template-loader, cache TTL)
 4. data_schema (jsonb en report_templates) como CONTRATO de secciones
 5. UNA llamada DeepSeek streaming (patrón horóscopo validado hoy) → JSON estricto
    { sections: { <id>: <html_fragment> } } · max_tokens 16000 · retry 1×
    La plantilla NO viaja en el prompt (ahorro y R3): viajan los briefs del schema.
 6. Inyección server-side con node-html-parser: por sección,
    querySelector(selector).innerHTML = sanitizeGeneratedHtml(fragment)
 7. assertValidReportHtml → composeReport/report-updater (_shared) → progress → email (lib/email/resend)

## Contrato data_schema v1 (jsonb por plantilla)
{ "schema_version": 1,
  "product_brief": "promesa y enfoque del producto en 2-3 frases",
  "tone": "premium AstroDorado",
  "sections": [ { "id": "s1", "selector": "#hero p.lead", "title": "…",
                  "brief": "qué debe contar", "max_words": 180 } ] }
Autoría: script scripts/derive-template-schema.ts propone secciones (headings + bloques
con selector único); revisión humana por plantilla; UPDATE in place de data_schema
(html_template intocado → sin nueva versión) con registro en notes.

## Política de fallos
- Sección sin match de selector → skip + log en progress (la zona conserva su contenido
  de plantilla: degradación invisible, nunca rotura).
- Parse LLM fallido → 1 retry; si persiste → status error con diagnóstico (patrón horóscopo).
- >50% secciones no inyectadas → error fatal (herencia política vehiculo).

## Coste (R3)
Input 2-4k tok (datos+chart+briefs) · output 6-10k ⇒ $0,002-0,004/informe. Infra nueva: 0.
Dependencia nueva: node-html-parser (server-only, ~30KB, $0). Justificación: parsear DOM
con parser real, no regex (constitución P5 no aplica abstracción especulativa: es necesidad).

## Constitution Check
P1 sin `any`: tipos TemplateDataSchema/SectionSpec/EngineResult + narrowing del JSON LLM. ✓
P2 Server-First: se integra en Route Handler EXISTENTE (endpoint reutilizable invocado por
   webhook; seguridad elevada) — desviación ya justificada por diseño previo. ✓
P3 Seguridad: RLS intacta; secretos server-only (Vault bridge ya operativo). ✓
P4 Test-First: T1 (tests inyector con fixtures reales) precede a T3 (motor). ✓
P5 YAGNI: 1 llamada LLM, sin colas, sin servicios nuevos, chasis _shared reutilizado. ✓

## Fases
F1 Motor + pilotos (karma, numerologia) + smoke E2E prod  ← esta iteración
F2 Schemas de las 14 plantillas restantes en tandas de 4-5, gate smoke por tanda
F3 horoscopo-chino (plantilla nueva desde Drive + schema + smoke)
F4 oraculo-360 (composite de informes; decisión de diseño con Sergio)
