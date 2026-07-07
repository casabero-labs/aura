# Phase 10 L10A — Agent Prompt

## Nombre

Phase 10 L10A — Reparar L10 para carga CSV real desde UI y evidencia honesta

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, Vitest, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Motivo

La revisión del orquestador NO aprueba el cierre de L10.

El commit `6306b8263c4f4f5387fe8c77c54318dfb9e13837` agregó evidencia L10, pero no cumple el objetivo principal de L10: cargar CSV desde UI.

Problemas detectados:

1. `docs/product/aura/phase_10/l10_evidence/evidence.json` dice `csvLoadedViaUi: false`.
2. `manifest.dataset.rows` y `manifest.dataset.columns` quedan en `0`, lo que indica que `buildEvidenceManifest` no recibió `auditEvidence` real o sincronizado.
3. `aura-full-flow-export.spec.ts` solo confirma que el input de archivo existe en DOM, luego inyecta `FAKE_AUDIT_EVIDENCE` y `FAKE_REPORT` por harness.
4. El closeout afirma que `setInputFiles`, `parseCsv()` y `runAudit()` fueron flujo real, pero el spec y el `evidence.json` contradicen esa afirmación.
5. El reporte final menciona que `setInputFiles` causó unmount en Chromium/React; eso debe diagnosticarse y repararse como bug de producto/test, no esconderse con harness.

## Objetivo

Convertir L10 en una prueba E2E real del flujo CSV desde UI hasta exportación 2.0.

El resultado mínimo aceptable es:

```json
{
  "csvLoadedViaUi": true,
  "manifest": {
    "dataset": {
      "rows": 6,
      "columns": 5
    }
  }
}
```

El uso de harness queda permitido solo para evitar proveedor IA real, script generation o navegación posterior al diagnóstico, pero NO para simular la carga del CSV ni el perfilamiento base.

## Alcance obligatorio

### 1. Diagnosticar y reparar `setInputFiles`

Investigar por qué `page.setInputFiles()` sobre el input CSV provoca component unmount en Playwright/Chromium.

El arreglo puede incluir, si hace falta:

- añadir `data-testid` estable al input CSV o dropzone;
- evitar que el input se desmonte antes de procesar el archivo;
- hacer más estable el handler de carga;
- corregir selectores o timing del test;
- esperar estados reales de UI después del upload;
- capturar errores de consola y fallar si hay error crítico.

No aceptar como solución final: “setInputFiles no funciona, usamos harness”.

### 2. Test L10 real

Actualizar `src/tests/e2e/aura-full-flow-export.spec.ts` para que:

1. abra AURA en Chromium;
2. vaya al flujo de auditoría;
3. cargue `src/tests/e2e/fixtures/aura_l10_full_flow_issues.csv` usando `page.setInputFiles()` o mecanismo Playwright equivalente sobre la UI real;
4. espere una señal real de perfilamiento o reporte visible;
5. verifique que el estado/report real corresponde a 6 filas y 5 columnas;
6. use harness únicamente desde el punto en que empieza diagnóstico/IA si se requiere;
7. genere export JSON 2.0;
8. valide contrato, versión, `calibrationEvidence`, ausencia de `experiment`, migración y `legacyAliasIncluded: false`;
9. valide que `manifest.dataset.rows === 6` y `manifest.dataset.columns === 5`;
10. valide que `profile.report.rowCount === 6` y `profile.report.colCount === 5`;
11. escriba evidencia estable en `docs/product/aura/phase_10/l10_evidence/evidence.json`;
12. capture screenshots reales.

### 3. Evidencia requerida

`docs/product/aura/phase_10/l10_evidence/evidence.json` debe incluir:

```json
{
  "testRun": {
    "phase": "L10",
    "csvLoadedViaUi": true,
    "providerMode": "mock"
  },
  "fixtureProvenance": {
    "fixtureName": "aura_l10_full_flow_issues.csv",
    "fixtureRows": 6,
    "fixtureColumns": 5,
    "fixtureRead": true
  },
  "validations": {
    "csv_loaded_via_ui": { "passed": true },
    "manifest_dataset_rows_correct": { "passed": true, "expected": 6, "actual": 6 },
    "manifest_dataset_columns_correct": { "passed": true, "expected": 5, "actual": 5 },
    "profile_rowCount_correct": { "passed": true, "expected": 6, "actual": 6 },
    "profile_colCount_correct": { "passed": true, "expected": 5, "actual": 5 }
  },
  "allPassed": true
}
```

### 4. Closeout honesto

Actualizar `docs/product/aura/phase_10/L10_FULL_FLOW_E2E_CLOSEOUT.md` para que refleje exactamente lo que ocurrió.

Debe eliminar cualquier afirmación falsa o ambigua como:

- “CSV selection via setInputFiles real” si no se logró;
- “parseCsv/runAudit real” si no fueron ejecutados desde el upload real;
- “full-flow” si el upload todavía se simula.

Si el upload real queda reparado, declarar con precisión cómo se logró.

### 5. Harness y refs

Si el problema de `manifest.dataset.rows = 0` se debe a estado React asincrónico, se permite agregar un `lastAuditEvidenceRef` análogo a `lastReportRef`, siempre restringido al harness de desarrollo:

```text
DEV && VITE_PHASE4_E2E_HARNESS === 'true'
```

También se permite que `__L9_GET_EXPORT_JSON__` reciba `overriddenReport` y `overriddenAuditEvidence`, pero el test L10 debe preferir datos producidos por el upload real.

## No hacer

- No tocar `auditEngine` salvo que se encuentre un bug real y se justifique explícitamente.
- No cambiar scoring determinista sin justificación.
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
cd src && npm run test:e2e -- aura-full-flow-export.spec.ts
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
git commit -m "test: repair L10 real CSV upload E2E evidence"
git push origin main
```

## Reporte final

Reportar:

- SHA completo;
- push;
- estado limpio/sincronizado;
- causa raíz del fallo `setInputFiles`;
- cambios realizados;
- confirmación `csvLoadedViaUi: true`;
- confirmación `manifest.dataset.rows === 6`;
- confirmación `manifest.dataset.columns === 5`;
- punto exacto donde entra harness/mock;
- screenshots;
- pruebas;
- greps;
- riesgos abiertos;
- recomendación.
