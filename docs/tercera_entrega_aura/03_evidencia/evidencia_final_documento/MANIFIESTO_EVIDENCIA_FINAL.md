# Manifiesto de evidencia final — Tercera entrega AURA

> **Fecha:** 2026-06-27  
> **Commit:** PHASE4_EVIDENCE_FINAL  
> **Datasets:** `titanic.csv` (891 filas × 12 columnas), `synthetic_ground_truth.csv` (15 filas × 9 columnas)  
> **Viewport:** 1440 × 1000  
> **Playwright:** Chromium headless, servidor fresco (CI=1)  
> **Spec:** `src/tests/e2e/academic-evidence.spec.ts`

## Capturas generadas

| # | Archivo | SHA-256 | Bytes | Sección sugerida |
|---|---|---|---|---|
| 01 | `01_carga_local_titanic.png` | `773f6ab39cd7b5c82eb49912988aa29487c2f2c850859585f414af2e716de186` | 90,156 | Arquitectura / Carga local |
| 02 | `02_hallazgos_titanic.png` | `dcecc89b6ae521e8be68674578a9cc6e311d8df33a060dfafc9f0adb64389943` | 87,842 | Resultados / Motor determinista |
| 03 | `03_paquete_evidencia.png` | `86076fb76a7cd2507392f1d684524a4fe70c6e13413af09c7e10b5a30ad0f864` | 498,356 | Diseño / Contratos de evidencia |
| 04 | `04_diagnostico_asistido.png` | `...` | ... | Diseño / Diagnóstico |
| 05 | `05_plan_remediacion.png` | `...` | ... | Gobernanza / Plan |
| 06 | `06_revision_humana.png` | `1130898a716a65e6226ab8ffe514ebea370d6638581516d1730a291260950ba3` | 134,234 | Gobernanza / HITL |
| 07 | `07_script_propuesto.png` | `d88c4546c53288f75614e3ab2aa159cc818d6857cfcfcff5f571ed094224b0e3` | 126,170 | Implementación / Script |
| 08 | `08_validacion_script.png` | `4fe9b511eaec24faf926b6720861fa229a29eaf76198709e170a398dead45624` | 118,651 | Implementación / Validación |
| 09 | `09_bloqueo_manipulacion.png` | `5791015e21c7d26a259bdca53808d355669e153cf1980a44c26dc803856fa012` | 120,614 | Seguridad / Fail-closed |
| 10 | `10_laboratorio_modelos.png` | `be420064fa4fc2ed274eaf3cc2c3f94b16a6c6455c75eb27aa0d25a3c8b02710` | 81,131 | Experimentación |
| 11 | `11_resultados_ground_truth.png` | `a741b78c6b4e3e0eead8a54ab3da258e9837d34eabb7d088b4e507380dbb15fe` | 88,850 | Resultados / Validación |

## Tablas académicas

| Archivo | Contenido |
|---|---|
| `01_tabla_diccionario_componentes.md` | 11 componentes: nombre técnico, académico, función, evidencia, riesgo |
| `02_tabla_resultados_titanic.md` | 10 elementos evaluados sobre Titanic con interpretación y limitación |
| `03_tabla_resultados_ground_truth.md` | 8 métricas (TP, FP, FN, precisión, recall, F1) con fórmulas |
| `04_tabla_evidencia_objetivos.md` | 8 objetivos específicos con evidencia, resultado y sección sugerida |
| `05_tabla_laboratorio_llm.md` | 5 modelos/proveedores con estado, latencia y observaciones |

## Fragmentos de código

| Archivo | Contenido |
|---|---|
| `fragmentos_codigo_para_documento.md` | 6 fragmentos: CSV, regla, evidencia, validación, script, bloqueo |

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Playwright E2E | 11/11 passed |
| Tests deterministas | 12/12 passed (`deterministicValidation.test.ts`) |
| Tests de contrato | pasando (`scriptGenerationStepV2`, `scriptValidatorV2`, `scriptBuilderV2`) |
| Build | ~3s |
| Python | No ejecutado |
| Reauditoría | No ejecutada |
| HealthDelta | No calculado |

## Límites de interpretación

1. **Harness determinista:** Las capturas 03-09 usan `buildPhase4TitanicFixture` que sustituye al LLM real. Esto garantiza reproducibilidad pero no demuestra calidad del diagnóstico LLM.
2. **No ejecución Python:** El script se genera pero no se ejecuta. `syntax: not_run` visible en capturas.
3. **Dataset sintético limitado:** 15 filas. Las métricas de ground truth reflejan el motor determinista, no el pipeline completo.
4. **Laboratorio experimental:** No hay benchmark formal con ≥30 repeticiones. No se declara modelo ganador.
5. **Sin HealthDelta:** La mejora del dataset no se ha medido. Solo puede afirmarse tras ejecución controlada y reauditoría.

## Claims permitidos en el documento

- AURA perfila el dataset localmente.
- AURA genera hallazgos deterministas reproducibles.
- AURA estructura la evidencia antes del diagnóstico asistido.
- AURA separa diagnóstico, propuesta de acción y decisión humana.
- AURA genera scripts revisables desde acciones aprobadas.
- AURA exige revisión humana antes de ejecutar acciones.
- El laboratorio de modelos permanece experimental.
- La mejora efectiva del dataset solo puede afirmarse después de ejecución controlada y reauditoría.

## Claims prohibidos en el documento

- "AURA corrige el dataset."
- "AURA ejecuta Python de forma definitiva."
- "AURA calcula HealthDelta."
- "AURA elimina alucinaciones."
- "Benchmark formal completado."
- "Modelo X es mejor que modelo Y."
