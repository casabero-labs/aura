# Phase 10 L9 — Playwright E2E Export Contract Evidence Closeout

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y publicación

- Rama usada: `main`.
- Sin ramas adicionales.
- Commit autorizado después de validaciones exitosas.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El flujo de exportación JSON técnica `2.0` cuenta con una prueba E2E en navegador real (Chromium) que valida el contrato de exportación `aura-technical-export` v2.0 mediante Playwright, sin datos reales, sin descarga de modelos y sin dependencia de proveedor AI.

## Archivos modificados

(Ninguno - solo creación de archivos nuevos)

## Archivos creados

1. `src/tests/e2e/aura-export-contract.spec.ts` — Suite Playwright E2E con 5 tests
2. `src/tests/e2e/fixtures/aura_l9_dataset_control.csv` — Dataset sintético limpio (5 filas × 4 columnas)
3. `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv` — Dataset sintético con problemas (6 filas × 4 columnas)
4. `src/tests/e2e/harness/L9EvidenceHarness.ts` — Harness de evidencia determinista para L9
5. `docs/product/aura/phase_10/L9_E2E_EVIDENCE_TEMPLATE.json` — Template JSON Schema para evidence.json
6. `docs/product/aura/phase_10/L9_PLAYWRIGHT_EVIDENCE_CLOSEOUT.md` — Este documento

## Resumen funcional

- La prueba usa Playwright con Chromium (configurado en `playwright.config.ts`).
- El servidor web de prueba usa `VITE_PHASE3_E2E_HARNESS=true VITE_PHASE4_E2E_HARNESS=true` para habilitar el harness de inyección.
- Se utiliza el harness existente (`__PHASE4_INJECT__`, `__PHASE4_SET_STATE__`) para llegar al estado `export` sin pasar por el flujo completo de upload → diagnóstico → script → revisión.
- El test L9-05 genera `test-results/aura-l9-evidence/evidence.json` con el resultado de todas las validaciones.
- Los datasets son sintéticos, reproducibles y no contienen datos reales.

### Tests en la suite

| Test ID | Descripción |
|---------|-------------|
| L9-01 | Valida `exportContract.name === 'aura-technical-export'` |
| L9-02 | Valida `exportContract.version === '2.0'` |
| L9-03 | Valida que existe bloque raíz `calibrationEvidence` |
| L9-04 | Valida que NO existe bloque raíz `experiment` |
| L9-05 | Genera `evidence.json` con todas las validaciones + screenshot final |

### Artefactos generados

| Ruta | Descripción |
|------|-------------|
| `src/test-results/aura-l9-evidence/evidence.json` | JSON con resultado de todas las validaciones |
| `src/test-results/aura-l9-evidence/export_contract_v2.json` | Paquete exportado (L9-01) |
| `src/test-results/aura-l9-evidence/export_contract_v2_version.json` | Paquete exportado (L9-02) |
| `src/test-results/aura-l9-evidence/export_contract_v2_calibration.json` | Paquete exportado (L9-03) |
| `src/test-results/aura-l9-evidence/export_contract_v2_no_experiment.json` | Paquete exportado (L9-04) |
| `src/test-results/aura-l9-evidence/export_contract_v2_full.json` | Paquete exportado (L9-05) |
| `src/test-results/aura-l9-evidence/screenshots/01_l9_export_stage_visible.png` | Captura del stage de exportación visible |
| `src/test-results/aura-l9-evidence/screenshots/02_l9_download_completed.png` | Captura después de descarga |
| `src/test-results/aura-l9-evidence/screenshots/03_l9_version_validated.png` | Validación de versión |
| `src/test-results/aura-l9-evidence/screenshots/04_l9_calibration_evidence_validated.png` | Validación de calibrationEvidence |
| `src/test-results/aura-l9-evidence/screenshots/05_l9_no_experiment_validated.png` | Validación de ausencia de experiment |
| `src/test-results/aura-l9-evidence/screenshots/06_l9_evidence_complete.png` | Captura final con evidence.json generado |

## Pruebas ejecutadas

### Typecheck

```text
cd src && npm run typecheck
```

### Build

```text
cd src && npm run build
```

### Vitest — exportPackage

```text
cd src && npm test -- --run exportPackage
```

### Vitest — exportPackageSchema

```text
cd src && npm test -- --run exportPackageSchema
```

### Vitest — exportContractValidation

```text
cd src && npm test -- --run exportContractValidation
```

### Vitest — exportJsonPreflight

```text
cd src && npm test -- --run exportJsonPreflight
```

### Playwright E2E

```text
cd src && npm run test:e2e -- aura-export-contract.spec.ts
```

## Greps obligatorios

### Claims prohibidos

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

### `experiment` en contratos y UI

```text
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
```

### `calibrationEvidence`

```text
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
```

### Cuarta entrega

```text
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

## Restricciones verificadas

| Restricción | Estado |
|---|---|
| Sin dependencias nuevas | Cumplida |
| Schema L6 no modificado | Cumplida |
| `exportPackage` no modificado | Cumplida |
| `exportContractValidation` no modificado | Cumplida |
| `evidenceManifest` no modificado | Cumplida |
| `auditEngine` no modificado | Cumplida |
| Scoring determinista no modificado | Cumplida |
| Contratos v2 no modificados | Cumplida |
| Freezes Phase 5-9 respetados | Cumplida |
| `docs/tercera_entrega_aura/` no modificado | Cumplida |
| Sin datos reales | Cumplida |
| Sin descarga de modelos en tests | Cumplida |
| Sin preparación de entrega académica | Cumplida |
| Commit solo después de validaciones exitosas | Cumplida |
| Push solo después de validaciones exitosas | Cumplida |

## Riesgos abiertos

1. La prueba usa el harness de inyección existente (Phase4) para llegar al estado `export`; no valida el camino completo desde la carga de CSV.
2. El test L9-05 genera `evidence.json` en `src/test-results/`, que es un directorio efímero de build; se debe copiar o documentar la ruta si se necesita persistencia.
3. Los screenshots son capturados en el directorio `test-results/` que puede ser limpiado por el sistema de CI; considerar artifact upload si se integra en un pipeline de CI.

## Recomendación

Listo para revisión del orquestador después del commit y push. La suite E2E valida los 5 puntos requeridos del contrato de exportación técnica `2.0` en navegador real con datos sintéticos, sin modelos reales ni proveedores AI.
