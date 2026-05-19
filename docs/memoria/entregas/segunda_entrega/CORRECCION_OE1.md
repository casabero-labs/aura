# Corrección OE1 — Motor Determinista

**Fecha:** 19 mayo 2026  
**Contexto:** Segunda entrega TFM AURA  
**Incide en:** Capítulo 5 (Desarrollo), sección "Objetivo Específico 1"

---

## Redacción original (a corregir)

> Diseñar un motor de auditoría determinista basado en TypeScript (auditEngine.ts), usando expresiones regulares, heurística de tipos y estadística descriptiva (IQR) para detectar anomalías estructurales **con precisión total**.

## Problema detectado

La frase "precisión total" no se sostiene con evidencia experimental.

### Métricas reales del motor determinista (validación preliminar con ground truth sintético)

| Métrica | Valor |
|---|---|
| **Precision** (verdaderos positivos / total detectados) | 37.93% |
| **Recall** (verdaderos positivos / total reales) | 84.62% |
| **F1 Score** | 52.38% |

**Interpretación:** El motor es *sensible* (alto recall — detecta la mayoría de anomalías reales) pero *poco preciso* (genera falsos positivos — marca issues donde no los hay). Esto es aceptable para una herramienta de diagnóstico determinista: es preferible reportar de más que dejar pasar anomalías reales.

## Redacción corregida (propuesta)

> Diseñar un motor de auditoría determinista basado en TypeScript (auditEngine.ts), usando expresiones regulares, heurística de tipos y estadística descriptiva (IQR) para detectar anomalías estructurales **con alta sensibilidad (Recall 84.6%) y precisión moderada (Precision 37.9%, F1 52.4%)** en su configuración por defecto. El motor prioriza recall sobre precisión para minimizar falsos negativos, compensando la tasa de falsos positivos mediante revisión humana (HITL) en pasos posteriores del pipeline.

## Mejoras implementadas (19 mayo 2026)

### 1. Heurística de tipos semántica
- **Antes:** Solo porcentaje básico (numérico >90% → 'number', fecha >80% → 'date', mixto si ambos >10% → 'mixed')
- **Ahora:** Detección por regex con umbral del 70% para: `email`, `phone`, `ip`, `url`, `currency`, `percentage`, `uuid`, `zip`
- Propiedad `semanticType` en `ColumnStats`

### 2. IQR expuesto en estadísticas
- **Antes:** IQR solo usado internamente para la regla R15 (outliers), no visible al usuario
- **Ahora:** `q1`, `q3`, `iqr`, `lowerFence`, `upperFence`, `outlierCount` expuestos en `ColumnStats`
- Visualización BoxPlot con D3.js en el paso de diagnóstico

### 3. Visualización de hallazgos con D3
- **BoxPlot:** Distribución IQR por columna numérica con bigotes, caja Q1-Q3, mediana y conteo de outliers
- **ColumnStatsPanel:** Tabla mejorada con tipo semántico, IQR, outliers, indicadores visuales

### 4. Documentación
- Este documento (`CORRECCION_OE1.md`) queda como referencia para la elaboración del Capítulo 5

---

## Impacto en el TFM

- **Capítulo 5:** Reemplazar "precisión total" por las métricas reales y explicar el trade-off recall/precision
- **Conclusiones:** Mapear OE1 → métricas reales, no valores aspiracionales
- **Trabajo futuro:** Afinar umbrales de reglas para mejorar precisión sin sacrificar recall

---

**Archivos modificados:**
- `src/types.ts` — Nuevos tipos `SemanticType`, campos IQR en `ColumnStats`
- `src/services/auditEngine.ts` — Detección semántica, IQR expuesto
- `src/components/BoxPlot.tsx` — Nuevo componente D3
- `src/components/ColumnStatsPanel.tsx` — Nuevo componente de tabla
- `src/components/MainPipeline.tsx` — Integración de componentes
- `src/index.css` — Estilos nuevos
