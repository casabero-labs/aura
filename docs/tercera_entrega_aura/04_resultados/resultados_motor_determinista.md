# Resultados Empíricos: Motor Determinista (Capa 1) — Baseline v1

> **Contexto para la Memoria (Capítulo 5):**
> Estos resultados corresponden a la **baseline v1** del motor determinista sobre Titanic,
> no a la evaluación sobre `synthetic_ground_truth.csv`.
> La baseline v1 registró un exceso de acciones inseguras (unsafe action rate = 84.85%)
> que justifica la introducción de Contracts v2 y la política de acción conservadora
> en `computeEffectiveActionability`.

## Configuración de la Baseline

| Propiedad | Valor |
|---|---|
| **Dataset** | Titanic (`titanic.csv`) |
| **Filas** | 891 |
| **Columnas** | 12 |
| **SHA-256** | `4a437fde05fe5264e1701a7387ac6fb75393772ba38bb2c9c566405af5af4bd7` |
| **Fecha de Ejecución** | Mayo 2026 |
| **Modo** | Baseline v1, sin Contracts v2 |

## Matriz de Confusión Global

| Métrica | Valor | Interpretación |
|---|---|---|
| **True Positives (TP)** | 5 | Acciones seguras válidas generadas por la baseline. |
| **False Positives (FP)** | 28 | Acciones inseguras o no autorizadas. |
| **False Negatives (FN)** | 0 | Ninguna acción válida omitida. |

**Unsafe actions: 28/33** (sobre 33 acciones totales generadas).

## Resultados de Precisión y Exhaustividad

| Indicador | Valor | Significado |
|---|---|---|
| **Precision** | 15.15% | Solo el 15% de las acciones generadas eran seguras; el 85% eran insegras. |
| **Recall** | 100% | Todas las acciones válidas fueron identificadas. |
| **F1-Score** | 26.32% | Media armónica. Refleja el alto volumen de acciones inseguras. |
| **Unsafe action rate** | 84.85% | 28 de 33 acciones no eran seguras según la política vigente. |

## Justificación de Contracts v2

El **84.85% de acciones inseguras** en la baseline v1 es la razón arquitectónica
principal para Contracts v2:

- Sin Contracts v2, el sistema carecía de la política de `computeEffectiveActionability` que degrada `auto_safe` → `review_only` según 8 reglas: nivel de acciónabilidad configurado, validación de autorización automática, coincidencia de tipo de acción con el registro, presencia del issue en el diagnóstico, columna ambigua/duplicada, y `requiresHumanReview` del diagnóstico.
- La validación fail-closed (`validateRemediationPlanV2`) rechaza cualquier plan que asigne
  `auto_safe` a una acción que debería ser `review_only`.
- Esta política es la causa de **cero auto_safe** en los datasets del harness de Phase 3:
  no es un defecto, sino el comportamiento esperado bajo la política corregida.

## Relación con synthetic_ground_truth.csv

El dataset `synthetic_ground_truth.csv` (15 filas, 9 columnas, 26 anomalías inyectadas,
9 tipos) fue construido **después** de la baseline v1 para validar la cobertura del motor
sobre verdad base conocida. Sus métricas de TP/FP/FN por regla se publican por separado
en `experiments/results/deterministic_validation_by_rule.json`.

No se deben mezclar los resultados de la baseline v1 (Titanic, acciones inseguras)
con los de la evaluación sobre el dataset sintético.

## Limitaciones

1. Estos resultados corresponden a la **baseline v1**, no a la versión actual del motor.
2. El alto FP se debe a que la baseline v1 no aplicaba la política de `requiresReview`
   ni la validación de `computeEffectiveActionability`.
3. Contracts v2 corrige este comportamiento; los resultados de Phase 3 muestran
   **0 unsafe upgrades** sobre los tres datasets con la política vigente.
