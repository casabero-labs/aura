# Phase 10 L9 — Playwright E2E Export Contract Evidence Closeout

## Naturaleza documental

Este Documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Rama y publicación

- Rama usada: `main`.
- Sin ramas adicionales.
- Commit autorizado después de validaciones exitosas.
- Push autorizado a `origin/main`.
- Sin pull request.

## Objetivo cerrado

El flujo de exportación JSON técnica `2.0` cuenta con una prueba E2E en navegador real (Chromium) que valida el contrato de exportación `aura-technical-export` v2.0 mediante Playwright, sin datos reales, sin descarga de modelos y sin dependencia de proveedor AI.

## Archivos modificados

1. `.gitignore` — Añadido `/test-results/` para ignorar artefactos efímeros de Playwright
2. `src/tests/e2e/aura-export-contract.spec.ts` — Actualizado para usar ruta de evidencia estable y dataset fixture
3. `src/components/MainPipeline.tsx` — Añadidas funciones de harness `__L9_SET_REPORT__` y `__L9_GET_EXPORT_JSON__`
4. `src/vite-env.d.ts` — Añadidas declaraciones de tipo para harness L9

## Archivos eliminados del versionado

- `test-results/aura-l9-evidence/` — Movido a `docs/product/aura/phase_10/l9_evidence/` y eliminado del tracking

## Archivos creados

1. `src/tests/e2e/aura-export-contract.spec.ts` — Suite Playwright E2E con 5 tests
2. `src/tests/e2e/fixtures/aura_l9_dataset_control.csv` — Dataset sintético limpio (5 filas × 4 columnas)
3. `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv` — Dataset sintético con problemas (6 filas × 4 columnas)
4. `src/tests/e2e/harness/L9EvidenceHarness.ts` — Harness de evidencia determinista para L9
5. `docs/product/aura/phase_10/l9_evidence/evidence.json` — Evidencia persistida con resultado de validaciones
6. `docs/product/aura/phase_10/l9_evidence/screenshots/01_l9_export_name_validated.png` — Validación de nombre
7. `docs/product/aura/phase_10/l9_evidence/screenshots/02_l9_version_validated.png` — Validación de versión
8. `docs/product/aura/phase_10/l9_evidence/screenshots/03_l9_calibration_evidence_validated.png` — Validación de calibrationEvidence
9. `docs/product/aura/phase_10/l9_evidence/screenshots/04_l9_no_experiment_validated.png` — Validación de ausencia de experiment
10. `docs/product/aura/phase_10/l9_evidence/screenshots/05_l9_evidence_complete.png` — Captura final con evidence.json
11. `docs/product/aura/phase_10/L9_E2E_EVIDENCE_TEMPLATE.json` — Template JSON Schema para evidence.json
12. `docs/product/aura/phase_10/L9_PLAYWRIGHT_EVIDENCE_CLOSEOUT.md` — Este documento

## Resumen funcional

- La prueba usa Playwright con Chromium (configurado en `playwright.config.ts`).
- El servidor web de prueba usa `VITE_PHASE3_E2E_HARNESS=true VITE_PHASE4_E2E_HARNESS=true` para habilitar el harness de inyección.
- Se utiliza el harness existente (`__PHASE4_INJECT__`, `__PHASE4_SET_STATE__`) más las funciones L9 (`__L9_SET_REPORT__`, `__L9_GET_EXPORT_JSON__`) para llegar al estado `export` sin pasar por el flujo completo de upload → diagnóstico → script → revisión.
- El CSV fixture existe en `src/tests/e2e/fixtures/aura_l9_dataset_control.csv` como referencia de dataset sintético. La prueba usa harness-injected report derivado de este fixture.
- La evidencia se escribe directamente a `docs/product/aura/phase_10/l9_evidence/` (ruta estable versionada).
- Los artefactos efímeros de Playwright van a `test-results/` (ignorados por git).

### Tests en la suite

| Test ID | Descripción |
|---------|-------------|
| L9-01 | Valida `exportContract.name === 'aura-technical-export'` |
| L9-02 | Valida `exportContract.version === '2.0'` |
| L9-03 | Valida que existe bloque raíz `calibrationEvidence` |
| L9-04 | Valida que NO existe bloque raíz `experiment` |
| L9-05 | Genera `evidence.json` con todas las validaciones + screenshot final |

### Artefactos generados (ruta estable versionada)

| Ruta | Descripción |
|------|-------------|
| `docs/product/aura/phase_10/l9_evidence/evidence.json` | JSON con resultado de todas las validaciones |
| `docs/product/aura/phase_10/l9_evidence/screenshots/01_l9_export_name_validated.png` | Validación de nombre |
| `docs/product/aura/phase_10/l9_evidence/screenshots/02_l9_version_validated.png` | Validación de versión |
| `docs/product/aura/phase_10/l9_evidence/screenshots/03_l9_calibration_evidence_validated.png` | Validación de calibrationEvidence |
| `docs/product/aura/phase_10/l9_evidence/screenshots/04_l9_no_experiment_validated.png` | Validación de ausencia de experiment |
| `docs/product/aura/phase_10/l9_evidence/screenshots/05_l9_evidence_complete.png` | Captura final |

### Ruta efímera (ignorada por git)

| Ruta | Descripción |
|------|-------------|
| `test-results/aura-l9-evidence/` | Artefactos efímeros de Playwright (ignorados por `.gitignore`) |

### Dataset fixture usado

- **Fixture**: `src/tests/e2e/fixtures/aura_l9_dataset_control.csv`
- **Registrado en evidence.json**: `aura_l9_dataset_control.csv (harness-derived)`
- **Nota**: La prueba no carga el CSV en la UI; usa harness-injected report derivado del fixture para validar el contrato de exportación.

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
2. Los artefactos escritos directamente a `docs/product/aura/phase_10/l9_evidence/` sobreescriben la evidencia persistida en cada corrida; se genera evidencia fresca cada vez.
3. El CSV fixture no se carga en la UI — el report se inyecta via harness. Esto es intencional para evitar el costo del pipeline completo en tests E2E.

## Recomendación

Listo para revisión del orquestador después del commit y push. La suite E2E valida los 5 puntos requeridos del contrato de exportación técnica `2.0` en navegador real con datos sintéticos, sin modelos reales ni proveedores AI. La evidencia está persistida en `docs/product/aura/phase_10/l9_evidence/` y los artefactos efímeros están correctamente ignorados.
