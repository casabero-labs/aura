# Phase 10 L13B — Diagnostic Report Data Model Closeout

## 1. Proposito

L13B crea el modelo interno `DiagnosticReport` y un builder determinista para representar el perfil definitivo / diagnostic report sin modificar todavia el pipeline visual, el PDF, el export contract ni contratos v2.

El objetivo es dejar una frontera estable para los loops posteriores:

- L13C: refactor de estado del pipeline.
- L13D: UI de `DiagnosticReportStep`.
- L13E: generador PDF profesional.
- L13F: rama opcional de remediacion.

## 2. Archivos creados

| Archivo | Proposito |
|---|---|
| `src/services/diagnosticReport/types.ts` | Tipos serializables de `DiagnosticReport`, findings, recomendaciones, charts y readiness |
| `src/services/diagnosticReport/diagnosticReportBuilder.ts` | Builder puro `buildDiagnosticReport(...)` desde `AuditReport` y diagnostico opcional |
| `src/services/diagnosticReport/index.ts` | Barrel export del modulo |
| `src/__tests__/diagnosticReportBuilder.test.ts` | 12 pruebas unitarias con fixture Titanic minimo en memoria |
| `docs/product/aura/phase_10/L13B_REPORT_DATA_MODEL_CLOSEOUT.md` | Este cierre |

## 3. Modelo `DiagnosticReport`

El modelo incluye:

- `metadata`: id estable, fecha derivada de evidencia disponible, version, fingerprint, dimensiones, delimitador, score base y `scoreModified: false`.
- `status`: estado diagnostico, script opcional, reporte principal sin bloqueo HITL y HITL solo para remediacion.
- `evidenceBase`: conteos por severidad/categoria/tipos, nulos, cardinalidad, outliers, issues principales y resumen numerico.
- `diagnosisSummary`: fuente `structured_v2`, `legacy_text` o `unavailable`, con proveedor/modelo cuando existe, observaciones y limitaciones.
- `findingGroups`: riesgos confirmados, posibles candidatos de falso positivo contextual, revision humana y remediacion opcional.
- `recommendations`: acciones conservadoras con prioridad, rationale, tipo de accion, necesidad de script y HITL.
- `chartSpecs`: specs serializables para graficos futuros, sin dependencia de DOM, Recharts ni imagenes externas.
- `exportReadiness`: readiness de PDF, JSON tecnico, CSV de hallazgos y exportes de script.

## 4. Como alimentara UI/PDF/export

- UI: `DiagnosticReportStep` podra renderizar el perfil definitivo sin recomputar agrupaciones ni heuristicas.
- PDF: L13E podra consumir `chartSpecs` y `evidenceBase` para tablas y graficos reproducibles desde `AuditReport` / `columnStats`.
- Export: el JSON tecnico podra incluir o derivar este objeto en un loop posterior, sin cambiar ahora el contrato existente.
- Remediacion: `findingGroups.optionalRemediationCandidates` y recomendaciones de script sirven para abrir la rama opcional sin bloquear el reporte principal.

## 5. Que no se toco

- `MainPipeline.tsx`
- Estados del pipeline
- `DiagnosticReportStep`
- `pdfGenerator.ts`
- `exportPackage.ts`
- Export contract
- Contratos v2
- Scoring
- `calibrationEvidence`
- Dependencias
- Proveedores reales
- Datasets externos
- Comportamiento visual

## 6. Validaciones

| Comando | Resultado |
|---|---|
| `cd src && npx vitest run __tests__/diagnosticReportBuilder.test.ts` | 1 file, 12 tests, OK |
| `cd src && npm run typecheck` | OK |
| `cd src && npm run build` | OK, con warnings conocidos de chunking/imports dinamicos |

Nota de ruta: despues de `cd src`, el path real del test es `__tests__/diagnosticReportBuilder.test.ts`. La forma `src/__tests__/...` apunta a `src/src/__tests__` y Vitest no encuentra archivos.

## 7. Riesgos abiertos

1. `generatedAt` se mantiene determinista usando fecha de diagnostico, evidencia o sentinel estable; L13E puede decidir si el PDF necesita fecha de emision separada.
2. `exportReadiness.missingInputs` marca `auditEvidence` como faltante aunque PDF/JSON/CSV sigan listos con solo `AuditReport`.
3. Las heuristicas de posibles falsos positivos son conservadoras y no sustituyen revision de dominio.
4. El modelo aun no esta conectado a UI, PDF ni export; eso queda deliberadamente para L13C-L13E.
5. La rama de remediacion opcional necesita UX explicita para no parecer requisito del reporte principal.

## 8. Siguiente loop recomendado

**L13C Pipeline state refactor**.

Ahora que existe una frontera interna `DiagnosticReport`, el siguiente paso es agregar la etapa `diagnostic_report` al flujo sin tocar todavia el generador PDF profesional.
