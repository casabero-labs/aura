# Matriz de evidencia y resultados para tercera entrega

> Proposito: controlar que cada objetivo tenga evidencia, metrica, limite y artefacto exportable.

## 1. Matriz objetivo-evidencia

| Objetivo | Pregunta de validacion | Evidencia existente | Resultado pendiente | Estado |
|---|---|---|---|---|
| OE1. Arquitectura local-first | AURA procesa y audita el CSV en navegador con trazabilidad? | `MainPipeline.tsx`, `csvService.ts`, `executionEvidence.ts`, pruebas de flujo UI. | Capturas y JSON audit real con fingerprint, tiempos y trazas. | Parcialmente valido |
| OE2. Motor determinista | Que detecta, donde falla y con que precision? | `auditEngine.ts`, `deterministic_validation.json`, tabla de resultados preliminares. | Metricado por regla, por dataset y con umbrales explicados. | Preliminar valido |
| OE3. Capa cognitiva y scripts | El LLM interpreta evidencia sin inventar y genera scripts trazables? | `prompts.ts`, `scriptValidationService.ts`, `DiagnosisStep.tsx`, `ScriptGenerationStep.tsx`. | Corridas reales con diagnostico, script, validacion, HITL y delta de salud. | Implementado, falta evidencia formal |
| OE4. Benchmark LLM | Que modelo y modo de entrada produce mejor resultado bajo el mismo contrato? | `benchmarkService.ts`, `hallucinationDetector.ts`, `evaluationService.ts`, `BenchmarkLab.tsx`. | Comparacion formal `smart_sample` vs `prompt_libre`, local/cloud, repeticion y export JSON. | Implementado, falta ejecucion formal |

## 2. Paquete minimo de resultados

| Resultado | Archivo esperado | Debe incluir | Uso academico |
|---|---|---|---|
| Validacion determinista por regla | `experiments/results/deterministic_validation_by_rule.json` | TP, FP, FN, precision, recall, F1 por regla y dataset | Metodologia y resultados OE2 |
| Tabla APA del motor | `docs/tablas/resultados_motor_determinista_por_regla.md` | Tabla limpia para memoria/articulo | Cap. resultados |
| Benchmark LLM formal | `experiments/results/benchmark_llm_formal.json` | modelo, proveedor, temperatura, input mode, latencia, alucinaciones, script, estado | OE4 y articulo |
| Tabla APA de benchmark | `docs/tablas/resultados_benchmark_llm_formal.md` | ranking y comparacion smart sample vs prompt libre | Estado del arte/resultados |
| Evidencia de flujo completo | `docs/evidence/results/aura_flow_evidence_tercera_entrega.json` | audit, diagnosis, script, validation, improvementRun | OE1-OE3 |
| Delta de salud | `docs/tablas/resultados_delta_salud.md` | score antes/despues, issues antes/despues, acciones bloqueadas | Impacto aplicado |
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
- Cumplimiento de formato.
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

No permitido aun:

- Decir que un modelo local iguala a Gemini sin resultados formales.
- Decir que AURA reduce data downtime con metrica real si no se mide en un entorno real.
- Decir que elimina alucinaciones.
- Decir que los resultados del benchmark fallido son evidencia.
