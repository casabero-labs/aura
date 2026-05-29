# Mejoras para el motor determinista de aura

> Generado: 2026-05-27

---

## 1. Perfilado antes de auditar

El motor actual aplica las 24 reglas ciegas. Un paso previo de profiling podría:

- Detectar columnas de alta cardinalidad y sugerir grouping automático
- Identificar columnas candidatas a coalescencia (ej: fecha + hora separados vs datetime combinado)
- Medir sparsity por columna para sugerir poda

---

## 2. Nueva regla: Consistencia categórica semántica

Que detecte valores como "Hombre"/"Masculino" o "Assault"/"Battery"/"Adw" y sugiera unificación. Currently no hay nada que agrupe variaciones semánticas — solo se valida formato.

---

## 3. Scoring compuesto de calidad

La metodología define 4 fases de limpieza. Podemos usarlo para generar un "Data Quality Score" más rico: no solo contar reglas fallidas sino ponderar por impacto (una columna redundante pesa diferente que un valor nulo).

---

## 4. Detección de columnas "quemadas"

La mejora 4.1 del documento UNIR habla de rangos de edad como "De 41 a 65 años" que imposibilitan segmentación dinámica. Podemos agregar una regla que detecte columnas categóricas de baja granularidad que limiten el análisis.