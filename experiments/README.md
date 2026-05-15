# Validación Experimental — AURA

Este directorio contiene los artefactos de la validación experimental del TFM.

## Estructura

```
experiments/
├── datasets/       # Datasets de prueba (Kaggle, UCI, sintéticos)
├── benchmarks/     # Scripts de benchmark multi-modelo (OE2)
└── results/        # Resultados de evaluación (JSON, CSV, gráficos)
```

## Datasets Planificados

| Dataset | Fuente | Propósito |
|---|---|---|
| Titanic | Kaggle | Tipos mixtos, nulos, categorías |
| Adult Income | UCI | PII, tipos mixtos, capitalización |
| Melbourne Housing | Kaggle | Outliers IQR, negativos, nulos masivos |
| Dirty Restaurant | Kaggle | Mojibake, duplicados, texto sucio |
| Dataset Sintético AURA | Propio | Ground truth 100% controlado |

## Métricas de Evaluación

| Métrica | Aplica a |
|---|---|
| Precisión (EM) | Motor determinista |
| Recall | Motor determinista |
| Latencia (ms) | Benchmark LLM |
| Tasa de alucinación | Benchmark LLM |
| Coherencia semántica | Evaluación cualitativa |
