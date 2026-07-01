# FREEZE PHASE 6 — UI Wrapper + HealthDelta Dashboard

> **Estado:** CONGELADA
> **Fecha:** 2026-07-01
> **SHA base:** `d07b035594c18e5f3414b549469307447bb5fb0e`
> **Freeze commit:** `b689cce5012edf33d27e2e85bb325878ab79125a`

---

## Phase 6 — Resumen

Phase 6 implementa un UI wrapper alrededor de `runImprovementFlow` de Phase 5, exponiendo el pipeline de mejora visual dentro de la interfaz de AURA como entrada accesible desde la navegación.

**No modifica Phase 5** (congelada en `40a3769`). Usa los servicios existentes de Phase 5 como black box.

---

## Loops cerrados

| Loop | SHA completo | Objetivo | Entregable |
|---|---|---|---|
| L0 | `b94ee00c06d8425032fe23e7a0241e8507341585` | Diseño | `PHASE6_UI_WRAPPER_DESIGN.md` |
| L1 | `e612b71ec4de61ec1705edebde1a41d1309351ee` | Panel React + wrapper | `ImprovementRunPanel.tsx` (2 tests) |
| L2 | `06d4fd94c46b67ff2a616ad01446cb4716e6ab78` | Visualización HealthDelta | `HealthDeltaDashboard.tsx` (21 tests) |
| L3 | `9a8e88411c0df0ffe92d6a039300314514ef1ee1` | Export JSON + Logs | `ImprovementRunExportCard.tsx` (12 tests) + `ExecutionLogsPanel.tsx` (19 tests) |
| L4 | `ad38bd49cd08974a5a93d2f50da476a31199076a` | Estados visuales completos | `ImprovementRunPanel.tsx` refactorizado (2 tests) |
| L5 | `d07b035594c18e5f3414b549469307447bb5fb0e` | Integración rutas AURA | `ImprovementRunPage.tsx` + nav "Health Delta" (2 tests) |

---

## Componentes finales

| Componente | Archivo | Descripción |
|---|---|---|
| `ImprovementRunPanel` | `src/components/ImprovementRunPanel.tsx` | Panel principal — 4 estados (idle/running/done/error), usa `runImprovementFlow` |
| `HealthDeltaDashboard` | `src/components/HealthDeltaDashboard.tsx` | Visualización de delta de salud — score bar, status badge, issue counts, caveats |
| `ImprovementRunExportCard` | `src/components/ImprovementRunExportCard.tsx` | Export JSON — download + clipboard + preview colapsable |
| `ExecutionLogsPanel` | `src/components/ExecutionLogsPanel.tsx` | Logs de ejecución — clasificación info/warn/error, runtime badge, expand/collapse |
| `ImprovementRunPage` | `src/components/ImprovementRunPage.tsx` | Wrapper de página — header con Back, breadcrumb Phase 6 |
| `App.tsx` | `src/App.tsx` | Nav "Health Delta" integrado — desktop + mobile, `goImprovementRun()` |

---

## Flujo visual final

```
[Health Delta nav]
       ↓
[ImprovementRunPage]
       ↓
[ImprovementRunPanel — idle]
       ↓ click "Run Improvement Flow"
[ImprovementRunPanel — running]
  ├── spinner + 6 pasos del pipeline
  └── aviso: no Python en AURA
       ↓ flow completo (Colab externo)
[ImprovementRunPanel — done]
  ├── HealthDeltaDashboard — score, delta, status, caveats
  ├── ExecutionLogsPanel — logs, runtime badge, duración
  └── ImprovementRunExportCard — download/copy JSON
       ↓ "Run Again"
[ImprovementRunPanel — idle]
```

---

## Pruebas documentadas

### Tests de componentes Phase 6

| Loop | Archivo de test | Tests |
|---|---|---|
| L1 | `ImprovementRunPanel.test.tsx` | 2 |
| L2 | `HealthDeltaDashboard.test.tsx` | 21 |
| L3 | `ImprovementRunExportCard.test.tsx` | 12 |
| L3 | `ExecutionLogsPanel.test.tsx` | 19 |
| L4 | `ImprovementRunPanel.test.tsx` | 2 |
| L5 | `ImprovementRunPage.test.tsx` | 2 |
| **Total** | | **58** |

### Tests de regresión (Phase 5, no modificada)

| Archivo de test | Tests |
|---|---|
| `improvementRunService.test.tsx` | 25 |
| `improvementRunE2E.test.tsx` | 18 |
| **Total** | **43** |

**Total general Phase 6 + regresión:** 101 tests

---

## Claims permitidos (Phase 6)

- UI wrapper que invoca `runImprovementFlow` de Phase 5.
- Visualización de `HealthDeltaV1` sobre fixture controlado.
- Export de `ImprovementRunV1` como JSON.
- Logs de orquestación de AURA.
- Navegación "Health Delta" integrada en AURA.
- `improvementRun` de Phase 5 serializado en session storage.

---

## Claims prohibidos (Phase 6)

- No afirma dataset real o validación externa independiente.
- No afirma que HealthDelta sea validación formal externa.
- No afirma mejora sobre datos productivos.
- No afirma benchmark formal de utilidad.
- No ejecuta Python dentro de AURA.
- No usa datasets de usuarios.

---

## Limitaciones

- `runImprovementFlow` es un servicio Phase 5 — la UI lo consume como black box.
- `HealthDelta` se calcula sobre fixture controlado, no sobre dataset real.
- Python se ejecuta externamente en Colab — AURA solo orquesta.
- La sesión de mejora no persiste automáticamente en el pipeline principal de AURA.
- La navegación "Health Delta" es un workspace aislado (no comparte estado con `MainPipeline`).

---

## Evidencia: No Python en AURA

- `ImprovementRunPanel` importa dinámicamente `improvementRunService` que usa `executeControlledRun`.
- `executeControlledRun` delega a `buildColabNotebookJSON` que genera un notebook `.ipynb`.
- El notebook se descarga como archivo JSON — nunca se ejecuta en el browser.
- El aviso visible en todos los estados: "AURA does **not** execute Python inside the browser."
- `executionService.ts` (Phase 5): "Does NOT execute Python directly. Delegates to external Colab runtime."

---

## Evidencia: Solo fixtures controlados

- `ImprovementRunPanel` usa `BEFORE` / `AFTER` fixtures hardcodeados (3 filas de direcciones).
- Los fixtures se pasan como `beforeCsv` / `afterCsv` props a `runImprovementFlow`.
- El panel recibe `datasetName` con valor por defecto `'demo_fixture.csv'`.
- El aviso en idle state: "This run executes the full improvement pipeline over a **controlled fixture copy**."
- El aviso en error state: "The original dataset was **not** modified. This run used a controlled fixture copy."

---

## Evidencia: Phase 5 no fue modificada

- SHA de freeze Phase 5: `40a376929fcaad13b1809bd0c8ba895011ceb8cb`
- Todos los servicios de Phase 5 (`executionService.ts`, `reauditService.ts`, `improvementRunService.ts`) intactos.
- Contratos v2 (`contracts/llm/`) intactos.
- `FREEZE_PHASE5.md` no fue tocado.
- Phase 3 y Phase 4 intactas.

---

## Decisión de congelamiento

Phase 6 L0–L5 completados exitosamente. Todos los entregables implementados, 101 tests passing (58 componentes + 43 regresión), constraints respetadas.

Se congela Phase 6 en SHA `b689cce5012edf33d27e2e85bb325878ab79125a`.

---

## Próxima fase recomendada

**Phase 7 — QA visual, evidencia capturable y documentación para entrega**

- Capturas de pantalla de cada estado visual (idle/running/done/error).
- Evidencia de navegación Health Delta en browser.
- Validación de que la integración no rompe BenchmarkLab ni MainPipeline.
- Documentación de claims permitidos en el contexto de entrega a stakeholder.
- Evaluación de si `improvementRun` debe persistir en el pipeline principal de AURA o mantenerse como workspace aislado.
