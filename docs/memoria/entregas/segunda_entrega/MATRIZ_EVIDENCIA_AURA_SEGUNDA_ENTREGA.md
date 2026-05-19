# Matriz de evidencia AURA para segunda entrega

> Fecha de verificacion: 2026-05-19  
> Proposito: confirmar que el documento de segunda entrega solo prometa evidencia que AURA puede generar o que ya existe como resultado experimental preliminar.

## 1. Estado general de evidencia por objetivo

| Objetivo | Evidencia documental | Evidencia generada por codigo | Estado | Observacion |
|---|---|---|---|---|
| OE1. Arquitectura local-first | Diagrama de flujo, descripcion de arquitectura, trazas locales. | `csvService.ts`, `MainPipeline.tsx`, `executionEvidence.ts`, WebLLM/WebGPU en proveedores locales. | Implementado con evidencia exportable parcial. | El CSV se parsea en navegador y se genera fingerprint/traza. |
| OE2. Motor determinista | Catalogo de reglas, resultados de validacion, perfil del dataset. | `auditEngine.ts`, `ProfileStep.tsx`, `DeterministicEngineSummary.tsx`, `FindingsTable.tsx`, `RuleActivationMatrix.tsx`. | Implementado. | La interfaz de "Perfilar" ya muestra reglas, estadisticos, hallazgos y paquete estructurado. |
| OE3. Diagnostico y scripts LLM | Descripcion de paquete de entrada, diagnostico, script, validacion HITL. | `DiagnosisStep.tsx`, `ScriptGenerationStep.tsx`, `scriptValidationService.ts`, `ReviewStep.tsx`. | Implementado, depende de modelo disponible. | Requiere API key cloud o modelo local descargado para generar salida real. |
| OE4. Comparacion experimental | Tabla de benchmark, graficas, JSON experimental. | `BenchmarkLab.tsx`, `ExperimentDesigner.tsx`, `benchmarkService.ts`, `evaluationService.ts`, `hallucinationDetector.ts`. | Implementado como laboratorio. | Se conecto el resultado del laboratorio al export general para que la evidencia no quede aislada. |

## 2. Evidencia exportable desde AURA

| Artefacto | Donde se genera | Archivo esperado | Uso en el Word | Estado |
|---|---|---|---|---|
| Reporte PDF | Seccion final "Exportar" | descarga PDF del navegador | Anexo tecnico y captura de exportacion | Disponible tras completar flujo. |
| JSON de auditoria | Boton `JSON audit` en `App.tsx` | `aura_audit_*.json` | Evidencia principal para OE1, OE2, OE3 y OE4 | Disponible. Incluye perfil, evidencia de ejecucion, diagnostico, script y benchmark si existe. |
| CSV de issues | Boton `CSV issues` en `App.tsx` | `aura_issues_*.csv` | Tabla de hallazgos reproducibles para OE2 | Disponible. |
| Script aprobado | Boton `Script aprobado` en `App.tsx` | `aura_script_aprobado_*.py` | Evidencia para OE3 | Disponible despues de aprobacion humana. |
| Improvement run | `ImprovementRunPanel.tsx` | `aura_improvement_run_*.json` | Evidencia de simulacion de mejora y HITL | Disponible tras aprobar script y simular. |
| Benchmark JSON | `ExperimentDesigner.tsx` | `benchmark-results-*.json` | Evidencia para OE4 | Disponible en laboratorio experimental. |
| Log LLM | `AuditLogViewer.tsx` | `aura_llm_audit_log_*.json` | Evidencia complementaria de trazabilidad LLM | Disponible si se ejecuta diagnostico. |

## 3. Corroboracion del codigo actual

### OE1 - Arquitectura local-first

Evidencia en codigo:

- `src/services/csvService.ts`: parsea CSV con PapaParse desde el navegador y limita preview a 5.000 filas.
- `src/services/executionEvidence.ts`: calcula fingerprint, tiempos, trazas y evidencia tecnica.
- `src/components/MainPipeline.tsx`: ejecuta `csv.parse.start`, `csv.parse.end`, `audit.run.start`, `audit.run.end`.
- `src/services/providers/webllmProvider.ts`: permite inferencia local mediante WebLLM/WebGPU.

Como anexarlo:

- Captura del flujo de carga.
- JSON audit mostrando `auditEvidence`.
- Figura de arquitectura local-first.

### OE2 - Motor determinista

Evidencia en codigo:

- `src/services/auditEngine.ts`: contiene reglas explicitas, regex, heuristicas de tipo y estadistica descriptiva.
- `src/components/ProfileStep.tsx`: agrupa la etapa de perfilamiento.
- `src/components/DeterministicEngineSummary.tsx`: muestra familias del motor, reglas activadas, tiempo total y fingerprint.
- `src/components/ColumnStatsPanel.tsx`: presenta estadisticos por columna.
- `src/components/FindingsTable.tsx`: lista hallazgos reproducibles.
- `src/components/ProfileEvidencePackage.tsx`: muestra el paquete estructurado que sale de perfilamiento.

Metricas ya disponibles:

- `experiments/results/deterministic_validation.json`;
- `docs/tablas/resultados_motor_determinista.md`.

Resultado defendible:

| Indicador | Valor |
|---|---:|
| Precision | 37.93% |
| Recall | 84.62% |
| F1 | 52.38% |
| TP | 22 |
| FP | 36 |
| FN | 4 |

Advertencia editorial:

No usar "precision total". La lectura correcta es que el motor detecta muchas anomalias, pero produce falsos positivos; por eso se justifica OE3.

### OE3 - Diagnostico y generacion de scripts

Evidencia en codigo:

- `src/services/providers/prompts.ts`: construye el paquete estructurado y el prompt anclado.
- `src/components/DiagnosisStep.tsx`: ejecuta diagnostico con modelo local o cloud y registra trazas LLM.
- `src/components/ScriptGenerationStep.tsx`: genera script Python/Pandas desde la salida del modelo.
- `src/services/scriptValidationService.ts`: valida columnas, operaciones destructivas y cobertura de issues.
- `src/components/ReviewStep.tsx`: exige revision humana y simula remediacion.
- `src/services/improvementService.ts`: calcula delta de salud despues de simulacion.

Como anexarlo:

- Captura del diagnostico.
- Captura del script generado.
- Captura de validacion automatica.
- Captura de revision humana.
- JSON audit con `diagnosis`, `script` e `improvementRun`.

Advertencia editorial:

La etapa LLM debe explicarse como interpretacion asistida y generacion de scripts, no como evidencia factual independiente. La evidencia factual viene del motor determinista.

### OE4 - Comparacion experimental

Evidencia en codigo:

- `src/components/BenchmarkLab.tsx`: laboratorio experimental separado del flujo principal.
- `src/components/ExperimentDesigner.tsx`: configuracion de experimentos.
- `src/services/benchmarkService.ts`: ejecuta el benchmark por modelo, proveedor y modo de entrada.
- `src/services/benchmark/hallucinationDetector.ts`: detecta columnas fantasma, claims sin soporte, compliance JSON y columnas invalidas en scripts.
- `src/services/benchmark/evaluationService.ts`: calcula score compuesto y exporta JSON experimental.

Correccion aplicada:

- `BenchmarkLab.tsx` y `ExperimentDesigner.tsx` ahora exponen `onResultsChange`.
- `App.tsx` conserva resultados del laboratorio en `labBenchmarkResults`.
- El export `JSON audit` incluye `benchmarkResults` si existen resultados del laboratorio.

Como anexarlo:

- Captura del laboratorio experimental.
- `benchmark-results-*.json`.
- Tabla resumida con modelo, proveedor, entrada, latencia, JSON, alucinaciones, script y score.

Advertencia editorial:

`experiments/results/benchmark_multimodelo.json` registra fallos Gemini por API key. Debe citarse como intento fallido (`attempted_failed`), no como resultado experimental valido.

## 4. Evidencia pendiente antes de cerrar el Word

| Evidencia | Motivo | Accion |
|---|---|---|
| Capturas reales del flujo con dataset cargado | El documento necesita figuras del funcionamiento inicial. | Ejecutar AURA en navegador y capturar etapas: Perfilar, Diagnostico, Script, Revision, Exportar. |
| JSON audit real | Sirve como anexo trazable. | Completar flujo hasta exportacion y descargar `aura_audit_*.json`. |
| CSV issues real | Refuerza OE2. | Descargar `aura_issues_*.csv`. |
| Script aprobado real | Refuerza OE3. | Generar script, revisarlo, aprobarlo y exportarlo. |
| Benchmark JSON valido | Refuerza OE4. | Ejecutar al menos una configuracion local o cloud disponible y exportar JSON. |
| Tabla de resultados final | Debe incluir solo corridas validas. | Separar `preliminary_valid` de `attempted_failed`. |

## 5. Recomendacion de anexos

Anexar en el Word como figuras/tablas:

1. Figura: arquitectura AURA local-first.
2. Figura: flujo de interfaz AURA.
3. Figura: etapa Perfilar con score y reglas.
4. Tabla: familias de reglas deterministas.
5. Tabla: resultados preliminares del motor determinista.
6. Figura: paquete estructurado de hallazgos.
7. Figura: diagnostico con modelo local/cloud.
8. Figura: script generado y validacion.
9. Figura: revision humana y simulacion.
10. Figura/tabla: laboratorio experimental.
11. Anexo: JSON audit.
12. Anexo: CSV issues.
13. Anexo: script aprobado.
14. Anexo: benchmark JSON.

## 6. Riesgos a controlar en la redaccion

- No mezclar perfilamiento con diagnostico LLM.
- No presentar benchmark fallido como resultado.
- No afirmar precision total.
- No decir que todo es local si el usuario selecciona modo cloud.
- No llamar evidencia factual a texto generado por LLM.
- No poner el modulo comparativo dentro del motor determinista; pertenece a OE4.
