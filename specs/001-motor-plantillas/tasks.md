# TASKS 001 — Motor Genérico (F1)
T0. [verificación] Auth interna de /api/generate (¿INTERNAL_API_SECRET?) y contrato
    exacto de invocación del webhook. Bloquea T8.
T1. [test-first] Unit tests del inyector: fixtures reales (karma v2, numerologia v2),
    casos: match, selector ausente (skip), sanitizado, >50% fallos → error.
T2. Tipos + parser/validador de data_schema (schema_version 1).
T3. Motor lib/generators/_template-engine/generate.ts (pipeline completo).
T4. Dispatcher fallback en route.ts (aditivo; bespoke intactos).
T5. Script scripts/derive-template-schema.ts (propuesta automática de secciones).
T6. data_schema pilotos: derivar → revisar → aplicar (karma, numerologia).
T7. tsc + build + PR único (motor+tests+schemas pilotos) → merge.
T8. Smoke E2E prod pilotos: user_report de prueba → generate → informe ready →
    verificación visual (solo contenido cambió) → registro coste real.
T9-T11. F2/F3/F4 según plan.
