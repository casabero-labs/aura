# Matriz de evidencia y resultados para tercera entrega

> Proposito: controlar que cada objetivo tenga evidencia, metrica, limite y artefacto exportable.

## 1. Matriz objetivo-evidencia

| Objetivo | Pregunta de validacion | Evidencia existente | Resultado pendiente | Estado |
|---|---|---|---|---|
| OE1. Arquitectura local-first | AURA procesa y audita el CSV en navegador con trazabilidad? | `MainPipeline.tsx`, `csvService.ts`, `executionEvidence.ts`, pruebas de flujo UI. | Capturas y JSON audit real con fingerprint, tiempos y trazas. | Parcialmente valido |
| OE2. Motor determinista | Que detecta, donde falla y con que precision? | `auditEngine.ts`, `deterministic_validation.json`, tabla de resultados preliminares. | Metricado por regla, por dataset y con umbrales explicados. | Preliminar valido |
| OE3. Capa cognitiva y scripts | El LLM interpreta evidencia sin inventar y genera scripts trazables? | `prompts.ts`, `scriptValidationService.ts`, `DiagnosisStep.tsx`, `ScriptGenerationStep.tsx`, `diagnosisValidatorV2.ts`, `remediationValidatorV2.ts`. | **Phase 3 — formalmente validado:** `aura.diagnosis.v2` y `aura.remediation.v2` con fixtures deterministas; 3/3 datasets PASS; planHashStable=true; unsafeUpgrades=0; invalidReferences=0. Falta: corridas LLM reales con benchmark formal. | **Formal sobre contrato; preliminar sobre inferencia** |
| OE4. Benchmark LLM | Que modelo y modo de entrada produce mejor resultado bajo el mismo contrato? | `benchmarkService.ts`, `hallucinationDetector.ts`, `evaluationService.ts`, `BenchmarkLab.tsx`. | Comparacion formal `smart_sample` vs `prompt_libre`, local/cloud, repeticion y export JSON. | Implementado, falta ejecucion formal |
| OE5. Gobernanza HITL | AURA exige revision humana antes de ejecutar acciones y permite approve/reject/reset? | `remediationApprovalV2.ts`, `RemediationPlanStepV2.tsx`, `ScriptGenerationStep.tsx`. | **Phase 3 — formalmente validado:** `approvalStatus` (pending/approved/rejected); `approveRemediationActionV2`, `rejectRemediationActionV2`, `resetRemediationActionV2` implementados y probados; plan pendiente visible en UI; exclusiones `not_actionable` excluidas de script. Falta: delta de salud real post-ejecucion. | **Formal sobre infraestructura; preliminar sobre impacto** |

## 2. Paquete minimo de resultados

| Resultado | Archivo esperado | Debe incluir | Uso academico |
|---|---|---|---|
| Validacion determinista por regla | `experiments/results/deterministic_validation_by_rule.json` | TP, FP, FN, precision, recall, F1 por regla y dataset | Metodologia y resultados OE2 |
| Tabla APA del motor | `docs/tercera_entrega_aura/04_resultados/resultados_motor_determinista_por_regla.md` | Tabla limpia para memoria/articulo | Cap. resultados |
| Benchmark LLM formal | `experiments/results/benchmark_llm_formal.json` | modelo, proveedor, temperatura, input mode, latencia, contrato, JSON real, alucinaciones, script, estado | OE4 y articulo |
| Tabla APA de benchmark | `docs/tercera_entrega_aura/04_resultados/resultados_benchmark_llm_formal.md` | ranking y comparacion smart sample vs prompt libre | Estado del arte/resultados |
| Evidencia de flujo completo | `docs/tercera_entrega_aura/03_evidencia/results/aura_flow_evidence_tercera_entrega.json` | audit, diagnosis, script, validation, improvementRun | OE1-OE3 |
| Comparativa AURA vs Gemini Nano (Incidentes Policiales) | `docs/tercera_entrega_aura/03_evidencia/results/incidentes_policiales_aura_vs_gemini.md` | Tabla comparativa, claims defendibles, limitaciones, comandos | OE2, OE3 |
| **Resumen de cierre loops 1–7** | `docs/tercera_entrega_aura/03_evidencia/results/RESUMEN_CIERRE_INCIDENTES_POLICIALES.md` | Problema, hallazgos Gemini/AURA, flujo Colab, delta real, clasificacion source_debt_preserved, claims, limitaciones, proxima decision | Todos los OE |
| **Protocolo validacion Colab real** | `docs/tercera_entrega_aura/05_desarrollo/PROTOCOLO_VALIDACION_COLAB_REAL.md` | Pasos para ejecutar notebook en Google Colab manualmente, verificacion de contenido, comparacion delta real vs local | OE4, OE5 |
| Notebook exportado verificado (nbformat 4.5) | `experiments/tests/results/incidentes_notebook_exportado.ipynb` | 8 celdas, script v2 con placeholder + aux columns, privacidad, checklist. Pendiente: ejecucion real en Colab. | OE4, OE5 |
| Notebook Colab exportable | `src/services/colabExporter.ts` → `.ipynb` | Notebook nbformat 4 con script aprobado, advertencia privacidad, instrucciones Colab | OE4, OE5 |
| Delta de salud | `docs/tercera_entrega_aura/04_resultados/resultados_delta_salud.md` | score antes/despues, issues antes/despues, acciones bloqueadas | Impacto aplicado |
| Paquete de articulo | `docs/publicacion/aura_resultados_articulo.md` | tablas, figuras, claims permitidos, limites | Publicacion |

## 3. Metricas oficiales

### Motor determinista

- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 = 2 * precision * recall / (precision + recall)
- Tasa de falso positivo por regla = FP / (TP + FP)
- Cobertura de reglas = reglas evaluadas / reglas implementadas

### Benchmark LLM

- Latencia total.
- First token latency.
- Tokens generados.
- Tokens por segundo.
- Cumplimiento de contrato (`contractCompliance`).
- JSON real (`hallucinationReport.jsonCompliance`) solo si parsea y cumple campos requeridos.
- Columnas alucinadas.
- Claims sin soporte.
- Validez del script.
- Cobertura de issues en script.
- Operaciones destructivas detectadas.
- Estado de evidencia.

### Impacto aplicado

- Delta de salud = score posterior - score inicial.
- Reduccion de issues criticos.
- Reduccion de issues totales.
- Acciones que requieren revision humana.
- Datos enviados a cloud: ninguno en modo local; smart sample en modo cloud.
- Tiempo estimado de auditoria manual evitada, reportado como proxy cualitativo si no hay medicion real.

## 4. Criterios de aceptacion

Un resultado puede entrar en la memoria como formal si cumple:

1. Tiene archivo exportado.
2. Tiene fecha, dataset, modelo/configuracion y version de codigo.
3. Distingue exito de fallo.
4. Puede reproducirse con comando documentado.
5. No depende de capturas aisladas.
6. Esta vinculado a un objetivo especifico.

Un resultado se queda como preliminar si:

- solo existe una corrida;
- depende de credenciales no documentadas;
- no tiene repeticion;
- no exporta JSON;
- no permite reconstruir configuracion.

## 5. Afirmaciones permitidas hoy

Permitido:

- AURA implementa un flujo local-first de carga, perfilamiento y auditoria determinista.
- El motor determinista es reproducible y sensible, pero genera falsos positivos.
- La evidencia preliminar del dataset sintetico reporta precision 37.93%, recall 84.62% y F1 52.38%.
- La capa LLM esta restringida mediante smart sample, copy-paste evidence, salida estructurada y validacion de script.
- El benchmark LLM esta implementado, pero necesita corridas formales para conclusiones comparativas.
- **AURA post-Loop 2 detecta contaminacion semantica de ID en Incidentes Policiales (CrimeId ← Disposition) que Gemini Nano no identifico.**
- **El caso Incidentes Policiales demuestra que un motor determinista con falsos positivos produce diagnosticos LLM que los replican; un motor corregido anade hallazgos que el LLM no generaria por si solo.**
- **La ejecucion Python real es viable mediante exportacion a Colab (bajo riesgo) o Pyodide en navegador (riesgo medio, requiere COOP/COEP). La decision tecnica esta documentada en `DECISION_EJECUCION_PYTHON_AURA.md`.**
- **AURA exporta un notebook .ipynb ejecutable en Google Colab con el script aprobado, advertencia de privacidad y checklist de re-auditoria.**
- **Se ejecutó Python externo sobre fixture controlado y el resultado fue re-auditado con el motor determinista oficial de AURA (runAudit vía tsx). La remediación preserva trazabilidad, pero el score oficial no mejora (score 65→26, delta −39). Deuda de CrimeId es de origen. Clasificado como `source_debt_preserved` en `incidentes_colab_delta_fixture.json`.**

No permitido aun:

- Decir que un modelo local iguala a Gemini sin resultados formales.
- Decir que AURA reduce data downtime con metrica real si no se mide en un entorno real.
- Decir que elimina alucinaciones.
- Decir que los resultados del benchmark fallido son evidencia.
- **Decir que AURA ejecuta Python en el navegador sin implementar Pyodide.**
- **Afirmar que el script aprobado fue ejecutado si solo se corrio la simulacion determinista en JS.**
