# Phase 10 L11 — Agent Prompt

## Nombre

Phase 10 L11 — E2E Playwright de calibración embebida en pipeline principal

## Repo

casabero-labs/aura

## Modo

Trabaja desde `main`.

Si typecheck, build, Vitest, Playwright y greps pasan, haz commit y push a `origin/main`.

No abras PR. No crees ramas.

## Objetivo

Validar el corazón original de Phase 10: el antiguo laboratorio/calibración experimental debe funcionar como opción informada dentro del pipeline principal de AURA, no como módulo principal separado ni como requisito obligatorio.

L10B ya cerró el flujo real de input CSV → perfilamiento → exportación técnica 2.0. L11 debe probar que, después del perfilamiento real, el usuario puede:

1. continuar diagnóstico normal sin calibración;
2. activar comparación/calibración experimental dentro del pipeline;
3. exportar evidencia con `calibrationEvidence` coherente;
4. mantener límites de claims: calibración experimental, no benchmark formal ni mejor modelo universal.

## Leer antes

- `docs/product/aura/phase_10/PHASE10_PRODUCT_COMPLETION_ROADMAP.md`
- `docs/product/aura/phase_10/L10_FULL_FLOW_E2E_CLOSEOUT.md`
- `src/tests/e2e/aura-full-flow-export.spec.ts`
- `src/components/MainPipeline.tsx`
- `src/components/FileUpload.tsx`
- `src/components/CalibrationOptInExplainer.tsx`
- `src/components/CalibrationEmbeddedPanel.tsx`
- `src/components/BenchmarkLab.tsx`
- `src/services/evidenceManifest.ts`
- `src/services/exportPackage.ts`
- `docs/product/aura/contracts/aura-technical-export.schema.json`

## Alcance esperado

Crear o actualizar:

- `src/tests/e2e/aura-embedded-calibration.spec.ts`
- `src/tests/e2e/fixtures/aura_l11_calibration_flow.csv`
- `docs/product/aura/phase_10/l11_evidence/evidence.json`
- `docs/product/aura/phase_10/l11_evidence/screenshots/`
- `docs/product/aura/phase_10/L11_EMBEDDED_CALIBRATION_E2E_CLOSEOUT.md`

Puede reutilizar el patrón estable de L10B:

- `setInputFiles` real sobre `[data-testid="csv-file-input"]`;
- refs frescas para lectura de estado;
- harness solo después de carga/perfilamiento real;
- sin proveedor AI real;
- sin descarga de modelos.

## Escenarios mínimos

### L11-01 — Camino principal: continuar diagnóstico normal

Debe validar:

1. abrir AURA en Chromium;
2. ir a auditoría;
3. cargar CSV real desde UI con `setInputFiles`;
4. esperar estado `profile` real;
5. verificar presencia del opt-in de calibración o explicación experimental;
6. ejecutar acción principal `Continuar diagnóstico normal`;
7. demostrar que la calibración no bloquea el flujo normal;
8. exportar JSON técnico 2.0;
9. validar que `calibrationEvidence.summary.status` queda `none` o estado coherente cuando no se ejecuta calibración;
10. validar `calibrationEvidence.summary.limitations` incluye que la calibración es opcional y no bloquea diagnóstico normal;
11. validar ausencia de bloque raíz `experiment`.

### L11-02 — Camino secundario: activar calibración embebida

Debe validar:

1. partir de CSV cargado y perfilamiento real;
2. hacer clic en `Activar comparación experimental` o botón equivalente;
3. comprobar que aparece `CalibrationEmbeddedPanel` o una vista embebida equivalente dentro del pipeline;
4. comprobar que no se navega a `BenchmarkLab` como módulo principal separado;
5. ejecutar o simular de forma controlada el resultado de calibración si la ejecución real es costosa o depende de proveedor;
6. registrar estado de calibración como `attempted`, `preliminary` o `formal` si hay resultado, o documentar `none` si no se ejecuta;
7. exportar JSON técnico 2.0;
8. validar `calibrationEvidence` como bloque raíz;
9. validar que no existe bloque raíz `experiment`;
10. validar que no aparece claim de benchmark formal, modelo ganador ni mejor modelo universal.

Si el panel embebido aún no permite una ejecución E2E estable, documentar exactamente el punto de harness y no afirmar más de lo probado.

## Evidencia mínima requerida

`docs/product/aura/phase_10/l11_evidence/evidence.json` debe incluir:

```json
{
  "testRun": {
    "phase": "L11",
    "browser": "chromium",
    "csvLoadedViaUi": true,
    "fileInputInteraction": "setInputFiles",
    "harnessBeforeProfile": false,
    "providerMode": "mock-or-skipped-for-ai"
  },
  "scenarios": {
    "normalPath": {
      "profileReached": true,
      "calibrationOptInVisible": true,
      "continuedWithoutCalibration": true,
      "calibrationBlockedNormalFlow": false
    },
    "embeddedCalibrationPath": {
      "profileReached": true,
      "activatedExperimentalComparison": true,
      "embeddedPanelVisible": true,
      "benchmarkLabMainNavigationUsed": false
    }
  },
  "exportValidations": {
    "exportContractName": true,
    "exportContractVersion": true,
    "calibrationEvidenceRoot": true,
    "experimentRootAbsent": true,
    "legacyAliasNotIncluded": true
  },
  "claimBoundary": {
    "noFormalBenchmarkClaim": true,
    "noBestModelClaim": true,
    "noProductionReadyClaim": true
  },
  "allPassed": true
}
```

## Screenshots sugeridos

- `01_upload_step_ready.png`
- `02_profile_reached.png`
- `03_calibration_opt_in_visible.png`
- `04_continue_normal_path.png`
- `05_embedded_calibration_panel.png`
- `06_export_contract_validated.png`

## Reglas de implementación

1. Usar selectores user-facing preferidos: roles, labels, textos visibles.
2. Si una zona necesita selector estable, añadir `data-testid` mínimo y justificado.
3. No crear pruebas frágiles con CSS/XPath profundos.
4. No ocultar fallos de UI con harness.
5. Harness permitido solo para:
   - evitar proveedor AI real;
   - evitar descargas de modelos;
   - estabilizar resultado de calibración si ejecutar todos los modelos no es viable;
   - leer/exportar JSON después de que el estado real exista.
6. Harness no permitido para:
   - simular carga CSV antes del perfilamiento;
   - simular que el opt-in existe;
   - simular que el panel embebido existe.

## Restricciones duras

No tocar:

- `auditEngine`, salvo bug real explícito y justificado;
- scoring determinista;
- contratos v2;
- freezes Phase 5-9;
- `docs/tercera_entrega_aura/`;
- schema L6 salvo necesidad estricta;
- `exportPackage` salvo necesidad estricta;
- `exportContractValidation` salvo necesidad estricta.

No usar datos reales.
No descargar modelos.
No depender de proveedor AI real.
No declarar sistema listo para producción general.
No declarar benchmark formal definitivo.
No declarar modelo ganador universal.
No iniciar una nueva entrega académica.

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
cd src && npm run test:e2e -- aura-embedded-calibration.spec.ts
```

## Greps obligatorios

```text
grep -R "benchmark definitivo\|mejor modelo\|modelo ganador\|ganador universal\|production-ready" src docs/product/aura/phase_10 docs/product/aura/contracts || true
grep -R "\bexperiment\b" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "calibrationEvidence" src/App.tsx src/services src/__tests__ src/tests/e2e docs/product/aura/contracts || true
grep -R "cuarta entrega" src docs/product/aura/phase_10 docs/product/aura/contracts || true
```

Criterio: los términos prohibidos solo pueden aparecer en restricciones, validadores, tests de ausencia, migraciones/deprecaciones o documentación de límites. No como claims positivos.

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
git commit -m "test: add embedded calibration pipeline E2E evidence"
git push origin main
```

## Reporte final

Reportar:

- SHA completo;
- push;
- estado limpio/sincronizado;
- archivos modificados/creados;
- fixture usado;
- si usó `setInputFiles` real;
- punto exacto de harness/mock;
- escenarios L11-01 y L11-02;
- screenshots;
- evidencia JSON;
- resultado de typecheck;
- resultado de build;
- resultado de Vitest;
- resultado de Playwright;
- greps;
- restricciones;
- riesgos abiertos;
- recomendación.
