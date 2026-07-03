# SPEC 001 — Motor Genérico de Informes por Plantilla
Fecha: 2026-07-03 · Estado: PROPUESTA (pendiente de freeze) · Autor: Claude (delegado por Sergio)

## Problema
El catálogo tiene 19 productos activos y comprables. El pago auto-dispara la generación
(webhook Stripe → /api/generate/{productType}), pero solo 3 productos tienen dispatcher.
Los 16 restantes (todos los basados en plantilla) devuelven 400 tras el cobro:
**se cobra sin entregar**. `data_schema=[]` en las 17 plantillas activas: no existe
contrato de inyección de contenido.

## Restricciones del propietario (resuelven la fase Clarify)
R1. Sin dañar estructuralmente el funcionamiento de la página.
R2. Sin perder información.
R3. Sin coste añadido.
R4. Sin alterarla visualmente.
→ R1/R4 descartan la parada de emergencia (ocultar 16 productos del catálogo).
→ La única opción compatible es dotar de capacidad real de generación a los 16.

## Necesidades y resultados (el QUÉ)
N1. Todo producto activo CON plantilla activa entrega un informe real, personalizado
    (datos natales del comprador) y con la estética exacta de su plantilla.
N2. El catálogo y las páginas públicas no cambian ni visual ni funcionalmente (R1, R4).
N3. Cero pérdida de información: plantillas v1/v2 y productos intactos (R2).
N4. Coste marginal por informe del mismo orden que el actual (~$0,003) y cero
    infraestructura nueva (R3).
N5. Fidelidad visual: solo se sustituye CONTENIDO en zonas mapeadas; DOM/CSS intactos (R4).
N6. Observabilidad: fallos por sección registrados; informe solo en error si el fallo
    es mayoritario (política heredada del generador de referencia).
N7. Trazabilidad de cobertura: estado por producto (pendiente → generable → validado E2E).

## Fuera de alcance (fases posteriores, riesgo residual documentado)
- `horoscopo-chino`: sin plantilla aún (Fase 3 — material en Drive + 12 imágenes listas).
- `oraculo-360`: bundle 99€, requiere decisión de composición (Fase 4).
Ambos siguen comprables y fallarían al generar hasta su fase. Mitiga: funnel con 0
tráfico en 30 días; prioridad de fases.

## Criterios de aceptación
A1. Compra simulada de un producto piloto → informe `ready` con HTML válido, secciones
    generadas, estética de plantilla intacta (diff visual = solo contenido).
A2. Los 3 generadores bespoke siguen funcionando sin cambios (regresión cero).
A3. `tsc --noEmit` limpio, cero `any`, tests del motor en verde.
A4. Coste medido por informe ≤ $0,005.
