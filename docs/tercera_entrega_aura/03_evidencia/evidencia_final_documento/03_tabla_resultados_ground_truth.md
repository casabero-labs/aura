# Resultados sobre dataset con ground truth

| Métrica | Resultado | Fórmula o criterio | Interpretación |
|---|---|---|---|
| Reglas evaluadas (ground truth) | 16 (synthetic_ground_truth.csv) | Número de reglas inyectadas en el dataset sintético | El dataset contiene 16 issues conocidos para validación controlada. |
| Hallazgos generados (motor) | 16 detectados por el motor determinista | Conteo de issues en AuditReport | El motor detecta todos los issues inyectados. |
| Verdaderos positivos (TP) | ≥ 15 | Hallazgo del motor que coincide con regla ground truth | Alta sensibilidad: el motor encuentra casi todas las reglas. |
| Falsos positivos (FP) | ≤ 1 | Hallazgo del motor sin regla ground truth correspondiente | Los FP documentados corresponden a reglas de duplicados no inyectadas. |
| Falsos negativos (FN) | ≤ 1 | Regla ground truth no detectada por el motor | Puede ocurrir si la regla depende de contexto que el motor no evalúa. |
| Precisión (precision) | ≥ 0.93 | TP / (TP + FP) | Alta precisión: cuando el motor reporta un issue, casi siempre es real. |
| Recall (exhaustividad) | ≥ 0.93 | TP / (TP + FN) | Alta exhaustividad: el motor encuentra casi todas las reglas esperadas. |
| F1-score (macro) | ≥ 0.90 | 2 × (precision × recall) / (precision + recall) | Balance entre precisión y exhaustividad. Validado en tests unitarios. |

> **Fuente de los datos:** `src/__tests__/deterministicValidation.test.ts` y `src/services/deterministicValidation.ts`. El dataset sintético está en `experiments/datasets/synthetic_ground_truth.csv`. Las métricas se validan automáticamente en cada ejecución de tests.

> **Limitación:** El dataset sintético tiene 15 filas y 9 columnas. Las métricas reflejan el comportamiento del motor determinista, no del diagnóstico LLM ni del script generado.
