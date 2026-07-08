# L13H — Freeze Diagnostic Report Pipeline

## Estado
- **Freeze:** GO
- **SHA base L13F:** `78de667`
- **SHA final:** `9e7185d` (antes de este documento)
- **Fecha:** 2026-07-07
- **Rama:** `main`

## Alcance congelado

### Camino principal
```
upload → profile → calibration → diagnosis → diagnostic_report → export
```

### Rama opcional
```
diagnostic_report → script → review → export
```

### Qué queda fuera del freeze
- Calibración embebida (`benchmarkResults`, `CalibrationEmbeddedPanel`) — congelado en Phase 5-9.
- Contratos LLM v2 (`RemediationPlanV2`, `ScriptContractV2`) — experimentales, no congelados.
- `ImprovementRun` / Health Delta — funcionalidad pre-L13, no modificada.
- `BenchmarkLab` — componente separado.
- Proveedores AI reales (Chrome AI, Ollama, cloud) — no modificados en L13.

## Artefactos congelados

### Modelo — DiagnosticReport
- **Archivo:** `src/services/diagnosticReport/types.ts`
- **Estructura:** `DiagnosticReport` con `metadata`, `status`, `evidenceBase`, `diagnosisSummary`, `findingGroups` (4 grupos), `recommendations`, `chartSpecs`, `exportReadiness`.
- **Status:** `deterministic_only`, `llm_diagnosis_available`, `llm_diagnosis_unavailable`.
- **Garantía:** `scoreModified: false` en metadata y findings. El score pertenece al motor determinista.

### Builder — buildDiagnosticReport
- **Archivo:** `src/services/diagnosticReport/diagnosticReportBuilder.ts`
- No muta `AuditReport`.
- Soporta los tres statuses.
- Extrae `findingGroups` desde `structuredDiagnosis` si está disponible; cae a `deterministic_only` si no.
- `scoreModified: false` en todos los caminos.

### Pipeline state
- **Archivo:** `src/components/MainPipeline.tsx`
- `PipelineState` incluye `diagnostic_report` entre `diagnosis` y `script`.
- `PipelineData` incluye `diagnosticReport: DiagnosticReport | null`.
- `DiagnosisStep.onContinue` llama `buildAndOpenDiagnosticReport`.
- `DiagnosticReportStep.onExportMain` va a `export`.
- `DiagnosticReportStep.onGenerateScript` va a `script`.
- Efecto de montaje: si se llega a `diagnostic_report` sin `diagnosticReport`, se construye automáticamente.

### DiagnosticReportStep UI
- **Archivo:** `src/components/DiagnosticReportStep.tsx`
- Summary cards con score, filas, columnas, hallazgos totales.
- Governance box con 5 principios (score no modificado, script opcional, HITL solo remediación...).
- Executive summary con badge de fuente (structured_v2, legacy_text, unavailable).
- ChartSpecs preview.
- 4 finding groups: confirmedRisks, possibleFalsePositiveCandidates, humanReviewRequired, optionalRemediationCandidates.
- Recommendations panel.
- Closeout: "Exportar no exige script. Script no es necesario para cerrar el análisis."
- Microcopy L13F: "La remediación abre una rama opcional."
- Botones: export main, generate script, back to diagnosis.

### Professional PDF generator
- **Archivo:** `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- **Tecnología:** jsPDF + jspdf-autotable.
- Gráficos vectoriales desde `chartSpecs` (bar, horizontal_bar, pie, table).
- Sin screenshots, sin DOM, sin provider LLM.
- Sin script requerido.
- `App.tsx` usa `generateDiagnosticPdfReport({ diagnosticReport })` cuando `diagnosticReport` existe; cae a `generatePdfReport` legacy si no.

### Optional remediation branch
- **Archivos:**
  - `src/components/remediation/OptionalRemediationNotice.tsx`
  - `src/components/remediation/RemediationBranchActions.tsx`
  - `src/components/remediation/index.ts`
- Integrados en `MainPipeline` en estados `script` y `review`.
- Logs: `remediation.branch.entered`, `remediation.branch.returned`, `remediation.branch.export_main`.
- `PipelineProgress` marca script y review con clase `stepper-step--optional`.

### Titanic E2E
- **Archivo:** `src/tests/e2e/titanic-l13g-e2e.spec.ts`
- **Fixture:** `src/tests/e2e/fixtures/titanic-l13g.csv`
- **Diagnosis mock:** `TITANIC_DIAGNOSIS_RESPONSE_V2` de `titanic-diagnosis-v2.fixture.ts`
- 4 tests: flujo principal, descargas, rama opcional, fallback determinista.
- Harness: `VITE_PHASE3_E2E_HARNESS`, `VITE_PHASE4_E2E_HARNESS`, `__PHASE4_INJECT__`, `__PHASE4_SET_STATE__`.

## Validaciones ejecutadas

| Comando | Resultado | Observación |
|---|---|---|
| `cd src && npm run typecheck` | ✅ limpio | Sin errores |
| `cd src && npm run build` | ✅ exitoso | 7.82s, chunks preexistentes |
| `vitest run diagnosticReportBuilder.test.ts` | ✅ 12/12 | 32ms |
| `vitest run diagnosticReportStep.test.tsx` | ✅ 12/12 | 389ms |
| `vitest run pipelineDiagnosticReportState.test.tsx` | ✅ 3/3 | 156ms |
| `vitest run diagnosticPdfGenerator.test.ts` | ✅ 12/12 | 342ms |
| `vitest run optionalRemediationBranch.test.tsx` | ✅ 10/10 | 103ms |
| `playwright test titanic-l13g-e2e.spec.ts` | ✅ 4/4 | 6.7s |
| L13G-01: flujo principal | ✅ | upload → report → export |
| L13G-02: descargas | ✅ | PDF, JSON, CSV filenames verificados |
| L13G-03: rama opcional | ✅ | notice → volver → export sin HITL |
| L13G-04: fallback determinista | ✅ | diagnóstico sin AI |
| `grep "claims prohibidos"` | ✅ | Solo en restricciones/guardrails |
| **Total tests** | **53/53** | |

## Fixture Titanic

- **Ruta:** `src/tests/e2e/fixtures/titanic-l13g.csv`
- **Líneas:** 892 (891 filas + header)
- **Columnas:** `PassengerId,Survived,Pclass,Name,Sex,Age,SibSp,Parch,Ticket,Fare,Cabin,Embarked`
- **Uso en E2E:** upload por `page.setInputFiles` sobre `[data-testid="csv-file-input"]`.
- **Aclaración:** este fixture es copia completa (891 filas) del dataset Titanic estándar. El archivo `src/experiments/datasets/titanic.csv` (21 líneas) es un truncado histórico y no debe usarse para E2E. La copia correcta está en `experiments/datasets/titanic.csv` (892 líneas).

## Garantías del freeze

- El informe diagnóstico principal no exige script.
- El PDF diagnóstico se genera sin script, sin HITL, sin provider LLM.
- HITL no es obligatorio para el reporte principal.
- El score no es modificado por el LLM (`scoreModified: false`).
- El diagnóstico asistido contextualiza evidencia, no recalcula score.
- La remediación es opcional y está correctamente señalizada.
- E2E evita proveedores reales (diagnóstico mock vía harness).
- El flujo principal `diagnosis → diagnostic_report → export` funciona sin dependencias externas.

## Limitaciones conocidas

- E2E corre en Vite dev server con harness (`VITE_PHASE3_E2E_HARNESS`, `VITE_PHASE4_E2E_HARNESS`). No se valida modo producción.
- No se valida el contenido binario profundo del PDF, solo descarga y tamaño mínimo (>100 bytes).
- No se valida generación real de script v2 en `titanic-l13g-e2e.spec.ts` (requiere `remediationContext`). Cubierto por `phase4-script-contract.spec.ts` y `aura-full-flow-export.spec.ts`.
- No se valida Colab sin `approvedCleaningScript` — botón deshabilitado verificado.
- No se validan proveedores reales (Chrome AI, Ollama, cloud) en este pipeline.
- El stepper CSS `stepper-step--optional` no tiene estilo visual asignado (clase presente, sin reglas CSS).

## Riesgos abiertos

- Ninguno nuevo para el pipeline diagnóstico.
- Deuda conocida de E2E con proveedores reales (Chrome AI profile) — documentada en `docs/product/aura/e2e/CHROME_AI_REAL_E2E_AUDIT.md`.
- Deuda conocida de contratos LLM v2 experimentales — documentada en `FREEZE_PHASE10.md`.

## Decisión final

**GO para congelar L13 Diagnostic Report Pipeline.**

El pipeline diagnóstico está implementado, documentado, testeado (53 tests) y validado E2E con fixture Titanic completo. El flujo principal `diagnosis → diagnostic_report → export` es estable y reproducible. La rama opcional de remediación está correctamente señalizada y no interfiere con el camino principal.

### Siguiente recomendado

**L14 Evidence Pack / Academic Packaging** — preparar paquete de evidencia académica del pipeline diagnóstico estabilizado, consolidando documentación, fixtures, resultados E2E y artefactos para depósito académico.
