# Phase 10 L10 — Agent Prompt

## Nombre

Phase 10 L10 — E2E Playwright del flujo completo CSV → exportación 2.0 con provider mock

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, Vitest, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Objetivo

Cerrar el riesgo aceptado en L9: L9 validó el contrato de exportación en navegador real usando harness controlado, pero no recorrió la carga CSV desde UI.

L10 debe crear una prueba E2E reproducible que recorra el flujo visible desde carga de CSV sintético hasta exportación técnica 2.0, usando provider mock/controlado y sin depender de Gemini Nano, modelos reales ni proveedores externos.

## Leer antes

- `src/playwright.config.ts`
- `src/tests/e2e/aura-export-contract.spec.ts`
- `docs/product/aura/phase_10/L9_PLAYWRIGHT_EVIDENCE_CLOSEOUT.md`
- `src/App.tsx`
- `src/components/MainPipeline.tsx`
- `src/services/exportPackage.ts`
- `src/services/exportContractValidation.ts`
- `docs/product/aura/contracts/aura-technical-export.schema.json`

## Alcance esperado

Crear:

- `src/tests/e2e/aura-full-flow-export.spec.ts`
- `src/tests/e2e/fixtures/aura_l10_full_flow_issues.csv`
- `docs/product/aura/phase_10/l10_evidence/evidence.json`
- `docs/product/aura/phase_10/l10_evidence/screenshots/`
- `docs/product/aura/phase_10/L10_FULL_FLOW_E2E_CLOSEOUT.md`

La prueba debe:

1. abrir AURA en Chromium;
2. cargar un CSV sintético desde la UI con `setInputFiles` o mecanismo Playwright equivalente;
3. avanzar por el flujo visible hasta donde sea razonable;
4. usar provider mock/harness para el diagnóstico si se requiere evitar IA real;
5. llegar a exportación técnica;
6. obtener o descargar el JSON técnico;
7. validar `exportContract.name === 'aura-technical-export'`;
8. validar `exportContract.version === '2.0'`;
9. validar bloque raíz `calibrationEvidence`;
10. validar ausencia de bloque raíz `experiment`;
11. validar que el profile/report exportado refleja el CSV cargado o el reporte derivado del CSV;
12. capturar screenshots clave;
13. generar evidencia estable en `docs/product/aura/phase_10/l10_evidence/evidence.json`.

## Ruta técnica recomendada

Preferencia:

- usar la UI real para cargar CSV;
- usar harness solo para saltar o estabilizar la capa de IA, no para saltar la carga CSV;
- no depender de Chrome AI/Gemini Nano real;
- no descargar modelos;
- no usar datos reales.

Si el flujo completo todavía no es estable por diseño, documentar claramente el punto exacto donde entra el harness y por qué.

## Evidencia mínima requerida

`evidence.json` debe incluir:

- fase: `L10`;
- navegador: `chromium`;
- fixture CSV leído;
- `fixtureRows`;
- `fixtureColumns`;
- `csvLoadedViaUi: true` si aplica;
- `providerMode: mock` o equivalente;
- validaciones del contrato 2.0;
- ausencia de `experiment` raíz;
- ruta de screenshots;
- `allPassed: true`.

Screenshots sugeridos:

- `01_home.png`
- `02_csv_loaded.png`
- `03_pipeline_or_diagnosis_ready.png`
- `04_export_ready.png`
- `05_contract_validated.png`

## Restricciones duras

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

No declarar:

- sistema listo para producción general;
- benchmark definitivo;
- mejor modelo universal;
- inicio de cuarta entrega.

No usar datos reales.
No descargar modelos.
No depender de proveedor AI real.

## Pruebas obligatorias

```text
cd src && npm run typecheck
cd src && npm run build
cd src && npm test -- --run exportPackage
cd src && npm test -- --run exportPackageSchema
cd src && npm test -- --run exportContractValidation
cd src && npm test -- --run exportJsonPreflight
cd src && npm run test:e2e -- aura-export-contract.spec.ts
cd src && npm run test:e2e -- aura-full-flow-export.spec.ts
```

## Greps obligatorios

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
git commit -m "test: add full-flow CSV export E2E evidence"
git push origin main
```

## Reporte final

Reportar SHA, push, estado limpio/sincronizado, archivos modificados/creados, fixture usado, punto exacto de harness/mock, ruta Playwright, ruta de evidencia, screenshots, resumen de evidence.json, pruebas, greps, restricciones, riesgos y recomendación.
