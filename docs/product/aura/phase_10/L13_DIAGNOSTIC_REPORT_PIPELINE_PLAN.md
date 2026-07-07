# Phase 10 L13A — Diagnostic Report Pipeline Plan

## 1. Decisión de producto

AURA debe dejar de tratar el script como la salida natural despues del diagnostico. La salida principal del pipeline pasa a ser un **informe diagnostico en PDF** y un **perfil definitivo** construido a partir de evidencia determinista, diagnostico asistido y limites metodologicos explicitos.

El perfil tecnico base sigue siendo obligatorio y se ejecuta antes del diagnostico. Ese perfil alimenta al LLM y al reporte, pero ya no debe presentarse como el perfil final del caso.

La remediacion con script queda como rama opcional: el usuario decide si quiere generar propuesta de limpieza, revisar contrato/script, ejecutar HITL y luego preparar anexos de mejora.

## 2. Alcance de L13A

Este loop solo documenta arquitectura y plan de trabajo. No implementa codigo productivo.

No se modifican contratos v2, export contract, scoring, `calibrationEvidence`, dependencias ni tests. La intencion es dejar una ruta de loops pequenos y verificables para cambiar el producto sin romper la evidencia ya congelada.

## 3. Flujo actual observado

El flujo actual esta modelado en `src/components/MainPipeline.tsx` con:

```txt
upload -> profile -> calibration -> diagnosis -> script -> review -> export
```

Observaciones por archivo:

- `MainPipeline.tsx`
  - `PipelineState` solo conoce `upload`, `profile`, `calibration`, `diagnosis`, `script`, `review` y `export`.
  - `processFile` parsea CSV, ejecuta `runAudit`, construye `auditEvidence`, guarda `AuditReport` y pasa a `profile`.
  - `ProfileStep` continua a `calibration`; el skip de calibracion continua a `diagnosis`.
  - `DiagnosisStep` continua siempre a `script`.
  - `ScriptGenerationStepV2` o `ScriptGenerationStep` continuan a `review`.
  - `ReviewStep` continua a `export`.

- `ProfileStep.tsx`
  - Presenta el perfil como "perfil del dataset" y "Analisis de calidad y estructura".
  - Muestra score, prioridades, evidencia tecnica completa, reglas, hallazgos y estadisticas.
  - La accion primaria es `Generar diagnostico`.

- `DiagnosisStep.tsx`
  - Construye la entrada de diagnostico desde `AuditReport`.
  - En modo v2 ejecuta `runStructuredDiagnosis` y guarda `DiagnosisExecutionResult`.
  - En modo legacy guarda texto en `aiAnalysis`.
  - Ya permite descargar un PDF/JSON consolidado local desde la etapa de diagnostico.
  - La accion principal de continuidad sigue siendo `Continuar a propuesta`, que manda al usuario a script/remediacion.

- `ScriptGenerationStep.tsx`
  - Es un router entre v2 y legacy.
  - En v2 delega a `RemediationPlanStepV2`.
  - En legacy delega a `LegacyScriptGenerationStepV1`.

- `ScriptGenerationStepV2.tsx`
  - Construye el flujo contractual de remediacion:
    `RemediationPlanV2 -> ScriptBuildContextV2 -> ScriptContractCandidateV2 -> ScriptContractV2`.
  - La salida de esta etapa es un contrato de script validado, no un reporte diagnostico final.
  - Solo despues de contrato valido permite continuar a revision.

- `ReviewStep.tsx`
  - Hace obligatoria la revision humana para aprobar script o contrato.
  - En v1 simula remediacion sobre copia y calcula `HealthDelta`.
  - En v2 verifica contrato fresco antes de marcar aprobacion humana.
  - Solo despues de aprobacion/simulacion permite preparar exportacion.

- `App.tsx`
  - Renderiza la seccion de exportacion fuera de `MainPipeline`, solo cuando `pipelineData.state === 'export'`.
  - `handleDownloadPdf` llama `generatePdfReport(report, ..., aiAnalysis, scriptValidation, ..., healthDelta)`.
  - `handleExportJson` usa `buildAuraExportPackage`.
  - Ya existen descargas para PDF, JSON tecnico y CSV de hallazgos.
  - Script aprobado y notebook Colab dependen de `approvedCleaningScript`.

- `pdfGenerator.ts`
  - Genera un PDF ejecutivo basado en `AuditReport`, contenido ejecutivo, diagnostico LLM opcional, validacion de script opcional y `HealthDelta` opcional.
  - Incluye tablas de perfil de columnas y hallazgos deterministas.
  - El script aparece como seccion/anexo solo si existe.
  - Todavia no tiene graficos estadisticos reproducibles derivados del perfil.

- `exportPackage.ts`
  - El contrato tecnico actual incluye bloques canonicos `manifest`, `profile`, `diagnosis`, `script` y `calibrationEvidence`.
  - `calibrationEvidence` se conserva como evidencia experimental separada.
  - El bloque `script` existe aunque la remediacion no sea siempre el camino principal.

- `contracts/llm/types.ts`
  - `DiagnosisExecutionResult` contiene `DiagnosisResponseV2`, metricas, `promptHash`, `evidenceEnvelopeRef` y `remediationContext` opcional.
  - Los tipos de remediacion y script estan separados: `RemediationPlanV2`, `ScriptBuildContextV2`, `ScriptContractV2`.
  - No existe todavia un tipo productivo para `DiagnosticReport`.

## 4. Nuevo flujo propuesto

Flujo principal:

```txt
upload
  -> perfil_tecnico_base
  -> calibration opcional
  -> diagnostico_asistido
  -> diagnostic_report / perfil_definitivo
  -> exportacion_principal
```

Rama opcional de remediacion:

```txt
diagnostic_report
  -> generar plan/script opcional
  -> revision HITL obligatoria para script
  -> simulacion / reauditoria
  -> exportacion con anexos de remediacion
```

La consecuencia central es que **el PDF diagnostico debe poder generarse sin script aprobado**. El script no es requisito para exportar la evidencia principal.

## 5. Diferencias conceptuales

### a. Perfil tecnico base

Es el resultado reproducible del motor determinista:

- `AuditReport`
- `auditEvidence`
- `columnStats`
- `issues`
- score determinista
- validacion determinista cuando exista ground truth

Debe alimentar diagnostico y reporte, pero no venderse como perfil definitivo. Es la base tecnica.

### b. Diagnostico asistido

Es la interpretacion contextual que produce el proveedor LLM o el flujo estructurado v2:

- texto legacy `aiAnalysis`, o
- `DiagnosisExecutionResult` en contratos v2.

Puede explicar patrones, agrupar riesgos, proponer hipotesis, reconocer limites y sugerir acciones. No cambia score, no re-clasifica la evidencia determinista como verdad nueva y no sustituye validacion humana.

### c. Perfil definitivo / diagnostic report

Es el artefacto final del flujo principal. Debe separar:

- evidencia determinista
- interpretacion contextual
- posibles falsos positivos
- riesgos confirmados
- recomendaciones
- acciones opcionales

El perfil definitivo no es "solo el perfil tecnico bonito" ni "solo el texto del LLM". Es una composicion gobernada: evidencia reproducible primero, interpretacion despues, limites visibles siempre.

### d. Remediacion opcional

Es una decision posterior al reporte. Incluye plan de remediacion, script/contrato, revision humana, simulacion y anexos de delta cuando el usuario lo solicita.

La revision HITL debe ser obligatoria solo si el usuario decide generar/remediar con script. No debe bloquear el PDF diagnostico ni el JSON tecnico base.

## 6. Qué se conserva intacto

- Motor determinista `runAudit`.
- Score y formulas actuales.
- `AuditReport` como fuente primaria de evidencia.
- `columnStats` como base de tablas y futuros graficos.
- `calibrationEvidence` y su separacion metodologica.
- Contratos v2 existentes.
- Export contract existente durante L13A.
- Validaciones de provider readiness.
- Reglas de privacidad y trazabilidad del diagnostico.
- Remediacion con HITL como capacidad valiosa, pero ya no como camino obligatorio.

## 7. Cambios futuros en MainPipeline

L13C debe introducir una etapa nueva, probablemente `diagnostic_report`, sin tocar todavia los contratos v2:

```ts
type PipelineState =
  | 'upload'
  | 'profile'
  | 'calibration'
  | 'diagnosis'
  | 'diagnostic_report'
  | 'script'
  | 'review'
  | 'export';
```

Cambios esperados:

- `profile` debe renombrarse visualmente como perfil tecnico base.
- `DiagnosisStep.onContinue` debe ir a `diagnostic_report`, no a `script`.
- `diagnostic_report` debe permitir:
  - exportar reporte diagnostico,
  - ir a exportacion principal,
  - iniciar remediacion opcional.
- `script` y `review` deben quedar fuera del camino feliz principal.
- El stepper debe distinguir flujo principal de rama opcional.
- Si falla el proveedor LLM, debe existir reporte determinista con estado de diagnostico asistido no disponible.
- La invalidacion de contratos de script debe seguir funcionando cuando cambian dataset, diagnostico o plan.

## 8. Cambios futuros en App/export

`App.tsx` debe dejar de asumir que `export` significa cierre posterior a HITL.

La exportacion principal debe permitir:

1. PDF diagnostico.
2. JSON tecnico.
3. CSV de hallazgos.

Los exportables de remediacion deben ser opcionales:

- script aprobado;
- notebook Colab;
- health delta;
- decision HITL;
- anexos de reauditoria.

Mientras no se toque el export contract, el JSON tecnico puede seguir usando el contrato actual con bloque `script` vacio o nulo segun permitan las validaciones actuales. La decision de cambiar el contrato queda para un loop posterior, no para L13A.

## 9. Cambios futuros en PDF

El PDF principal debe cambiar de "reporte ejecutivo con diagnostico opcional" a **informe diagnostico profesional**.

Debe poder generarse cuando existen:

- `AuditReport`;
- `auditEvidence`;
- diagnostico asistido disponible o estado honesto de no disponibilidad.

No debe requerir:

- script generado;
- script aprobado;
- decision HITL;
- `HealthDelta`.

Contenido minimo esperado:

- portada con dataset, fecha, fingerprint y score determinista;
- resumen ejecutivo basado en evidencia;
- perfil tecnico base;
- hallazgos deterministas priorizados;
- diagnostico asistido y sus limites;
- posibles falsos positivos;
- riesgos confirmados;
- recomendaciones;
- acciones opcionales;
- limitaciones metodologicas;
- anexos de remediacion solo si existen.

En loops posteriores, el PDF debe incorporar graficos estadisticos reproducibles. Esos graficos deben derivarse de `AuditReport` / `columnStats`, no de imagenes externas. Ejemplos:

- distribucion de nulos por columna;
- severidad de hallazgos;
- cardinalidad relativa;
- boxplots/IQR para columnas numericas;
- top values truncados y auditables.

## 10. Qué NO se debe hacer

- No implementar codigo productivo en L13A.
- No tocar contratos v2 en L13A.
- No tocar export contract en L13A.
- No agregar dependencias en L13A.
- No cambiar tests en L13A.
- No debilitar el motor determinista.
- No modificar scoring.
- No modificar `calibrationEvidence`.
- No convertir el script en requisito del PDF diagnostico.
- No hacer obligatoria la revision HITL si el usuario no eligio remediar con script.
- No permitir que el LLM altere el score.
- No presentar la comparacion de proveedores como conclusion absoluta.
- No declarar madurez general del producto sin protocolo de validacion.
- No prometer limpieza automatica fuera de controles humanos.
- No presentar el perfil como validacion formal emitida por el LLM.
- No abrir una nueva entrega academica desde este loop.

## 11. Riesgos

1. **Duplicidad de reportes**: `DiagnosisStep` ya tiene export PDF/JSON local; L13 debe decidir si esa salida se migra, se elimina o se convierte en accion secundaria.
2. **Export contract con bloque script canonico**: el JSON tecnico actual incluye `script`; hacer la remediacion opcional puede requerir adaptacion posterior del contrato.
3. **Stepper con rama opcional**: representar una rama sin confundir al usuario requiere UX explicita.
4. **Nombre "perfil"**: el usuario puede confundir perfil tecnico base con perfil definitivo si ambos quedan visibles con titulos parecidos.
5. **Fallo de proveedor LLM**: el nuevo reporte debe seguir siendo generable con evidencia determinista y limitacion visible.
6. **Graficos en PDF**: deben ser reproducibles, consistentes y no depender de screenshots ni imagenes externas.
7. **Sesion restaurada**: estados guardados con `script` o `review` pueden quedar ambiguos cuando aparezca `diagnostic_report`.
8. **E2E existentes**: varios harness llegan a `export` asumiendo el flujo viejo; el cambio debe actualizarse en L13G, no en L13A.

## 12. Criterios de aceptación

Para L13A:

- Documento de arquitectura creado en `docs/product/aura/phase_10/L13_DIAGNOSTIC_REPORT_PIPELINE_PLAN.md`.
- `docs/product/aura/NEXT_STEPS.md` actualizado con loops L13A-L13G.
- Sin cambios de codigo productivo.
- Sin cambios en contratos v2.
- Sin cambios en export contract.
- Sin cambios en dependencias.
- Sin cambios en tests.
- `cd src && npm run typecheck` sin errores.
- `cd src && npm run build` exitoso.
- Greps de claims revisados en `docs/product/aura/phase_10` y `docs/product/aura/NEXT_STEPS.md`.

Para los loops posteriores:

- El PDF diagnostico se puede generar sin script aprobado.
- El script es opcional.
- HITL es obligatorio solo para la rama de script/remediacion.
- La exportacion principal ofrece PDF diagnostico, JSON tecnico y CSV de hallazgos.
- El reporte separa evidencia determinista, interpretacion contextual, posibles falsos positivos, riesgos confirmados, recomendaciones y acciones opcionales.
- Los graficos estadisticos del PDF son reproducibles desde `AuditReport` / `columnStats`.
- El diagnostico LLM contextualiza, pero no modifica score.

## 13. Plan de loops siguientes

- **L13A Architecture**: cerrar esta decision de producto, flujo observado, flujo propuesto, riesgos y criterios.
- **L13B Report data model**: definir `DiagnosticReport` sin tocar contratos v2; mapear desde `AuditReport`, `auditEvidence`, `aiAnalysis` y `DiagnosisExecutionResult`.
- **L13C Pipeline state refactor**: agregar `diagnostic_report`, ajustar transiciones y stepper sin cambiar todavia PDF profesional.
- **L13D DiagnosticReportStep UI**: crear la pantalla de perfil definitivo con acciones primarias de exportacion y rama opcional de remediacion.
- **L13E Professional PDF generator**: crear/gobernar el generador del informe diagnostico con tablas y graficos reproducibles.
- **L13F Optional remediation branch**: mover script/review/health delta a rama explicita sin bloquear la salida principal.
- **L13G Titanic E2E**: validar el recorrido humano completo con fixture Titanic: cargar, perfilar, diagnosticar, generar reporte, exportar PDF/JSON/CSV y, opcionalmente, recorrer remediacion con HITL.

## 14. Siguiente loop recomendado

L13B debe ser el siguiente paso. Antes de tocar estado de pipeline o UI, hace falta definir el modelo interno de `DiagnosticReport` y su mapeo desde datos existentes. Ese modelo sera la frontera estable para UI, PDF y exportacion.
