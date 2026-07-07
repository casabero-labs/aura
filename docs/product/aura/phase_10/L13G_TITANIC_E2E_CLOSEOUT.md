# L13G — Titanic E2E Diagnostic Report Pipeline (Closeout)

## Propósito

Validar el flujo humano completo del nuevo pipeline diagnóstico de AURA mediante pruebas E2E Playwright usando el fixture Titanic (891 filas, 12 columnas). Confirmar que el camino principal `diagnosis -> diagnostic_report -> export` funciona sin script, HITL ni provider LLM real, y que la rama opcional de remediación está correctamente señalizada.

## SHA base de L13F

```
78de667bc935232aa6ba591b51ceb328e8c82d73 feat: clarify optional remediation branch
```

## Fixture usado

- **Archivo:** `src/tests/e2e/fixtures/titanic-l13g.csv`
- **Filas:** 891 datos + 1 header
- **Columnas:** `PassengerId,Survived,Pclass,Name,Sex,Age,SibSp,Parch,Ticket,Fare,Cabin,Embarked`
- **Fuente:** dataset Titanic estándar, copiado de `experiments/datasets/titanic.csv`
- **Fixture diagnóstico:** `src/tests/e2e/fixtures/titanic-diagnosis-v2.fixture.ts` (TITANIC_DIAGNOSIS_RESPONSE_V2 con 10 issues)

## Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `src/tests/e2e/fixtures/titanic-l13g.csv` | Creado — CSV Titanic completo de 891 filas |
| `src/tests/e2e/titanic-l13g-e2e.spec.ts` | Creado — 4 tests E2E Playwright |
| `docs/product/aura/phase_10/L13G_TITANIC_E2E_CLOSEOUT.md` | Creado — este documento |
| `docs/product/aura/NEXT_STEPS.md` | Actualizado — L13G marcado Cerrado |

**Nota:** `titanic-l13g.csv` ya existía como untracked al inicio del loop. La copia verificada está presente y funcional.

## Flujo principal validado (L13G-01)

```
upload → profile (891 filas, 12 columnas) → calibration (skip) → diagnosis (harness mock) → diagnostic_report → export
```

- CSV subido por `page.setInputFiles` sobre `[data-testid="csv-file-input"]`.
- `parseCsv` + `runAudit` reales ejecutados en navegador.
- Diagnóstico inyectado vía `__PHASE4_INJECT__` (sin Chrome AI, Ollama ni cloud).
- `DiagnosticReportStep` renderiza score, governance, finding groups.
- Botón "Ir a exportación principal" navega a export.
- `[data-testid="export-stage"]` visible.
- Botones "Informe diagnóstico PDF", "JSON técnico", "Hallazgos CSV" visibles.
- Botones "Script aprobado" y "Notebook Colab" deshabilitados sin `approvedCleaningScript`.

## Flujo rama opcional validado (L13G-03)

```
diagnostic_report → script → notice visible → volver → diagnostic_report → export
```

- `OptionalRemediationNotice` visible en estado `script`.
- Texto confirma: "opcional", "sin necesidad de generar un script", "recomendación", "HITL".
- `RemediationBranchActions` muestra "Volver al perfil definitivo" e "Ir a exportación principal".
- "Volver al perfil definitivo" retorna a `diagnostic_report`.
- "Ir a exportación principal" desde `diagnostic_report` llega a export sin exigir HITL.

## Descargas (L13G-02)

| Descarga | Resultado |
|---|---|
| PDF | SuggestFilename termina en `.pdf`, archivo > 100 bytes |
| JSON | SuggestFilename termina en `.json` |
| CSV | SuggestFilename termina en `.csv` |

## Fallback determinista (L13G-04)

- Sin inyectar diagnóstico: `DiagnosticReportStep` se renderiza con status `deterministic_only`.
- Botones de export y script visibles.
- Navegación a export funciona sin AI diagnosis.

## Cómo se evitó usar proveedores reales

- Diagnóstico inyectado con `__PHASE4_INJECT__` + fixture mock (`TITANIC_DIAGNOSIS_MOCK`).
- `metrics.provider: 'e2e-mock'`, `metrics.model: 'mock-diagnosis'`.
- Sin `remediationContext` — script state usa `ScriptGenerationStep` legacy (no requiere v2 contracts).
- `VITE_PHASE3_E2E_HARNESS=true` + `VITE_PHASE4_E2E_HARNESS=true` configurados en `playwright.config.ts`.

## Resultados de tests

| Suite | Tests | Resultado |
|---|---|---|
| `diagnosticReportBuilder.test.ts` | 12 | ✅ |
| `diagnosticReportStep.test.tsx` | 12 | ✅ |
| `pipelineDiagnosticReportState.test.tsx` | 3 | ✅ |
| `diagnosticPdfGenerator.test.ts` | 12 | ✅ |
| `optionalRemediationBranch.test.tsx` | 10 | ✅ |
| `titanic-l13g-e2e.spec.ts` (Playwright) | 4 | ✅ |
| **Total** | **53** | **53/53** |

## Validaciones

```bash
cd src && npm run typecheck   # ✅ limpio
cd src && npm run build       # ✅ exitoso
cd src && npx vitest run ...  # ✅ 49/49
cd src && npx playwright test tests/e2e/titanic-l13g-e2e.spec.ts  # ✅ 4/4 (6.7s)
```

## Limitaciones

- Playwright E2E corre en Vite dev server con harnesses (`VITE_PHASE3_E2E_HARNESS`, `VITE_PHASE4_E2E_HARNESS`). No se valida en modo producción.
- `__PHASE4_SET_STATE__` navega por estado sin clics de stepper; los clics de stepper existen y funcionan pero no están cubiertos en este spec.
- La generación de script y simulación HITL no están cubiertas por este spec (requieren `remediationContext` y v2 contracts). Cubierto por `aura-full-flow-export.spec.ts` y specs de fase 4.
- No se validó descarga Colab (requiere `approvedCleaningScript`).

## Riesgos abiertos

- Ninguno nuevo. El pipeline principal y la rama opcional están validados E2E.
- El stepper visual `stepper-step--optional` requiere CSS si se desea estilizar (sin cambios en este loop).

## Recomendación

**L13H Freeze Diagnostic Report Pipeline** — congelar el pipeline diagnóstico con documentación de freeze, dejando el producto en estado estable para depósito académico futuro.

## Greps de claims

Todos los matches están en restricciones, agent prompts antiguos o guardrails. Sin coincidencias nuevas problemáticas.
