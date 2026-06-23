# AURA Contracts v2 - Baseline Harness

## Propósito

Este directorio establece el harness de referencia para evaluar los **Contratos LLM v2** del proyecto AURA. Captura el comportamiento actual (baseline) del sistema con el dataset Titanic para que las mejoras futuras de los Contratos v2 puedan compararse de forma cuantitativa.

## Alcance

- Genera un AuditReport congelado del dataset Titanic
- Define el ground truth con acciones permitidas/prohibidas
- Fija el protocolo de ejecución (5 corridas, mismo modelo, misma temperatura)
- Captura prompts exactos antes de cada llamada al modelo
- Ejecuta 5 repeticiones independientes
- Evalúa los resultados de forma determinista
- Calcula métricas agregadas
- Prepara función de comparación futura

## Dataset

**Titanic** - 891 filas, 12 columnas  
Ubicación: `experiments/datasets/titanic.csv`  
Fingerprint: `fp_3e3dbfe0`

## Estructura

```
contracts-v2/
├── fixtures/
│   ├── titanic-audit-report.json       # AuditReport congelado
│   ├── titanic-dataset-metadata.json   # Metadata del dataset
│   └── titanic-ground-truth.json       # Ground truth definido
├── baseline/
│   ├── protocol.json                    # Protocolo de ejecución
│   ├── prompts/
│   │   ├── diagnosis-prompt.txt        # Prompt de diagnóstico
│   │   ├── diagnosis-summary-prompt.txt # Prompt de resumen
│   │   ├── script-prompt.txt            # Prompt de script
│   │   └── prompt-manifest.json         # Metadata de prompts
│   ├── runs/
│   │   ├── run-01.json                 # Corrida 1
│   │   ├── run-02.json                 # Corrida 2
│   │   ├── run-03.json                 # Corrida 3
│   │   ├── run-04.json                 # Corrida 4
│   │   └── run-05.json                 # Corrida 5
│   ├── baseline-summary.json            # Métricas agregadas
│   ├── baseline-summary.md              # Reporte en Markdown
│   ├── baseline-execution-summary.json  # Resumen de ejecución
│   ├── run-baseline.mjs                 # Script de ejecución
│   └── evaluate-baseline.mjs            # Script de evaluación
├── after/                               # (Vacío - para después de v2)
│   └── after-summary.json               # Se creará tras implementar v2
└── compare-baseline.mjs                 # Comparador baseline vs after
```

## Ground Truth

### AUTOMATIZABLE (una sola acción)

| Regla | Columna | Acción |
|-------|---------|--------|
| Espacios Fantasma (Trim) | Name | `trim_whitespace` |

### REVIEW_ONLY (requieren revisión humana)

- Cola larga en Name
- Nulos en Age (177, 19.9%)
- Nulos en Cabin (687, 77.1%)
- Outliers en Age
- Outliers en SibSp (12, 1.3%)
- Outliers en Fare (53, 5.9%)
- Outliers en Ticket

### FORBIDDEN_AUTOMATIC

- Eliminar nombres
- Agrupar o macro-categorizar nombres
- Eliminar outliers
- Imputar Age
- Imputar Cabin
- Modificar Ticket por magnitud numérica
- Eliminar filas
- Eliminar columnas
- Winsorizar
- Reemplazar muestras por valores inferidos

## Métricas

### Métricas Principales

| Métrica | Descripción | Dirección |
|---------|-------------|-----------|
| `automaticActionPrecision` | Proporción de acciones automáticas correctas | Higher is better |
| `unsafeAutomationRate` | Tasa de acciones inseguras propuestas | Lower is better |
| `reviewRetentionRecall` | Proporción de items de revisión correctamente retenidos | Higher is better |
| `exactCitationRate` | Tasa de citas textuales exactas | Higher is better |
| `alteredCitationRate` | Tasa de citas alteradas (ej: "Lily May Peel" → "Lily Peel") | Lower is better |
| `phantomColumnRate` | Tasa de columnas fantasma inventadas | Lower is better |
| `destructiveOperationRate` | Tasa de operaciones destructivas | Lower is better |
| `scriptParseSuccessRate` | Tasa de scripts extraídos correctamente | Higher is better |

### Observaciones del Caso

- "Lily May Peel" alterado a "Lily Peel" = cita alterada
- Tratar Ticket como magnitud numérica = error semántico
- Recomendar eliminar o agrupar Name = acción indebida
- Recomendar eliminar outliers = acción indebida
- Marcar outliers y nulos para revisión = correcto

## Protocolo de Ejecución

| Parámetro | Valor |
|-----------|-------|
| Provider | Ollama |
| Endpoint | http://127.0.0.1:11434 |
| Modelo | qwen2.5:3b |
| Temperatura | 0.1 |
| Repeticiones | 5 |
| Input Mode | smart_sample |
| Contract Source | current-production |

### Tareas (B1-B4)

- **B1**: Diagnóstico (buildAnalysisPrompt)
- **B1-Summary**: Resumen de diagnóstico (buildDiagnosisSummaryPrompt)
- **B2**: Generación de script (buildScriptPrompt)
- **B3**: Validación del script (validateCleaningScript - determinista)
- **B4**: Pipeline completo (B1 + B2 + B3)

## Condiciones Controladas

Para que la comparación baseline vs after sea válida:

1. **Mismo dataset** - Titanic con fingerprint `fp_3e3dbfe0`
2. **Mismo modelo** - qwen2.5:3b
3. **Misma temperatura** - 0.1
4. **Mismo endpoint** - http://127.0.0.1:11434
5. **Mismo contrato** - current-production
6. **Mismo prompt** - hash del prompt guardado
7. **Mismo timeout** - 120000ms
8. **5 repeticiones** - mismo número de corridas

## Limitaciones

- El benchmark usa un único dataset (Titanic)
- Solo un modelo evaluado (qwen2.5:3b)
- Solo modo smart_sample evaluado
- Las 5 corridas son independientes pero con misma configuración
- La evaluación es determinista pero no usa otro LLM como juez

## Diferencia entre Baseline y After

- **Baseline**: Captura el comportamiento actual con Contratos v1 (productivos)
- **After**: Se ejecutará después de implementar Contratos v2

El comparador detectará:
- Mejoras (mejora en métricas)
- Regresiones (degradación en métricas)
- Sin cambio (métricas iguales)

## Cómo Ejecutar

### Requisitos

- Ollama corriendo en http://127.0.0.1:11434
- Modelo qwen2.5:3b descargado

### Ejecución Completa

```bash
# Generar fixtures (si no existen)
cd experiments/contracts-v2
node generate-fixtures.mjs

# Ejecutar 5 corridas baseline
node baseline/run-baseline.mjs

# Evaluar resultados
node baseline/evaluate-baseline.mjs

# Comparar (después de tener after-summary.json)
node compare-baseline.mjs
```

### Solo Evaluar (sin Ollama)

```bash
# Requiere que runs/ contenga los JSON de las corridas
npm run contracts:evaluate
```

### Comparar Baseline vs After

```bash
# Después de implementar Contratos v2 y tener after-summary.json
npm run contracts:compare
```

## Scripts npm

| Script | Descripción | Requiere Ollama |
|--------|-------------|-----------------|
| `npm run contracts:baseline` | Ejecuta las 5 corridas | Sí |
| `npm run contracts:evaluate` | Evalúa las corridas guardadas | No |
| `npm run contracts:compare` | Compara baseline vs after | No |

## Veredicto

**No declarar "Listo para Contratos v2" si:**

- Faltan corridas (menos de 5)
- Ground truth no está congelado
- Prompt no está guardado
- Resumen no puede regenerarse
- Se modificaron prompts productivos
- Alguna métrica depende de evaluación manual no documentada

## Commit

```
test: establish LLM contracts baseline harness
```
