# Phase 10 L13D — DiagnosticReportStep UI Closeout

## Proposito

L13D reemplaza la compuerta minima de `diagnostic_report` por una pantalla profesional de perfil definitivo del dataset. La fuente unica de la vista es `DiagnosticReport`; no se modifican scoring, auditoria determinista, contratos LLM v2, PDF ni export contract.

## Archivos creados

| Archivo | Proposito |
|---|---|
| `src/components/DiagnosticReportStep.tsx` | Pantalla principal del perfil definitivo / reporte diagnostico |
| `src/components/diagnosticReport/DiagnosticReportSummaryCards.tsx` | Tarjetas de score, dimensiones, hallazgos, recomendaciones y estado de diagnostico |
| `src/components/diagnosticReport/DiagnosticReportChartPreview.tsx` | Previsualizacion CSS de `chartSpecs` sin dependencias ni canvas |
| `src/components/diagnosticReport/DiagnosticFindingGroup.tsx` | Secciones de hallazgos por grupo |
| `src/components/diagnosticReport/DiagnosticRecommendationsPanel.tsx` | Panel de recomendaciones con traduccion de acciones |
| `src/components/diagnosticReport/index.ts` | Barrel export de subcomponentes |
| `src/__tests__/diagnosticReportStep.test.tsx` | Tests focales de la pantalla con fixture `DiagnosticReport` en memoria |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/components/DiagnosticReportGateStep.tsx` | Queda como wrapper temporal hacia `DiagnosticReportStep` |
| `src/components/MainPipeline.tsx` | Renderiza `DiagnosticReportStep` en el estado `diagnostic_report` |
| `src/index.css` | Estilos responsivos para pantalla, cards, chart previews, hallazgos y recomendaciones |
| `src/__tests__/pipelineDiagnosticReportState.test.tsx` | Actualiza expectativas al lenguaje humano de L13D |
| `docs/product/aura/NEXT_STEPS.md` | Marca L13D como cerrado y L13E como siguiente |

## Descripcion de la pantalla

La pantalla muestra un header editorial con eyebrow `perfil definitivo`, titulo `Diagnóstico consolidado del dataset` y subtitulo segun `diagnosticStatus`.

Tambien incluye:

- Tarjetas principales: score base, filas, columnas, total de hallazgos, riesgos confirmados, posibles falsos positivos contextuales, recomendaciones y estado de diagnostico con label humano.
- Caja de gobernanza: score intacto, diagnostico contextual, script opcional, HITL solo en remediacion y ausencia de correccion automatica desde la pantalla.
- Resumen ejecutivo desde `diagnosticReport.diagnosisSummary.executiveSummary`.
- Fuente del resumen con label humano: contrato estructurado v2, diagnostico legacy en texto libre o evidencia determinista sin diagnostico asistido.
- Previsualizacion de `chartSpecs` con barras CSS o tabla simple.
- Secciones de hallazgos: riesgos confirmados, posibles falsos positivos contextuales, requieren revision humana y candidatos de remediacion opcional.
- Panel de recomendaciones con prioridad, rationale, accion traducida, script requerido y HITL requerido.

## Script como rama opcional

La accion principal sigue siendo `Ir a exportación principal`. La pantalla declara que exportar no exige script y que script no es necesario para cerrar el analisis.

La accion `Generar script recomendado, opcional` conserva la rama de remediacion introducida en L13C, sin volver obligatorio HITL para el reporte principal.

## Que no se toco

- `pdfGenerator.ts`.
- `exportPackage.ts` y export contract.
- Contratos LLM v2.
- `runAudit`.
- Scoring.
- `calibrationEvidence`.
- Dependencias.
- Proveedores reales.

## Validaciones

| Comando | Resultado |
|---|---|
| `cd src && npm run typecheck` | OK |
| `cd src && npm run build` | OK, con advertencias Vite existentes sobre chunking/import dinamico |
| `cd src && npx vitest run __tests__/diagnosticReportBuilder.test.ts` | OK, 12 tests |
| `cd src && npx vitest run __tests__/pipelineDiagnosticReportState.test.tsx` | OK, 3 tests |
| `cd src && npx vitest run __tests__/diagnosticReportStep.test.tsx` | OK, 12 tests |
| Grep claims prohibidos amplio | Coincidencias historicas en prompts/closeouts antiguos y prohibiciones documentadas; sin claims nuevos en L13D |
| Grep claims LLM-score/validacion formal/correccion automatica | Sin coincidencias |

## Riesgos abiertos

1. Los graficos son una previsualizacion CSS; L13E debe convertirlos en graficos profesionales reproducibles en PDF.
2. El PDF actual todavia no consume `DiagnosticReport`.
3. Export contract aun no modela el reporte diagnostico como artefacto principal.
4. La rama opcional de remediacion requiere ajuste fino en L13F.
5. Falta E2E humano Titanic completo en L13G.

## Siguiente loop recomendado

**L13E Professional PDF generator**: generar el PDF diagnostico profesional como salida principal, derivando graficos desde `AuditReport` / `columnStats` y sin depender de imagenes externas.
