# Resumen consolidado de segunda entrega

> Proposito: dejar cerrada la segunda entrega en una sola lectura operativa y preparar el salto a tercera entrega.

## 1. Tesis defendida

AURA se presenta como una arquitectura local-first de auditoria inteligente de calidad del dato. La contribucion no consiste en reemplazar la auditoria por un LLM, sino en encadenar cuatro controles:

1. Procesamiento local del CSV y generacion de perfil del dataset.
2. Motor determinista reproducible basado en reglas, regex, heuristicas de tipos y estadistica descriptiva.
3. Capa cognitiva LLM que interpreta solo evidencia estructurada, no el dataset libremente.
4. Gobernanza HITL mediante validacion de scripts, simulacion y exportacion de evidencia.

Formulacion central:

> El motor determinista genera evidencia reproducible; el LLM interpreta esa evidencia bajo restricciones; el humano valida las acciones finales.

## 2. Objetivos especificos consolidados

| Objetivo | Formulacion vigente | Evidencia actual |
|---|---|---|
| OE1 | Arquitectura local-first para cargar, procesar y auditar datasets desde navegador. | `src/services/csvService.ts`, `src/components/MainPipeline.tsx`, `src/services/executionEvidence.ts`, `src/services/providers/webllmProvider.ts` |
| OE2 | Motor determinista reproducible para anomalias estructurales. | `src/services/auditEngine.ts`, `experiments/results/deterministic_validation.json`, `docs/tercera_entrega_aura/04_resultados/resultados_motor_determinista.md` |
| OE3 | Capa cognitiva LLM para diagnostico y generacion de scripts Pandas asistidos. | `src/services/providers/prompts.ts`, `src/components/DiagnosisStep.tsx`, `src/components/ScriptGenerationStep.tsx`, `src/services/scriptValidationService.ts` |
| OE4 | Modulo comparativo para evaluar modelos locales y cloud. | `src/services/benchmarkService.ts`, `src/components/BenchmarkLab.tsx`, `src/services/benchmark/hallucinationDetector.ts`, `src/services/benchmark/evaluationService.ts` |

## 3. Resultado empirico defendible

La validacion preliminar del motor determinista sobre `synthetic_ground_truth.csv` arroja:

| Metrica | Valor |
|---|---:|
| Precision | 37.93% |
| Recall | 84.62% |
| F1-score | 52.38% |
| True positives | 22 |
| False positives | 36 |
| False negatives | 4 |

Lectura academica correcta:

- El motor es reproducible y sensible, pero ruidoso.
- La baja precision no invalida AURA; justifica la capa cognitiva y la revision humana.
- No se debe afirmar "precision total" ni "EM = 1.00".

## 4. Limites reconocidos

- El benchmark multimodelo existe en software, pero requiere corridas formales exportables.
- El archivo `experiments/results/benchmark_multimodelo.json` no debe usarse como resultado valido si registra fallos por API key.
- La promesa local-first debe matizarse: el CSV crudo y el motor corren en navegador; si se usa proveedor cloud, se envia un smart sample, no el dataset completo.
- La salida del LLM no es evidencia factual independiente; es interpretacion sobre evidencia determinista.

## 5. Decision para tercera entrega

La tercera entrega debe responder directamente a la retroalimentacion del profesor:

1. Fortalecer estado del arte con comparacion critica y literatura indexada.
2. Formalizar diseno experimental: ground truth, etiquetado, umbrales, metricas y repeticion.
3. Generar benchmark multimodelo valido y exportable.
4. Discutir impacto aplicado: data downtime, eficiencia de auditoria, privacidad y gobernanza.
5. Vincular cada objetivo especifico con evidencia concreta y resultados.

La carpeta de tercera entrega es ahora la fuente operativa para avanzar.
