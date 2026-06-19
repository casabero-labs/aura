# Catálogo de Reglas del Motor Determinista — auditEngine.ts

> Documentación para **Capítulo 5.3 — Capa 1: Motor Determinista** de la memoria TFM.
> 
> Cada regla se ejecuta de forma determinista (sin componente estocástico).
> El score parte de 100 y se deducen puntos por cada anomalía detectada.
> Score final = max(0, 100 - Σ penalizaciones).

---

## Resumen del Motor

| Parámetro | Valor |
|---|---|
| Archivo fuente | `src/services/auditEngine.ts` |
| Líneas de código | Ver `src/services/auditEngine.ts` |
| Total de reglas | 28+ |
| Categorías | 5 (Integridad, Higiene, Tipos, Lógica, Semántica) |
| Propiedad principal | Reproducibilidad determinista |
| Métricas empíricas | Ver `docs/tercera_entrega_aura/04_resultados/resultados_motor_determinista.md` |
| Dependencias externas | Ninguna (TypeScript puro) |
| Límite de filas | 5.000 (PapaParse preview) |
| Perfilado de columnas | `src/services/columnProfiler.ts` (Mejora #1) |
| Scoring compuesto | Tabla de pesos severidad × categoría (Mejora #3) |

---

## Categoría 1: Integridad y Estructura

### R01 — Filas Duplicadas
| Campo | Detalle |
|---|---|
| **ID** | `integrity-dupes` |
| **Severidad** | CRITICAL |
| **Algoritmo** | Hash de 32 bits (DJB2 variant) sobre `JSON.stringify(row)` |
| **Penalización** | `min(15, ceil(% duplicados))` pts |
| **Umbral** | Cualquier duplicado (>0) |
| **Justificación ISO 25012** | Dimensión de *Consistencia* — filas idénticas indican problemas de ingesta o ETL |

### R02 — Valores Nulos / Vacíos
| Campo | Detalle |
|---|---|
| **ID** | `integrity-null-{col}` |
| **Severidad** | WARNING (5-20%) / CRITICAL (>20%) |
| **Algoritmo** | Conteo de `null`, `undefined`, `""` por columna |
| **Penalización** | 2 pts (warning) / 10 pts (critical) |
| **Umbral** | >5% de valores nulos en la columna |
| **Justificación ISO 25012** | Dimensión de *Completitud* |

### R03 — Columna Constante (Entropía Cero)
| Campo | Detalle |
|---|---|
| **ID** | `integrity-constant-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | `uniqueCount === 1` cuando `rowCount > 10` |
| **Penalización** | 5 pts |
| **Umbral** | Exactamente 1 valor único |
| **Justificación ISO 25012** | Dimensión de *Actualidad* — columna sin capacidad informativa |

### R04 — Tipos Mixtos (Dirty Object)
| Campo | Detalle |
|---|---|
| **ID** | `integrity-mixed-{col}` |
| **Severidad** | CRITICAL |
| **Algoritmo** | Inferencia de tipo: si coexisten `number` y `string` → `mixed` |
| **Penalización** | 10 pts |
| **Umbral** | Presencia simultánea de tipos numéricos y textuales |
| **Justificación ISO 25012** | Dimensión de *Consistencia* — ruptura de esquema |

---

## Categoría 2: Higiene de Texto

### R05 — Espacios Fantasma (Ghost Spaces / Trim)
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-ghost-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | `val.trim().length !== val.length` |
| **Penalización** | 3 pts |
| **Justificación** | Espacios invisibles causan fallos en JOINs y agrupaciones |

### R06 — Mojibake / Encoding Roto
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-moji-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | RegExp: `/[Ã±Ã¡Ã©ÃíÃ³ÃºÃ¼Â©Â®â€"â€"]/` |
| **Penalización** | 8 pts |
| **Justificación** | Corrupción de encoding UTF-8 indica problemas de pipeline |

### R07 — Caos de Capitalización
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-case-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | Agrupa valores textuales por clave normalizada: trim, colapso de espacios, remocion de acentos y minusculas. Dispara si una clave tiene dos o mas variantes canonicas que difieren solo por capitalizacion, por ejemplo `bogota: Bogota \| BOGOTA \| bogota`. |
| **Penalización** | 3 pts |
| **Conteo** | Filas afectadas dentro de grupos con variantes de capitalizacion. |
| **Porcentaje afectado** | `count / rowCount * 100`; nunca debe quedar en 0 si `count > 0`. |
| **Exclusiones** | Columnas date/datetime/time, identificadores, email, telefono, URL, UUID, ZIP/codigo postal y equivalentes como `CallDateTime`. |
| **No activacion** | No dispara cuando la diferencia es solo por espacios iniciales/finales o espacios internos equivalentes. |

### R08 — Placeholders Tóxicos
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-toxic-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | Comparación contra lista: `['nan', 'null', 'n/a', '?', 'undefined', 'none', 'nil', 'sin dato', 'no data', '999', 'unknown', '..']` |
| **Penalización** | 5 pts |
| **Justificación** | Nulos disfrazados que evaden validaciones estándar |

### R09 — Desbordamiento de Texto
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-over-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | `val.length > 300` (excluye columnas de descripción/texto/observaciones) |
| **Penalización** | Info only (no deduce puntos) |

### R20 — Espacios Múltiples
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-space-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | RegExp: `/\s\s+/` |
| **Penalización** | 2 pts |

### R22 — Símbolos Sospechosos en ID/Nombres
| Campo | Detalle |
|---|---|
| **ID** | `hygiene-symbol-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | RegExp: `/[!@#$%^&*()_+={}[\]|\\;:'",.<>?/]/` en columnas detectadas como ID o Name |
| **Penalización** | 5 pts |

---

## Categoría 3: Tipos de Datos e Inferencia

### R10 — Números Disfrazados
| Campo | Detalle |
|---|---|
| **ID** | `type-disguised-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | Columna tipo `string` donde >95% de valores pasan `!isNaN(Number(val))` (excluye columnas de teléfono e ID) |
| **Penalización** | 2 pts |

### R11 — Fechas Ocultas
| Campo | Detalle |
|---|---|
| **ID** | `type-date-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | RegExp ISO (`/^\d{4}-\d{2}-\d{2}/`) y DMY (`/^\d{2}[/-]\d{2}[/-]\d{4}/`) en >95% de valores |
| **Penalización** | Info only |

### R12 — IDs Corruptos (Float)
| Campo | Detalle |
|---|---|
| **ID** | `type-corrupt-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | Columna detectada como ID con valores terminados en `.0` |
| **Penalización** | 5 pts |
| **Justificación** | Conversión Excel/Pandas de int→float silenciosa |

### R13 — Hora Redundante
| Campo | Detalle |
|---|---|
| **ID** | `type-time-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | >90% de valores terminan en ` 00:00:00` o `T00:00:00` |
| **Penalización** | Info only |

---

## Categoría 4: Validez y Lógica de Negocio

### R14 — Negativos Imposibles
| Campo | Detalle |
|---|---|
| **ID** | `logic-neg-{col}` |
| **Severidad** | CRITICAL |
| **Algoritmo** | `val < 0` en columnas donde negativo es ilógico (excluye columnas con keywords: diff, delta, temp, lat, lon, balance, profit, net, score) |
| **Penalización** | 10 pts |

### R15 — Outliers Extremos (IQR)
| Campo | Detalle |
|---|---|
| **ID** | `logic-outlier-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | Método IQR con factor 3× (outlier extremo): `val < Q1 - 3×IQR` o `val > Q3 + 3×IQR` |
| **Penalización** | 5 pts |
| **Umbral** | Solo aplica si `numericValues.length > 10` y `IQR > 0` |

### R16 — Incoherencia Temporal (Cross-Column)
| Campo | Detalle |
|---|---|
| **ID** | `logic-temporal-{start}-{end}` |
| **Severidad** | CRITICAL |
| **Algoritmo** | Detecta pares de columnas de fecha (start/end) por keywords y verifica `end >= start` |
| **Penalización** | 10 pts |
| **Keywords start** | start, inicio, begin, open, alta |
| **Keywords end** | end, fin, finish, close, baja |

### R17 — Formato Email Inválido
| Campo | Detalle |
|---|---|
| **ID** | `logic-email-{col}` |
| **Severidad** | CRITICAL |
| **Algoritmo** | RegExp: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` en columnas con "mail" o "correo" en el nombre |
| **Penalización** | 10 pts |

### R18 — Longitud de Teléfonos Variable
| Campo | Detalle |
|---|---|
| **ID** | `logic-phone-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | Calcula moda de longitud de dígitos; si >10% difieren de la moda → alarma |
| **Penalización** | 5 pts |
| **Umbral** | Solo aplica si `phoneLengths.length > 10` |

### R21 — URLs con Formato Erróneo
| Campo | Detalle |
|---|---|
| **ID** | `logic-url-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | RegExp URL estándar en columnas detectadas como URL o valores que inician con `http` |
| **Penalización** | 5 pts |

---

## Categoría 5: Semántica y Seguridad

### R19 — Datos Sensibles (PII)
| Campo | Detalle |
|---|---|
| **ID** | `sec-pii-{col}` |
| **Severidad** | CRITICAL |
| **Algoritmo** | RegExp para IPs (`/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/`) y tarjetas de crédito (Visa, MC, Amex, Discover) |
| **Penalización** | **20 pts** (la más alta del sistema) |
| **Justificación** | Exposición de PII es un riesgo regulatorio (GDPR/LOPDGDD) y ético |

### R23 — Redundancia Temporal Derivable
| Campo | Detalle |
|---|---|
| **ID** | `semantic-temporal-redundancy-{datetime}-{time}` |
| **Severidad** | INFO |
| **Algoritmo** | Detecta columnas tipo `datetime/timestamp/fecha_hora` y columnas tipo `time/hora`; extrae la hora del datetime y la compara contra la columna de hora |
| **Penalización** | 0 pts (evidencia para revisión) |
| **Umbral** | Coincidencia >=95% en más de 10 filas comparables |
| **Justificación** | Identifica posible redundancia derivable sin eliminar automáticamente la columna; requiere interpretación de dominio por Capa 2 y validación HITL |

### R24 — Cabecera como Pregunta / Metadato Verbal
| Campo | Detalle |
|---|---|
| **ID** | `semantic-header-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | Detecta nombres de columna con signos de pregunta, longitud >60 caracteres o más de 8 palabras |
| **Penalización** | 2 pts |
| **Justificación** | Evita acoplar preguntas de encuesta o etiquetas narrativas al esquema físico; recomienda identificador técnico + diccionario de datos |

### R25 — Consistencia Categórica Semántica
| Campo | Detalle |
|---|---|
| **ID** | `semantic-category-variants-{col}-{grupo}` |
| **Severidad** | WARNING |
| **Algoritmo** | Normaliza texto y compara contra vocabularios controlados conocidos, por ejemplo `Hombre/Masculino`, `Mujer/Femenino`, `Assault/Battery/Adw` |
| **Penalización** | 4 pts |
| **Justificación** | Detecta fragmentación de categorías que falsea agregaciones; la unificación queda sujeta a interpretación de dominio |

### R26 — Cola Larga Categórica
| Campo | Detalle |
|---|---|
| **ID** | `semantic-long-tail-{col}` |
| **Severidad** | INFO |
| **Algoritmo** | En dimensiones textuales, detecta alta cardinalidad, ratio de únicos >=35% y baja cobertura de los cinco valores principales |
| **Penalización** | 0 pts |
| **Justificación** | Señala variables que pueden requerir macro-categorías antes del análisis estadístico |

### R27 — Rangos Demográficos Quemados
| Campo | Detalle |
|---|---|
| **ID** | `semantic-burned-range-{col}` |
| **Severidad** | WARNING |
| **Algoritmo** | RegExp sobre rangos textuales como `De 41 a 65 años`, `Menos de 18`, `18-30` o `65+` cuando dominan la columna |
| **Penalización** | 4 pts |
| **Justificación** | Detecta pérdida de granularidad que impide medias, desviaciones y segmentaciones posteriores |

### R28 — Duplicidad Semántica de Columnas
| Campo | Detalle |
|---|---|
| **ID** | `semantic-duplicate-columns-{left}-{right}` |
| **Severidad** | INFO |
| **Algoritmo** | Normaliza valores textuales y compara pares de columnas; reporta coincidencia >=95% en más de 10 filas comparables |
| **Penalización** | 0 pts |
| **Justificación** | Aporta evidencia para poda o coalescencia sin eliminar automáticamente atributos que podrían tener sentido de negocio |

---

## Tabla Resumen de Penalizaciones

| Regla | Categoría | Max Penalización | Severidad |
|---|---|---|---|
| R01 Duplicados | Integridad | 15 pts | CRITICAL |
| R02 Nulos | Integridad | 10 pts | CRITICAL |
| R03 Constante | Integridad | 5 pts | WARNING |
| R04 Tipos Mixtos | Integridad | 10 pts | CRITICAL |
| R05 Ghost Spaces | Higiene | 3 pts | INFO |
| R06 Mojibake | Higiene | 8 pts | WARNING |
| R07 Capitalización | Higiene | 3 pts | INFO |
| R08 Placeholders | Higiene | 5 pts | WARNING |
| R09 Overflow | Higiene | 0 pts | WARNING |
| R10 Números Disfrazados | Tipos | 2 pts | INFO |
| R11 Fechas Ocultas | Tipos | 0 pts | INFO |
| R12 IDs Corruptos | Tipos | 5 pts | WARNING |
| R13 Hora Redundante | Tipos | 0 pts | INFO |
| R14 Negativos | Lógica | 10 pts | CRITICAL |
| R15 Outliers IQR | Lógica | 5 pts | WARNING |
| R16 Temporal | Lógica | 10 pts | CRITICAL |
| R17 Email | Lógica | 10 pts | CRITICAL |
| R18 Teléfonos | Lógica | 5 pts | WARNING |
| R19 PII | Semántica | **20 pts** | CRITICAL |
| R20 Espacios Dobles | Higiene | 2 pts | INFO |
| R21 URLs | Lógica | 5 pts | WARNING |
| R22 Símbolos | Higiene | 5 pts | WARNING |
| R23 Redundancia temporal derivable | Semántica | 0 pts | INFO |
| R24 Cabecera pregunta/metadato | Semántica | 2 pts | INFO |
| R25 Consistencia categórica | Semántica | 4 pts | WARNING |
| R26 Cola larga categórica | Semántica | 0 pts | INFO |
| R27 Rangos quemados | Semántica | 4 pts | WARNING |
|R28 Duplicidad semántica columnas | Semántica | 0 pts | INFO |

---

## Scoring Compuesto Ponderado (Mejora #3)

A partir de la versión con `auditEngine.ts` post-`feat/dataset-profiler`, cada deducción pasa por un factor de severidad y un factor de categoría antes de sumarse al score.

| Severidad | Peso |
|---|---|
| CRITICAL | 1.5 |
| WARNING  | 1.0 |
| INFO     | 0.5 |
| GOOD     | 0.0 |

| Categoría | Peso |
|---|---|
| Integridad y Estructura | 1.2 |
| Validez y Lógica de Negocio | 1.2 |
| Tipos de Datos e Inferencia | 1.0 |
| Higiene de Texto | 0.8 |
| Semántica y Seguridad | 0.7 |

**Fórmula:**

```
points_descuento = basePenalty × peso_severidad × peso_categoría
total            = Σ(points_descuento)
score            = max(0, 100 − total)
```

`basePenalty` es el valor entero documentado arriba para cada regla. La normalización por tamaño de dataset (×1.5 si < 100 filas, ÷2 si > 10 000) se aplica después.

**Trazabilidad.** Cada `ScoreDeduction` ahora expone `severity`, `weight` y `ruleId`, de modo que el desglose del score es reproducible y auditable a partir del reporte.

**Calibración.** La tabla de pesos se calibró para mantener el score de `titanic.csv` dentro de `[60, 90]`. Las pruebas `compositeScoring.test.ts` validan la fórmula, los multiplicadores y el rango de regresión.

**Penalización máxima teórica por columna**: Variable (depende del tipo de columna y problemas detectados).  
**Score mínimo posible**: 0 (capped a `max(0, 100 - total)`).
