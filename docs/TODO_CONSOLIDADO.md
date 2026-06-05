# Mejoras para el motor determinista de aura

> Generado: 2026-05-27  
> Última actualización: 2026-06-05 — Mejoras #1 y #3 implementadas y verificadas (rama `feat/dataset-profiler`).

---

## 1. Perfilado antes de auditar

El motor actual aplica las 24 reglas ciegas. Un paso previo de profiling podría:

- Detectar columnas de alta cardinalidad y sugerir grouping automático
- Identificar columnas candidatas a coalescencia (ej: fecha + hora separados vs datetime combinado)
- Medir sparsity por columna para sugerir poda

**Estado:** ✅ Implementado en `src/services/columnProfiler.ts`. `runAudit` ahora expone un `DatasetProfile` con:
- `cardinality` (constant / low / medium / high / unique) por columna, basada en `uniqueRatio`
- `pruneRecommendation` (keep / review / drop) que marca `drop` para columnas constantes y `review` para sparsity > 60%
- `coalescencePairs` detectados por nombre (fecha+hora, start+end, created+updated) y por overlap de valores normalizados de fecha (>= 80%)
- `isCandidateForCoalescence` + `coalescencePartner` en cada `ColumnProfile`

Cubierto por `src/__tests__/columnProfiler.test.ts` (6 tests verticales).

---

## 2. Nueva regla: Consistencia categórica semántica

Que detecte valores como "Hombre"/"Masculino" o "Assault"/"Battery"/"Adw" y sugiera unificación. Currently no hay nada que agrupe variaciones semánticas — solo se valida formato.

**Estado:** Implementada como evidencia determinista `Consistencia Categórica Semántica`. La regla detecta vocabularios controlados conocidos y deja la consolidación como decisión de Capa 2/HITL.

---

## 3. Scoring compuesto de calidad

La metodología define 4 fases de limpieza. Podemos usarlo para generar un "Data Quality Score" más rico: no solo contar reglas fallidas sino ponderar por impacto (una columna redundante pesa diferente que un valor nulo).

**Estado:** ✅ Implementado en `auditEngine.ts`. Cada deducción ahora se pondera por:
- Severidad (CRITICAL 1.5x / WARNING 1.0x / INFO 0.5x)
- Categoría (Integridad y Lógica 1.2x / Tipos 1.0x / Higiene 0.8x / Semántica 0.7x)

`ScoreDeduction` ahora expone `severity`, `weight` y `ruleId` para trazabilidad. Calibrado para mantener el score de Titanic en `[60, 90]`. Documentado en `docs/tablas/catalogo_reglas_motor_determinista.md` (sección "Scoring Compuesto Ponderado"). Cubierto por `src/__tests__/compositeScoring.test.ts` (3 tests verticales).

**Pendiente menor (no bloqueante):** poblar `ruleId` explícito en cada call-site de `addDeduction` para trazabilidad fina por regla individual. Hoy el backfill devuelve `"unknown"` cuando el call-site no lo pasa.

---

## 4. Detección de columnas "quemadas"

La mejora 4.1 del documento UNIR habla de rangos de edad como "De 41 a 65 años" que imposibilitan segmentación dinámica. Podemos agregar una regla que detecte columnas categóricas de baja granularidad que limiten el análisis.

**Estado:** Implementada como `Rangos Demográficos Quemados`. También se agregó detección de cabeceras de encuesta largas/pregunta literal, cola larga categórica y duplicidad semántica de columnas a partir del PDF `GARI_BUSTOS_JOSEPH_actividad_1.pdf`.
