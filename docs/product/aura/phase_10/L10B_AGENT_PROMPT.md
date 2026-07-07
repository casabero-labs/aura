# Phase 10 L10B — Agent Prompt

## Nombre

Phase 10 L10B — Validar carga real por input CSV y corregir semántica de evidencia L10

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, Vitest, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Motivo

La revisión del orquestador no cierra aún la Issue #16.

L10A mejoró de forma importante la evidencia: `__L9_PROCESS_CSV__` ejecuta `parseCsv`, `runAudit`, `buildAuditEvidence`, `buildEvidenceManifest` y `buildAuraExportPackage`, y el manifest ya queda con `rows=6` y `columns=5`.

Pero L10A todavía no valida la carga real por input de archivo. El propio closeout reconoce:

> Harness exercises real parseCsv + runAudit but bypasses the actual file input UI interaction (no `input[type=file]` involved). The CSV data is passed as a string to the harness, not via a real file selection event.

Por tanto, `csvLoadedViaUi: true` no es semánticamente defendible si no se usa `page.setInputFiles()` o una interacción equivalente con el input real.

## Objetivo

Cerrar definitivamente L10 con evidencia honesta del flujo:

```text
usuario/test selecciona CSV en input real
→ handler real procesa File
→ parseCsv real
→ runAudit real
→ estado de perfilamiento real
→ exportación 2.0
→ manifest.dataset.rows = 6
→ manifest.dataset.columns = 5
```

Harness puede usarse después del perfilamiento real para evitar IA real, calibración real o generación de script. No puede reemplazar el upload.

## Alcance obligatorio

### 1. Test real de input file

Actualizar `src/tests/e2e/aura-full-flow-export.spec.ts` para usar:

```ts
await page.locator('<selector estable del input CSV>').setInputFiles(FIXTURE_CSV)
```

o mecanismo Playwright equivalente que dispare el handler real de carga de archivo.

Debe existir una aserción explícita de que se usó input real, por ejemplo:

```json
"csvLoadedViaUi": true,
"fileInputInteraction": "setInputFiles",
"harnessProcessedCsv": false
```

Si se conserva `__L9_PROCESS_CSV__`, no debe ser el flujo principal de L10B. Puede quedar como utilidad de diagnóstico, pero no como validación de full-flow UI.

### 2. Reparar StrictMode/producto si es necesario

Si `setInputFiles()` causa remount o pérdida de estado, arreglar el problema en el producto/test de forma defendible.

Opciones aceptables:

- añadir `data-testid` estable al input CSV;
- estabilizar el handler de carga;
- persistir estado real de upload en un ref o storage controlado si aplica;
- esperar el estado `profile` con una señal real de UI o de state harness;
- corregir cleanup de harness si elimina funciones necesarias demasiado pronto;
- registrar errores de consola y fallar si hay error crítico.

No aceptar como cierre: “StrictMode rompe setInputFiles, usamos `__L9_PROCESS_CSV__`”.

### 3. Exportación desde estado real

Después de `setInputFiles`, validar que el estado real contiene:

- `hasReport === true`;
- `rowCount === 6`;
- `colCount === 5`;
- `rowsProcessed === 6`;
- `columnsProcessed === 5`.

Luego usar harness solo para obtener export JSON si todavía no existe un botón/descarga estable, pero ese export debe partir de estado real derivado del upload.

### 4. Evidencia requerida

Actualizar `docs/product/aura/phase_10/l10_evidence/evidence.json` con:

```json
{
  "testRun": {
    "phase": "L10B",
    "csvLoadedViaUi": true,
    "fileInputInteraction": "setInputFiles",
    "harnessProcessedCsv": false
  },
  "validations": {
    "csv_loaded_via_file_input": { "passed": true },
    "real_profile_state_reached": { "passed": true },
    "manifest_dataset_rows_correct": { "passed": true, "expected": 6, "actual": 6 },
    "manifest_dataset_columns_correct": { "passed": true, "expected": 5, "actual": 5 },
    "profile_rowCount_correct": { "passed": true, "expected": 6, "actual": 6 },
    "profile_colCount_correct": { "passed": true, "expected": 5, "actual": 5 }
  },
  "allPassed": true
}
```

### 5. Closeout honesto

Actualizar `docs/product/aura/phase_10/L10_FULL_FLOW_E2E_CLOSEOUT.md` para diferenciar:

- L10: intento inicial con harness;
- L10A: procesamiento real por harness `__L9_PROCESS_CSV__`, pero sin input real;
- L10B: carga real por input CSV, si se logra.

Si no se logra input real, reportar NO GO y no afirmar `csvLoadedViaUi: true`.

## Restricciones

No tocar:

- `auditEngine`, salvo bug real explícito y justificado;
- scoring determinista;
- contratos v2;
- freezes Phase 5-9;
- `docs/tercera_entrega_aura/`;
- schema L6 salvo necesidad estricta;
- `evidenceManifest` salvo necesidad estricta;
- `exportPackage` salvo necesidad estricta;
- `exportContractValidation` salvo necesidad estricta.

No usar datos reales.
No descargar modelos.
No depender de proveedor AI real.
No declarar production-ready, benchmark definitivo, mejor modelo universal ni inicio de cuarta entrega.

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
git commit -m "test: validate L10 real CSV file input flow"
git push origin main
```

## Reporte final

Reportar:

- SHA completo;
- push;
- estado limpio/sincronizado;
- si se usó `setInputFiles` o equivalente;
- selector del input usado;
- evidencia `csvLoadedViaUi: true`;
- evidencia `fileInputInteraction: setInputFiles`;
- evidencia `harnessProcessedCsv: false`;
- manifest rows/columns;
- profile rows/columns;
- punto exacto donde entra harness posterior al upload;
- screenshots;
- pruebas;
- greps;
- riesgos abiertos;
- recomendación.
