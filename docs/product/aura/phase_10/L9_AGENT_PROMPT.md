# Phase 10 L9 — Agent Prompt

## Nombre

Phase 10 L9 — E2E Playwright con evidencia reproducible de exportación 2.0

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, tests, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Objetivo

Crear una prueba E2E con Playwright que valide en navegador real la exportación técnica `aura-technical-export` versión `2.0` y deje evidencia reproducible: dataset sintético, capturas, JSON de evidencia y closeout.

El usuario no quiere llenar plantillas manuales. El agente debe ejecutar y dejar evidencia revisable.

## Leer antes

- `src/playwright.config.ts`
- `docs/product/aura/phase_10/L8_EXPORT_PREFLIGHT_INTEGRATION_CLOSEOUT.md`
- `src/App.tsx`
- `src/services/exportPackage.ts`
- `src/services/exportContractValidation.ts`
- `docs/product/aura/contracts/aura-technical-export.schema.json`

## Alcance

Crear:

- `src/tests/e2e/aura-export-contract.spec.ts`
- `src/tests/e2e/fixtures/aura_l9_dataset_control.csv`
- `src/tests/e2e/fixtures/aura_l9_dataset_issues.csv`
- `docs/product/aura/phase_10/L9_E2E_EVIDENCE_TEMPLATE.json`
- `docs/product/aura/phase_10/L9_PLAYWRIGHT_EVIDENCE_CLOSEOUT.md`

La prueba debe:

1. abrir AURA en Chromium;
2. usar dataset sintético;
3. llegar al flujo de exportación o usar un harness E2E controlado por variable de entorno si el flujo completo es muy costoso;
4. descargar o inspeccionar el JSON técnico;
5. validar `exportContract.name === 'aura-technical-export'`;
6. validar `exportContract.version === '2.0'`;
7. validar bloque raíz `calibrationEvidence`;
8. validar que no existe bloque raíz `experiment`;
9. capturar screenshots clave;
10. generar evidencia local tipo `test-results/aura-l9-evidence/evidence.json` o documentar la ruta exacta.

No agregar dependencias nuevas si no es indispensable.

## Restricciones

No tocar:

- `auditEngine`
- scoring determinista
- contratos v2
- freezes Phase 5-9
- `docs/tercera_entrega_aura/`
- schema L6 salvo necesidad estricta
- `evidenceManifest` salvo necesidad estricta
- `exportPackage` salvo necesidad estricta
- `exportContractValidation` salvo necesidad estricta

No usar datos reales. No descargar modelos. No depender de proveedor AI real. No declarar production-ready, benchmark definitivo, mejor modelo universal ni inicio de cuarta entrega.

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

## Greps

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

Criterio: `experiment` solo como deprecado, migración, test de ausencia o histórico experimental. Claims prohibidos solo en restricciones, tests o validadores.

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
git commit -m "test: add Playwright export contract evidence"
git push origin main
```

## Reporte final

Reportar SHA, push, estado limpio/sincronizado, archivos, dataset, ruta Playwright, ruta de artefactos, screenshots, resumen de evidence.json, pruebas, greps, restricciones, riesgos y recomendación.
