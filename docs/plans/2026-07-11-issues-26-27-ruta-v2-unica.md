# Ruta V2 única y Laboratorio ejecutable — Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Corregir los issues #26 y #27 antes de ejecutar OE4, demostrando que método, modelo, parámetros, validación y trazabilidad corresponden exactamente a la ejecución real.
**Architecture:** Una fábrica canónica produce el snapshot V2; producto y Laboratorio lo consumen sin reconstruirlo. Un recibo firmado por hashes certifica prompt, método, modelo y parámetros. OE4 V2 evalúa 45 diagnósticos y deja los scripts deterministas para los nueve representantes de OE5.
**Tech Stack:** React, TypeScript, Vitest, Playwright, IndexedDB, Ollama, contratos V2 y artefactos JSON/CSV/PDF/Markdown.

---

## Regla de bloqueo

No ejecutar las 45 corridas mientras cualquiera de estos gates esté rojo:

- ruta producto y Laboratorio usan snapshots distintos;
- un método no altera realmente el prompt y sus hashes;
- una respuesta reducida con solo `contractId` puede quedar completada;
- el modelo o los parámetros observados difieren de los solicitados;
- faltan warm-ups, evaluación productiva o recibos persistidos;
- una API key aparece en almacenamiento persistente, sync o exportación.

## Estado de ejecución — 12 de julio de 2026 (post AURA-CIERRE-P0-01R3)

- [x] Protocolo V2: 45 diagnósticos, 15 warm-ups y scripts deterministas.
- [x] Fábrica canónica compartida por producto y OE4.
- [x] Recibo verificable persistido en diagnóstico y corrida formal.
- [x] Propagación del método real desde Configuración.
- [x] Suite completa, typecheck, build, E2E controlado y actualización del grafo.
- [x] **P0-01R3 APROBADO**: DiagnosisFailureEvidenceV2 separa fallo de éxito; cero `as any`.
- [x] **P0-01R3 APROBADO**: `runStructuredDiagnosis` valida `requestedModel` ANTES del proveedor.
- [x] **P0-01R3 APROBADO**: `buildExecutionReceiptV1` rechaza recibos inconsistentes y modelo observado diferente.
- [x] **P0-01R3 APROBADO**: Exportación `valid`/`invalid`/`not_run` recalcula hashes y comprueba correspondencia completa.
- [x] **P0-01R3 APROBADO**: apiKey case-insensitive recursivo, incluidos arrays.
- [x] **P0-01R3 APROBADO**: Estado exclusivo éxito/fallo; limpieza local y superior.
- [x] **P0-01R3 APROBADO**: 1725 tests, typecheck, build, E2E y pruebas adversariales focales en verde.
- [x] **COMPLETO — P1**: métricas reales y procedencia verificable de validación/ejecución Python.
- [ ] **BLOQUEADO**: Smokes reales opt-in con los tres modelos instalados.
- [ ] **BLOQUEADO**: Campaña real ejecutada manualmente por el investigador.

## Cobertura faltante priorizada

| Prioridad | Flujo sin prueba suficiente | Prueba requerida |
|---|---|---|
| P0 | Configuración → diagnóstico V2 → proveedor | proveedor espía captura prompt exacto y recibo |
| P0 | Producto ↔ Laboratorio | igualdad de snapshot, prompt e hashes |
| P0 | Runner formal | parser y validador V2 reales; fallo cerrado |
| P0 | Modelo e inferencia | requested = observed, digest e inferenceHash |
| P0 | Credenciales | `apiKey` ausente en localStorage, API y exports |
| P1 | Laboratorio productivo | crear, ejecutar, evaluar y recuperar sin harness |
| P1 | Configuración | Guardar/Cancelar único; disponibilidad honesta |
| P1 | Smokes previos | 1×3×1, 3×1×1 y equivalencia producto-Lab |

## Task 1: Congelar OE4 V2 sin destruir V1

**Files:**
- Create: `experiments/final-evaluation/protocol.v2.json`
- Modify: `src/services/benchmark/finalEvaluationProtocol.ts`
- Modify: `src/services/benchmark/experimentTypes.ts`
- Test: `src/__tests__/finalEvaluationProtocol.test.ts`

**Step 1 — RED:** añadir expectativas para 45 diagnósticos, 15 warm-ups, 60 llamadas reales y ausencia de etapa LLM de script.

**Step 2 — Verify failure:**
`cd src && npm test -- --run __tests__/finalEvaluationProtocol.test.ts`

**Step 3 — GREEN:** preservar V1 como histórico y hacer V2 la versión ejecutable. Mantener matriz 3×3×5 y modelos congelados.

**Step 4 — Verify:** prueba focal, typecheck y comparación JSON ↔ constante TypeScript.

## Task 2: Fábrica canónica de entrada V2

**Files:**
- Create: `src/contracts/llm/diagnosisInputPackageV2.ts`
- Modify: `src/contracts/llm/types.ts`
- Modify: `src/contracts/llm/index.ts`
- Modify: `src/services/benchmark/experimentInputModes.ts`
- Test: `src/__tests__/diagnosisInputPackageV2.test.ts`

**Step 1 — RED:** para cada modo comprobar secciones incluidas/prohibidas, hashes diferentes, determinismo, deep freeze y rechazo de drift.

**Step 2 — RED:** demostrar que Contexto mínimo incluye el registro mínimo de todos los hallazgos pero no muestras ni estadísticas avanzadas.

**Step 3 — GREEN:** implementar `buildDiagnosisInputPackageV2(report, envelope, inputMode)` y convertir `buildExperimentInputPackage` en alias compatible, sin segunda lógica.

**Step 4 — Verify:** tests focales de input modes y contratos V2.

## Task 3: Snapshot y recibo de ejecución verificable

**Files:**
- Create: `src/contracts/llm/executionReceiptV1.ts`
- Modify: `src/contracts/llm/types.ts`
- Modify: `src/services/benchmark/experimentTypes.ts`
- Test: `src/__tests__/executionReceiptV1.test.ts`

**Step 1 — RED:** construir recibo válido y alterar individualmente modo, secciones, promptHash, inputHash, envelope, modelo e inferenceHash.

**Step 2 — GREEN:** serialización canónica, `receiptHash` y `validateExecutionReceiptV1` con fallo cerrado.

**Step 3 — Verify:** mismo snapshot produce recibo comparable excluyendo campos runtime documentados.

## Task 4: Diagnóstico normal consume la ruta canónica

**Files:**
- Modify: `src/contracts/llm/diagnosisSelector.ts`
- Modify: `src/components/DiagnosisStep.tsx`
- Modify: `src/contracts/llm/types.ts`
- Test: `src/__tests__/diagnosisV2InputPropagation.integration.test.tsx`

**Step 1 — RED:** seleccionar cada método, capturar el texto recibido por un proveedor espía y comprobar prompt/input/receipt hashes.

**Step 2 — GREEN:** pasar `inputMode` al selector, construir una sola vez el paquete, enviar exactamente `systemInstruction + "\n\n" + userPayload` y devolver snapshot + recibo en `DiagnosisExecutionResult`.

**Step 3 — Verify:** los tres métodos generan respuestas V2 completas y válidas contra el mismo envelope.

## Task 5: Propagar receiptHash a informe, remediación y script

**Files:**
- Modify: `src/contracts/llm/types.ts`
- Modify: `src/contracts/llm/remediationContextV2.ts`
- Modify: `src/contracts/llm/remediationBuilderV2.ts`
- Modify: `src/contracts/llm/remediationValidatorV2.ts`
- Modify: `src/contracts/llm/scriptBuilderV2.ts`
- Modify: `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- Modify: `src/components/DiagnosisStep.tsx`
- Test: `src/__tests__/executionTraceabilityChain.test.ts`

**Step 1 — RED:** JSON/PDF, plan, contrato de script y `.py` deben conservar el mismo receiptHash.

**Step 2 — GREEN:** agregar `inputReceiptRef`, incluirlo en hashes y generar encabezado Python desde AURA.

**Step 3 — Verify:** cualquier cambio de referencia invalida plan o script.

## Task 6: Runner formal real y warm-ups

**Files:**
- Create: `src/services/benchmark/formalOllamaRuntime.ts`
- Modify: `src/services/benchmark/experimentRunner.ts`
- Modify: `src/services/benchmark/experimentSchedule.ts`
- Modify: `src/services/benchmark/experimentTypes.ts`
- Test: `src/__tests__/formalOllamaRuntime.test.ts`
- Test: `src/__tests__/experimentRunner.test.ts`

**Step 1 — RED:** una respuesta con solo `contractId` debe fallar; una respuesta V2 válida debe completar.

**Step 2 — RED:** modelId solicitado distinto del observado, parámetros distintos o digest distinto deben fallar.

**Step 3 — RED:** exigir exactamente 15 warm-ups ejecutados y excluidos.

**Step 4 — GREEN:** eliminar la segunda llamada LLM de script, ejecutar diagnóstico V2, registrar recibo y conservar scripts deterministas para representantes.

## Task 7: Creación y evaluación productiva del Laboratorio

**Files:**
- Create: `src/services/benchmark/formalCampaignService.ts`
- Modify: `src/components/benchmark/BenchmarkCampaignLab.tsx`
- Modify: `src/App.tsx`
- Modify: `src/services/benchmark/evaluationService.ts`
- Test: `src/__tests__/formalCampaignService.test.ts`
- Test: `src/__tests__/BenchmarkCampaignLab.test.tsx`

**Step 1 — RED:** producción crea campaña con dataset/hash/preflight reales y 45 snapshots V2.

**Step 2 — RED:** cada resultado validado pasa automáticamente por el oráculo y se persiste.

**Step 3 — GREEN:** App entrega dependencias reales, no las del harness. Mantener el harness solo para pruebas de UI, claramente separado.

## Task 8: Seguridad y Configuración honesta

**Files:**
- Create: `src/services/aiConfigStorage.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/SettingsPanel.tsx`
- Modify: `src/services/api.ts`
- Modify: `src/services/providers/chromeProvider.ts`
- Test: `src/__tests__/aiConfigStorage.test.ts`
- Test: `src/__tests__/SettingsPanel.test.tsx`

**Step 1 — RED:** inspeccionar localStorage y payload del API; `apiKey` nunca aparece.

**Step 2 — RED:** Cancelar descarta proveedor, modelo, método, temperatura y clave no guardados.

**Step 3 — GREEN:** clave solo en memoria/sessionStorage; retirar controles avanzados y autoAnalyze; mostrar temperatura solo donde aplica; corregir OpenRouter y recomendaciones.

**Step 4 — GREEN:** renombrar UI: Laboratorio → experimento → corrida, preservando tipos internos `campaign*`.

## Task 9: Smokes, E2E y cierre documental

**Files:**
- Create: `src/tests/e2e/oe4-v2-methods.spec.ts`
- Create: `src/tests/e2e/oe4-v2-real.optin.spec.ts`
- Modify: `docs/plans/2026-07-09-cierre-definitivo-aura.md`
- Modify: `docs/product/aura/NEXT_STEPS.md`
- Modify: `experiments/final-evaluation/README.md`

**Step 1 — Smoke A:** 1 modelo × 3 métodos × 1 repetición.

**Step 2 — Smoke B:** 3 modelos × 1 método × 1 repetición.

**Step 3 — Smoke C:** producto ↔ Laboratorio, mismo prompt/hash/secciones.

**Step 4 — Full gates:** pruebas focales → dependientes → suite completa → typecheck → build → E2E.

**Step 5 — Cierre:** actualizar grafo, documentar evidencia, commit y push solo con todos los gates verdes. Los issues se cierran únicamente con evidencia enlazada.
