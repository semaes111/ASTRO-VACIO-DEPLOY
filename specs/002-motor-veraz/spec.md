# SDD 002 — Motor Veraz (compute-then-narrate)

> Metodología: `/spec-driven-development` + `/wizard`. Constitución base: `.specify/memory/constitution.md` (SDD 001).
> Criterio de aceptación rector: **Protocolo de Veracidad, CLAUDE-MASTER.md §1.3** — *"No inventas datos ni cifras. Priorizas la verdad sobre la utilidad aparente."*

## 1. Intent

El motor genérico de informes (`lib/generators/_template-engine/generate.ts`) tenía dos patrones:

| Patrón | Quién calcula | Riesgo §1.3 |
|---|---|---|
| **compute-then-narrate** | código (Swiss Ephemeris) → LLM narra | ninguno (dato verificable) |
| **LLM-computes** | el LLM deduce y narra | **alto: inventa cifras plausibles-pero-no-verificables** |

Objetivo: **erradicar el patrón LLM-computes** de todo el catálogo. El LLM interpreta; nunca calcula.

## 2. Requisitos

- **R1** — Ningún número, animal, elemento o pilar del informe puede ser generado por el LLM; debe provenir de una función pura verificable.
- **R2** — Los cálculos son deterministas (misma entrada → misma salida) y validados contra datos reales conocidos.
- **R3** — Honestidad sobre los límites (§1.3): si un cálculo no puede ser preciso (p.ej. ventana del Año Nuevo chino), se declara, no se finge.
- **R4** — Cambio aditivo: no romper los 18 productos que ya generan; el bloque de hechos es opcional por producto.

## 3. Plan (dos fases)

### Fase A — cálculo local determinista (SIN dependencias externas) ✅ IMPLEMENTADA
- `lib/astrology/numerology.ts` — numerología pitagórica pura (Camino, Expresión, Alma, Personalidad, Año Personal).
- `lib/astrology/chinese-zodiac.ts` — animal, elemento, polaridad y pilar de año (BaZi).
- `lib/astrology/computed-facts.ts` — dispatcher que inyecta el bloque "DATOS CALCULADOS" en el prompt.
- Cableado en `generate.ts`: el bloque se inserta entre la carta natal y las secciones, con directiva *"usa estos valores EXACTOS, NO los recalcules"*.
- Productos migrados: **numerologia**, **horoscopo-chino**.

### Fase B — astronomía de precisión (BLOQUEADA en dato del operador)
- **oraculo-360**: Revolución Solar (cruce solar), tránsitos datados, dashas védicas y oráculos deterministas.
- El LLM no puede producirlos sin inventar → requiere el **pipeline pyswisseph** (el que generó el PDF integral).
- Bloqueante: ubicación/interfaz del pipeline (script Python / servicio VPS / API HTTP / salida JSON o PDF).
- Al cablear → el guard del checkout desbloquea oraculo-360 automáticamente.

## 4. Tareas (TDD, wizard)

- [x] **T1** Tests primero (mutation-resistant) contra datos reales: `tests/astrology.test.ts` (7 tests).
- [x] **T2** `numerology.ts` — validado: Sergio 30/06/1973 → Camino 11, Expresión 8, Alma 11, Personalidad 6, Año Personal 2026 = 1.
- [x] **T3** `chinese-zodiac.ts` — validado: 1988 → Dragón/Tierra/Yang; 1973 → Buey/Agua/Yin (Gui-Chou).
- [x] **T4** `computed-facts.ts` — dispatcher por slug.
- [x] **T5** Cableado en `generate.ts` (aditivo, R4 intacta).
- [x] **T6** Fase 5 wizard: 7/7 tests, tsc limpio, build verde.
- [ ] **T7** Fase B: cablear oraculo-360 al pipeline pyswisseph (bloqueada).
- [ ] **T8** (revisión adversarial pendiente) auditar el resto del catálogo por si algún otro producto delega cálculo al LLM.

## 5. Validación §1.3

| Chequeo §1.3 | Estado tras Fase A |
|---|---|
| ¿Puedo verificar cada dato? | Sí para numerologia/horoscopo-chino (funciones puras testeadas) |
| ¿Certeza correcta en el lenguaje? | Sí; el caveat del Año Nuevo chino declara la incertidumbre |
| ¿Invento algo para completar? | No; los pilares mes/día/hora se declaran no-computables aquí |
