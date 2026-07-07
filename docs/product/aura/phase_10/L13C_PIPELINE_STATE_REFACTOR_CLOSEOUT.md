# Phase 10 L13C — Pipeline State Refactor Closeout

## Proposito

L13C conecta el modelo `DiagnosticReport` creado en L13B con el estado real del pipeline. El flujo principal deja de saltar de diagnostico a script y ahora pasa por una etapa `diagnostic_report` / perfil definitivo antes de exportar.

Flujo principal actualizado:

```text
upload -> profile -> calibration -> diagnosis -> diagnostic_report -> export
```

Rama opcional de remediacion:

```text
diagnostic_report -> script -> review -> export
```

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/MainPipeline.tsx` | Agrega `diagnostic_report`, persiste `diagnosticReport`, construye el reporte al continuar desde diagnostico y abre exportacion principal sin exigir script |
| `src/components/DiagnosticReportGateStep.tsx` | Nueva compuerta minima funcional del perfil definitivo |
| `src/components/PipelineProgress.tsx` | Agrega etapa Reporte y marca Script/Revisión como opcionales |
| `src/components/PipelineDevelopmentMatrix.tsx` | Agrega icono para el nuevo estado tipado |
| `src/App.tsx` | Inicializa/restaura `diagnosticReport` y ajusta texto minimo de exportacion |
| `src/__tests__/pipelineDiagnosticReportState.test.tsx` | Pruebas focales del stepper y compuerta de reporte |
| `src/components/MainPipeline.test.tsx` | Fixture actualizado con `diagnosticReport: null` |
| `src/__tests__/pipelineSession.test.ts` | Fixtures de sesion actualizados con `diagnosticReport: null` |
| `src/__tests__/exportJsonPreflight.integration.test.tsx` | Snapshot de sesion actualizado con `diagnosticReport: null` |
| `src/__tests__/scriptGenerationStepV2.test.tsx` | Fixtures de `MainPipeline` actualizados con `diagnosticReport: null` |
| `docs/product/aura/NEXT_STEPS.md` | Marca L13C como cerrado y L13D como siguiente |

## Cambios de flujo

- `PipelineState` incluye `diagnostic_report`.
- `PipelineData` incluye `diagnosticReport: DiagnosticReport | null`.
- `DiagnosisStep` usa `buildAndOpenDiagnosticReport()` como `onContinue`.
- `buildAndOpenDiagnosticReport()` llama a `buildDiagnosticReport(...)` con `report`, `auditEvidence`, `structuredDiagnosis`, `aiAnalysis`, `deterministicValidation` y `fileName`.
- Si el usuario continua sin diagnostico LLM estructurado, el reporte se construye igual desde evidencia determinista.
- La navegacion interna permite abrir `diagnostic_report` solo si existe `report`; si no hay `diagnosticReport` guardado, lo construye bajo demanda.
- Desde `diagnostic_report`, el usuario puede ir directo a exportacion principal o entrar opcionalmente a script.

## Que se conserva intacto

- `runAudit` y el motor determinista.
- Scoring y calculo de score base.
- `calibrationEvidence` y flujo de calibracion.
- Contratos LLM v2.
- Export contract.
- `pdfGenerator.ts`.
- `exportPackage.ts`.
- Dependencias del proyecto.
- Proveedores reales de LLM.

## Compuerta minima

`DiagnosticReportGateStep` muestra:

- Titulo `Perfil definitivo del dataset`.
- Texto de consolidacion de evidencia determinista y diagnostico disponible.
- Score base.
- Filas y columnas.
- Estado de diagnostico.
- Conteos de riesgos confirmados, posibles falsos positivos contextuales y recomendaciones.
- Accion principal `Ir a exportación principal`.
- Acciones secundarias para generar script opcional y volver al diagnostico.

Tambien declara explicitamente que el score base no fue modificado, que el script es opcional y que HITL solo aplica al entrar en remediacion con script.

## Validaciones

| Comando | Resultado |
|---|---|
| `cd src && npm run typecheck` | OK |
| `cd src && npm run build` | OK, con advertencias Vite existentes sobre chunking/import dinamico |
| `cd src && npx vitest run __tests__/diagnosticReportBuilder.test.ts` | OK, 12 tests |
| `cd src && npx vitest run __tests__/pipelineDiagnosticReportState.test.tsx` | OK, 3 tests |

## Riesgos abiertos

1. La pantalla `DiagnosticReportGateStep` es deliberadamente minima; L13D debe convertirla en la UI profesional de perfil definitivo.
2. El PDF aun usa el generador existente; L13E debe crear el PDF diagnostico profesional con graficos reproducibles desde `AuditReport` y `columnStats`.
3. El export contract aun no modela `DiagnosticReport` como artefacto principal; se mantiene fuera de L13C por restriccion de alcance.
4. Script y revision ya son opcionales desde el nuevo gate, pero L13F debe pulir la rama de remediacion completa.
5. Los E2E humanos del flujo completo quedan para L13G.

## Siguiente loop recomendado

**L13D DiagnosticReportStep UI**: reemplazar la compuerta minima por una pantalla de perfil definitivo clara, navegable y orientada a exportacion principal, sin cambiar PDF ni contratos todavia.
