# Phase 10 L13E - Professional Diagnostic PDF Generator Closeout

## Proposito

L13E introduce un generador profesional de PDF diagnostico basado en `DiagnosticReport`.

El PDF pasa a representar la salida principal del flujo diagnostico y puede generarse sin script aprobado, sin proveedor LLM activo y sin HITL. La evidencia estadistica y los graficos salen de `DiagnosticReport.chartSpecs`, derivados del `AuditReport` y `columnStats`.

## Archivos creados

- `src/services/diagnosticReport/diagnosticPdfGenerator.ts`
- `src/services/diagnosticReport/pdfLayout.ts`
- `src/services/diagnosticReport/pdfCharts.ts`
- `src/services/diagnosticReport/pdfTables.ts`
- `src/__tests__/diagnosticPdfGenerator.test.ts`

## Archivos modificados

- `src/services/diagnosticReport/index.ts`
- `src/App.tsx`
- `docs/product/aura/NEXT_STEPS.md`

## Estructura del PDF

El informe generado contiene:

1. Portada sobria con archivo, fecha, fingerprint, score base, filas, columnas y estado del diagnostico.
2. Resumen ejecutivo con fuente humana: contrato estructurado v2, diagnostico legacy o evidencia determinista.
3. Perfil tecnico base con score, dimensiones, duplicados, conteos de severidad, categorias y tipos.
4. Graficos estadisticos reproducibles desde `chartSpecs`.
5. Tabla de hallazgos priorizados.
6. Riesgos confirmados.
7. Posibles falsos positivos contextuales con la nota: "Posible, no definitivo. No modifica score."
8. Recomendaciones con accion, prioridad, requisito de script y requisito HITL.
9. Acciones opcionales de remediacion.
10. Limitaciones metodologicas.
11. Anexo tecnico sin datos crudos completos.

## Graficos

Los graficos se dibujan como vectores con jsPDF:

- barras verticales para conteos por severidad.
- barras horizontales para categorias, nulos y cardinalidad.
- lista proporcional para distribuciones tipo `pie`.
- tabla compacta para `kind=table`.

No se usan imagenes externas, capturas, canvas ni DOM. Si un `chartSpec` no tiene datos, el PDF muestra un estado "Sin datos".

## Score y gobernanza

- `generateDiagnosticPdfReport` consume `DiagnosticReport` como fuente unica.
- El PDF muestra `scoreBase` y conserva `scoreModified: false`.
- El diagnostico asistido contextualiza, pero no recalcula el score.
- Los posibles falsos positivos quedan como candidatos de revision, no como conclusiones definitivas.

## Script opcional

El PDF declara que:

- el informe puede cerrarse sin script.
- la generacion de script es una rama opcional.
- HITL solo aplica si el usuario entra a remediacion con script.
- la reauditoria se usa para medir delta si el usuario decide remediar.

## Integracion en App/export

`App.tsx` actualiza `handleDownloadPdf`:

- si `pipelineData.diagnosticReport` existe, usa `generateDiagnosticPdfReport`.
- si no existe `diagnosticReport` pero existe `report`, conserva el fallback legado con `generatePdfReport`.
- el boton de exportacion principal queda como "Informe diagnostico PDF".

No se modifico el contrato de exportacion JSON ni los anexos de script.

## Que no se toco

- scoring.
- `runAudit`.
- `calibrationEvidence`.
- contratos LLM v2.
- export contract.
- generacion de script.
- revision HITL.
- proveedores reales.
- datasets externos.
- dependencias.

## Validaciones

Comandos ejecutados:

- `cd src && npm run typecheck` - exitoso.
- `cd src && npm run build` - exitoso, con warnings existentes de chunking/import dinamico.
- `cd src && npx vitest run __tests__/diagnosticReportBuilder.test.ts` - 12 tests exitosos.
- `cd src && npx vitest run __tests__/diagnosticReportStep.test.tsx` - 12 tests exitosos.
- `cd src && npx vitest run __tests__/pipelineDiagnosticReportState.test.tsx` - 3 tests exitosos.
- `cd src && npx vitest run __tests__/diagnosticPdfGenerator.test.ts` - 12 tests exitosos.
- grep amplio de claims sobre `docs/product/aura/phase_10` y `docs/product/aura/NEXT_STEPS.md` - devuelve coincidencias heredadas en prompts y closeouts previos de Phase 10; L13E y `NEXT_STEPS.md` quedan limpios en verificacion acotada.
- grep de frases de score/perfil/auto-fix LLM - sin coincidencias.

## Tests

`src/__tests__/diagnosticPdfGenerator.test.ts` cubre:

- PDF determinista sin script.
- filename `.pdf`.
- `pageCount >= 1`.
- callback `save`.
- no mutacion de `DiagnosticReport`.
- `chartSpecs` vacios.
- falsos positivos contextuales.
- recomendaciones.
- fuente `unavailable`.
- fuente `structured_v2`.
- textos largos.
- remediacion opcional vacia.

## Riesgos abiertos

- Falta prueba de integracion ligera que monte `App.tsx` y confirme que el boton usa el nuevo generador cuando existe `diagnosticReport`; se deja como candidato para L13G si el montaje completo introduce ruido de proveedores.
- La calidad visual se valida por estructura y generacion; el loop no introduce capturas ni artefactos externos por restriccion de producto.
- L13F todavia debe ordenar mejor la rama de script/remediacion para que su caracter opcional sea mas claro en todo el flujo.

## Siguiente loop recomendado

L13F Optional remediation branch.
