# Phase 10 L11 — Embedded Calibration E2E Closeout

## 1. Objetivo

Validar que la calibración experimental aparece como opción informada dentro del pipeline principal de AURA, con camino normal no bloqueante y camino secundario embebido. Probar que el export JSON 2.0 refleja correctamente ambos caminos sin claims prohibidos.

## 2. Commit auditado

```
52b9130ad87a2ab2c903aad3c7e39e3deb374ce4
```

## 3. Archivos creados/modificados

### Creados

| Archivo | Propósito |
|---------|-----------|
| `src/tests/e2e/aura-embedded-calibration.spec.ts` | Spec E2E de calibración embebida (2 tests) |
| `src/tests/e2e/fixtures/aura_l11_calibration_flow.csv` | Fixture CSV de 6 filas, 5 columnas |
| `docs/product/aura/phase_10/l11_evidence/evidence.json` | Evidencia estructurada del test run |
| `docs/product/aura/phase_10/l11_evidence/screenshots/*.png` | 6 screenshots del test run |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/MainPipeline.tsx` | Harness window globals (`__L9_GET_EXPORT_JSON__`, `__L9_SET_BENCHMARK_RESULTS__`) con refs para evitar closures stale |
| `src/vite-env.d.ts` | Tipados para window globals del harness |

## 4. Escenario L11-01 — Camino normal

```
CSV real desde UI
→ perfilamiento real
→ opt-in de calibración visible
→ Continuar diagnóstico normal
→ export JSON 2.0
→ calibrationEvidence.status = none
→ experiment raíz ausente
```

Validaciones:
- `uploadCsvAndWaitForProfile` → profileReached = true
- Calibration opt-in explainer visible
- Main flow reminder visible
- Botón "Continuar diagnóstico normal" funcional
- Export contract name = `aura-technical-export`
- Export contract version = `2.0`
- `calibrationEvidence` presente en raíz
- `experiment` ausente en raíz
- `calibrationEvidence.summary.status = "none"`
- `manifest.dataset.rows` = 6, `manifest.dataset.columns` = 5
- `profile.report.rowCount` = 6, `profile.report.colCount` = 5
- `calibrationEvidence` en canonicalBlocks
- Deprecated blocks: experiment → calibrationEvidence
- `legacyAliasIncluded` = false

## 5. Escenario L11-02 — Camino embebido

```
CSV real desde UI
→ perfilamiento real
→ opt-in de calibración visible
→ Activar comparación experimental
→ CalibrationEmbeddedPanel visible
→ benchmark result controlado vía harness
→ Continuar diagnóstico normal
→ export JSON 2.0
→ calibrationEvidence.status = preliminary
→ experiment raíz ausente
```

Validaciones:
- `uploadCsvAndWaitForProfile` → profileReached = true
- Botón "Activar comparación experimental" funcional
- `calibration-embedded-panel` visible
- BenchmarkLab `benchmark-lab-anchor` NO renderizado (calibración embebida, no navegación separada)
- Mock benchmark result inyectado y reflejado en export
- `calibrationEvidence.results[0].id = "l11-mock-benchmark"`
- `calibrationEvidence.results[0].evidenceStatus = "preliminary_valid"`
- `calibrationEvidence.summary.status = "preliminary"`
- `calibrationEvidence.summary.totalRuns = 1`
- `manifest.allowedClaims.calibrationEvidence = "preliminary"`

## 6. Qué fue real

- `setInputFiles` sobre `[data-testid="csv-file-input"]`
- File selection: browser's native change event
- Upload handler: `processFile()` — real `parseCsv` + `runAudit`
- React state: `auditEvidence`, `report` desde CSV processing real
- Calibration opt-in UI rendering (`CalibrationOptInExplainer`)
- Embedded calibration panel UI rendering (`CalibrationEmbeddedPanel`)

## 7. Qué fue harness/mock

- `__L9_SET_BENCHMARK_RESULTS__` — inyecta benchmark result mock (evita dependencia de AI provider real)
- `__L9_GET_EXPORT_JSON__` — construye export JSON desde React state vía refs

## 8. Evidencia generada

```
docs/product/aura/phase_10/l11_evidence/evidence.json
docs/product/aura/phase_10/l11_evidence/screenshots/
```

## 9. Screenshots

| Archivo | Captura |
|---------|---------|
| `01_upload_step_ready.png` | Pantalla de upload con botón "Empezar auditoría" |
| `02_profile_reached.png` | Perfilamiento completado, score visible |
| `03_calibration_opt_in_visible.png` | Opt-in explainer de calibración visible |
| `04_continue_normal_path.png` | Camino normal después de continuar sin calibración |
| `05_embedded_calibration_panel.png` | Panel embebido de calibración activo |
| `06_export_contract_validated.png` | Export JSON validado |

## 10. Validaciones export 2.0

| Validación | L11-01 | L11-02 |
|------------|--------|--------|
| exportContract.name = aura-technical-export | ✅ | ✅ |
| exportContract.version = 2.0 | ✅ | ✅ |
| calibrationEvidence en raíz | ✅ | ✅ |
| experiment ausente en raíz | ✅ | ✅ |
| deprecatedBlocks: experiment → calibrationEvidence | ✅ | ✅ |
| legacyAliasIncluded = false | ✅ | ✅ |
| manifest.dataset.rows correcto | ✅ | ✅ |
| manifest.dataset.columns correcto | ✅ | ✅ |
| profile.report.rowCount correcto | ✅ | ✅ |
| profile.report.colCount correcto | ✅ | ✅ |

## 11. Claims permitidos

| Claim | L11-01 | L11-02 |
|-------|--------|--------|
| deterministicEngine | preliminary | preliminary |
| calibrationEvidence | none | preliminary |
| scriptSafety | none | none |
| hitlDecision | none | none |
| healthDelta | none | none |

## 12. Claims prohibidos

No aparecen como afirmaciones positivas en código fuente, tests, evidencia o documentación:

- `benchmark definitivo`
- `mejor modelo`
- `modelo ganador`
- `ganador universal`
- `production-ready`
- `cuarta entrega iniciada`

Los únicos contextos donde aparecen son:

- Listas de prohibiciones en agent prompts
- Verificaciones de ausencia en tests
- Código de detección de claims prohibidos
- Documentación de límites metodológicos

## 13. Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| Typecheck (`tsc --noEmit`) | ✅ |
| Build (`vite build`) | ✅ |
| `exportPackage` (vitest, 5 tests) | ✅ |
| `exportPackageSchema` (vitest, 3 tests) | ✅ |
| `exportContractValidation` (vitest, 6 tests) | ✅ |
| `exportJsonPreflight` (vitest, 1 test) | ✅ |
| `aura-export-contract.spec.ts` (Playwright, 5 tests) | ✅ |
| `aura-full-flow-export.spec.ts` (Playwright, 1 test) | ✅ |
| `aura-embedded-calibration.spec.ts` (Playwright, 2 tests) | ✅ |

## 14. Greps ejecutados

| Búsqueda | Resultado |
|----------|-----------|
| `benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready` | Solo en prohibiciones, tests de ausencia, detección de claims prohibidos |
| `experiment` en App.tsx, services, tests, e2e, contracts | Solo en deprecaciones, migraciones, tests de ausencia |
| `calibrationEvidence` en App.tsx, services, tests, e2e, contracts | Uso correcto en servicios y validaciones |
| `cuarta entrega` en src, phase_10, contracts | Solo en agent prompts y closeouts previos |

## 15. Riesgos abiertos

1. **Mock de benchmark post-profile**: El harness inyecta resultados mock que evitan el proveedor AI real. Esto es intencional para L11 (foco en pipeline UI + estructura export), pero significa que la ruta AI real no está cubierta por E2E en este phase.
2. **StrictMode + fire-and-forget state setters**: El harness usa refs para evitar closures stale. Si React cambia su modelo de batching en futuras versiones, los refs deberían mantenerse como mecanismo robusto.
3. **Screenshots locales**: Las capturas se generan en cada run y pueden variar ligeramente según resolución, hora del día y datos del fixture. No deben usarse como diff visual sin resetear el fixture.

## 16. Recomendación de cierre

Cerrar la issue **#17 — Phase 10 L11**. La calibración experimental embebida está implementada, testeada y documentada:

- Camino normal no bloqueante verificado
- Camino embebido con panel in-situ verificado
- Export 2.0 con `calibrationEvidence` funcional
- Claims prohibidos ausentes
- Migración `experiment → calibrationEvidence` documentada
- Screenshots y evidencia generados
- Unitaria: 15 tests vitest ✅
- Integración E2E: 8 tests Playwright ✅

**No requiere cuarta entrega.**
