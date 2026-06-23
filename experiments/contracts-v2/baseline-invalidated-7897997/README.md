# Baseline INVALIDATED - Commit 7897997

## Motivo de Invalidación

Este baseline fue invalidado debido a múltiples errores metodológicos:

## Problemas Identificados

### 1. Fixture Incompleto
- El AuditReport fue generado manualmente en lugar de usar el motor productivo real
- Faltaban issues que el motor real sí detecta (ej: Espacios Fantasma en Name)
- No se usó `runAudit` real de `auditEngine.ts`

### 2. Validador Invertido (inverse logic)
- El validador consideraba columnas como "inválidas" si NO aparecían en el script
- Una columna es válida si existe en el dataset y el script simplemente no la menciona
- El validador inflaba artificialmente `invalidColumnReferences`

### 3. Detector de Columnas Fantasma Incorrecto
- Extraía TODAS las palabras del diagnóstico como posibles columnas
- No distinguía entre identificadores de Python, funciones, strings de documentación y referencias reales a columnas
- Resultado: phantomColumns = 145-201 cuando debería ser 0-1

### 4. Detector de Reglas Inventadas Incorrecto
- Trataba todos los strings entre comillas como "reglas inventadas"
- No usaba los campos estructurados del AuditReport
- Resultado: inventedRules = 5-18 cuando debería ser 0-2

### 5. Review Retention Binario
- acreditaba TODOS los issues por encontrar una sola palabra "HITL" o "review"
- No evaluaba issue por issue
- No verificaba si cada REVIEW_ONLY estaba correctamente retenido

### 6. Suite con Test Fallido
- Test para Ticket.inferredType falló porque se esperaba 'string' pero era 'mixed'
- El test debería verificar que NO es 'number', no que ES 'string'

## Métricas Invalidées

```
automaticActionPrecision: 0% (inválido - detector mal)
unsafeAutomationRate: 80% (inflado artificialmente)
reviewRetentionRecall: 20% (binario, no por issue)
exactCitationRate: 0% (no evaluaba todas las muestras)
phantomColumnRate: 100% (145-201 columnas inventadas - absurdo)
destructiveOperationRate: 100% (real pero sobrevalorado)
```

## Evidencia Preservada

Esta carpeta contiene la evidencia cruda original antes de la corrección:

- `runs/` - Las 5 corridas crudas
- `prompts/` - Los prompts usados
- `baseline-summary.json` - Métricas originales
- `baseline-summary.md` - Reporte en markdown
- `protocol.json` - Protocolo original

## Nueva Ejecución

Ver: `../baseline/` para el baseline corregido con:

1. AuditReport generado por motor productivo real
2. Validador corregido (lógica inversa fija)
3. Detector de fantasmas mejorado (solo referencias inequívocas)
4. Detector de reglas inventadas mejorado (patrones estructurados)
5. Review retention por issue
6. Tests corregidos
7. Seeds fijos para reproducibilidad
8. Tokens reales de Ollama

## Commit Original

`7897997 test: establish LLM contracts baseline harness`
