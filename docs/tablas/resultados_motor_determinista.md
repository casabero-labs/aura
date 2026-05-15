# Resultados Empíricos: Motor Determinista (Capa 1)

> **Contexto para la Memoria (Capítulo 5):** 
> En contraste con la hipótesis inicial que postulaba un motor determinista con precisión perfecta (EM=1.00), la validación empírica demuestra que las reglas duras generan un alto volumen de falsos positivos en contextos con ambigüedad semántica (ej. formatos de fecha) y tipos de datos ruidosos. Esto **justifica sólidamente** la necesidad metodológica de la Capa 2 (IA Cognitiva) para filtrar y contextualizar las anomalías.

## Configuración del Benchmark

*   **Dataset:** Dataset Sintético AURA (`synthetic_ground_truth.csv`)
*   **Filas:** 15
*   **Errores Inyectados (Ground Truth):** 26 (Distribuidos en 9 tipos de anomalías críticas)
*   **Fecha de Ejecución:** Mayo 2026

## Matriz de Confusión Global

| Métrica | Valor | Interpretación |
|---|---|---|
| **True Positives (TP)** | 22 | Errores reales detectados correctamente por el motor. |
| **False Positives (FP)** | 36 | "Ruido". El motor marcó anomalías donde no existían. |
| **False Negatives (FN)** | 4 | Errores reales que el motor fue incapaz de detectar. |

## Resultados de Precisión y Exhaustividad

| Indicador | Porcentaje | Significado Científico |
|---|---|---|
| **Precision** | 37.93% | De todo lo que AURA reportó como error, solo el ~38% era genuino. El resto era ruido estadístico. |
| **Recall** | 84.62% | El motor es muy estricto: encontró casi el 85% de los errores reales inyectados, pero falló en casos complejos. |
| **F1-Score** | 52.38% | Media armónica. Refleja un sistema robusto pero ruidoso. |

## Análisis de Fallos Específicos

1.  **Formatos de Fecha Mixtos (FN):** El motor no logró identificar la anomalía en la fecha `01/15/2023` (MM/DD/YYYY) inyectada en una columna que seguía el estándar `YYYY-MM-DD`. Esto demuestra la limitación de las aserciones regex simples.
2.  **Tipos Mixtos (FP):** El algoritmo de inferencia de tipos reportó 15 falsos positivos bajo la categoría "Dirty Object". Esto ocurre porque las reglas deterministas no entienden contexto; asumen que cualquier variación leve rompe el esquema.
3.  **Placeholders Tóxicos (FN):** De 3 placeholders (N/A, NULL, N/A), el motor solo capturó 1, demostrando la fragilidad de las listas negras estáticas frente a variaciones de encoding.

## Conclusión para el TFM

La Capa 1 (Motor Determinista) garantiza que la evaluación sea **reproducible y local**, eliminando la variabilidad estocástica de los tensores de red en la nube. Sin embargo, su **Precision del 37.93%** demuestra que carece de madurez semántica. 

La Capa 2 (Estabilidad Cognitiva vía LLM) no es un añadido estético, sino una **necesidad arquitectónica**: actúa como un filtro heurístico que toma los 58 reportes totales generados por la Capa 1 y razona sobre ellos para descartar los falsos positivos y proveer contexto humano al usuario final.
