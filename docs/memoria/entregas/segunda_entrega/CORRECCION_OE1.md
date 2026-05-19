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

### 1. Heurística de tipos semántica mejorada
- **Antes:** Solo porcentaje básico (numérico >90% → 'number', fecha >80% → 'date', mixto si ambos >10% → 'mixed') + umbral estricto 70%
- **Ahora:** Detección por regex con umbral del 70% para: `email`, `phone`, `ip`, `url`, `currency`, `percentage`, `uuid`, `zip` + **bonus por nombre de columna** (`email` bonus +0.25 cuando columna contiene `mail`, `correo`, etc.) — permite detectar columnas semánticas aunque el regex matchea solo 35-70%
- Nueva constante `SEMANTIC_KEYWORDS` en `auditEngine.ts`
- Propiedad `semanticType` en `ColumnStats`

### 2. REGEX_EMAIL corregido
- **Antes:** `^[^\s@]+@[^\s@]+\.[^\s@]+$` — aceptaba "john@" y "C85@2"
- **Ahora:** `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` — requiere TLD de al menos 2 caracteres

### 3. IQR dual threshold (Tukey)
- **Antes:** Solo 3× IQR como WARNING para outliers extremos
- **Ahora:** Dos niveles:
  - **WARNING (3× IQR):** `lowerFence = q1 - 3*iqr`, `upperFence = q3 + 3*iqr` — outliers extremos
  - **INFO (1.5× IQR, Tukey):** `lowerFenceTukey = q1 - 1.5*iqr`, `upperFenceTukey = q3 + 1.5*iqr` — outliers leves
- Nuevos campos en `ColumnStats`: `outlierSeverity`, `outlierCountTukey`, `lowerFenceTukey`, `upperFenceTukey`
- Nueva regla `logic-outlier-tukey-*` con severidad INFO y deducción de 2 puntos

### 4. Test desagregado por regla (TP/FP/FN)
- Nuevo describe `Per-Rule TP/FP/FN on Titanic dataset` en `__tests__/auditEngine.test.ts`
- Ground truth para 23 reglas sobre Titanic: todas FP=0 (ningún falso positivo)
- Resultado: 23/23 reglas con FP=0, TP=1 donde corresponde (Age nulls, Cabin nulls, Tukey outliers en Fare)
- Función `scoreRule()` que calcula P/R/F1 por regla

### 5. IQR expuesto en estadísticas
- **Antes:** IQR solo usado internamente para la regla R15 (outliers), no visible al usuario
- **Ahora:** `q1`, `q3`, `iqr`, `lowerFence`, `upperFence`, `outlierCount` expuestos en `ColumnStats`
- Visualización BoxPlot con D3.js en el paso de diagnóstico

### 6. Documentación
- Este documento (`CORRECCION_OE1.md`) queda como referencia para la elaboración del Capítulo 5

---

## Impacto en el TFM

- **Capítulo 5:** Reemplazar "precisión total" por las métricas reales y explicar el trade-off recall/precision
- **Conclusiones:** Mapear OE1 → métricas reales, no valores aspiracionales
- **Trabajo futuro:** Las mejoras aplicadas (keywords, Tukey 1.5×, REGEX corregido, test per-rule) abordan directamente los FP residuales

---

**Archivos modificados:**
- `src/types.ts` — Nuevos tipos `SemanticType`, campos IQR Tukey en `ColumnStats` (`outlierSeverity`, `outlierCountTukey`, `lowerFenceTukey`, `upperFenceTukey`)
- `src/services/auditEngine.ts` — REGEX_EMAIL corregido, `detectSemanticType()` con keywords, IQR dual threshold (3× WARNING + 1.5× INFO Tukey), nueva regla `logic-outlier-tukey-*`
- `src/components/BoxPlot.tsx` — Componente D3
- `src/components/ColumnStatsPanel.tsx` — Componente de tabla
- `src/components/MainPipeline.tsx` — Integración de componentes
- `src/index.css` — Estilos nuevos
- `src/__tests__/auditEngine.test.ts` — Test desagregado por regla (TP/FP/FN)
- `docs/memoria/entregas/segunda_entrega/CORRECCION_OE1.md` — Este documento
