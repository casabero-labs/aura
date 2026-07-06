# Phase 10 L9A — Agent Prompt

## Nombre

Phase 10 L9A — Consolidar evidencia Playwright y corregir trazabilidad L9

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, Vitest, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Objetivo

Corregir la trazabilidad documental y la persistencia de evidencia de L9 sin cambiar el comportamiento funcional de AURA.

L9 creó el E2E Playwright y luego se añadió `test-results/aura-l9-evidence/` con screenshots/evidence. La revisión del orquestador detectó inconsistencias:

1. El closeout dice que no hubo archivos modificados, pero sí se modificaron `src/components/MainPipeline.tsx` y `src/vite-env.d.ts`.
2. El closeout documenta rutas `src/test-results/...`, pero los artefactos versionados quedaron en `test-results/...`.
3. El closeout lista nombres de screenshots/export JSON que no coinciden completamente con los archivos comiteados.
4. Los CSV sintéticos existen, pero el spec usa datos inyectados por harness y no queda clara la relación entre fixture y evidencia.
5. `test-results/` no debe ser tratado como carpeta estable de documentación permanente.

## Alcance

Hacer un microfix de orden y trazabilidad:

1. Mover o copiar la evidencia versionada L9 a una ruta documental estable, preferida:

```text
docs/product/aura/phase_10/l9_evidence/
```

Debe contener como mínimo:

```text
docs/product/aura/phase_10/l9_evidence/evidence.json
docs/product/aura/phase_10/l9_evidence/screenshots/01_l9_export_name_validated.png
docs/product/aura/phase_10/l9_evidence/screenshots/02_l9_version_validated.png
docs/product/aura/phase_10/l9_evidence/screenshots/03_l9_calibration_evidence_validated.png
docs/product/aura/phase_10/l9_evidence/screenshots/04_l9_no_experiment_validated.png
docs/product/aura/phase_10/l9_evidence/screenshots/05_l9_evidence_complete.png
```

2. Eliminar del versionado la carpeta raíz `test-results/aura-l9-evidence/` si queda duplicada.
3. Añadir `/test-results/` a `.gitignore` para que futuras corridas no dejen artefactos efímeros sin control.
4. Actualizar `L9_PLAYWRIGHT_EVIDENCE_CLOSEOUT.md` para reflejar exactamente:
   - archivos modificados reales;
   - archivos creados reales;
   - ruta de evidencia versionada estable;
   - ruta efímera generada por Playwright;
   - nombres reales de screenshots;
   - si los CSV se usan como fixtures directos o si la prueba usa harness-injected synthetic report.
5. Ajustar el E2E para que lea al menos `src/tests/e2e/fixtures/aura_l9_dataset_control.csv` y registre en `evidence.json` el nombre del fixture usado. Si no se carga el CSV en la UI, documentar claramente: `dataset: aura_l9_dataset_control.csv (harness-derived)`.
6. Actualizar `NEXT_STEPS.md` para registrar L9 solo cuando la trazabilidad quede corregida.

## No hacer

- No cambiar `auditEngine`.
- No cambiar scoring determinista.
- No cambiar contratos v2.
- No tocar freezes Phase 5-9.
- No tocar `docs/tercera_entrega_aura/`.
- No usar datos reales.
- No descargar modelos.
- No depender de proveedor AI real.
- No declarar production-ready, benchmark definitivo, mejor modelo universal ni inicio de cuarta entrega.

## Pruebas obligatorias

```text
cd src && npm run typecheck
cd src && npm run build
cd src && npm test -- --run exportPackage
cd src && npm test -- --run exportPackageSchema
cd src && npm test -- --run exportContractValidation
cd src && npm test -- --run exportJsonPreflight
cd src && npm run test:e2e -- aura-export-contract.spec.ts
```

## Greps obligatorios

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

## Git antes de commit

Reportar:

```text
git branch --show-current
git status --porcelain
git diff --name-status
```

## Commit y push

Si todo pasa:

```text
git add <archivos del loop>
git commit -m "test: consolidate L9 Playwright evidence artifacts"
git push origin main
```

## Reporte final

Reportar SHA, push, estado limpio/sincronizado, archivos modificados/creados/eliminados, ruta de evidencia versionada, ruta efímera ignorada, dataset fixture usado, resultado exacto de pruebas, greps, riesgos abiertos y recomendación.
