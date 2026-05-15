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
| Líneas de código | 527 |
| Total de reglas | 22+ |
| Categorías | 5 (Integridad, Higiene, Tipos, Lógica, Semántica) |
| Precisión (EM) | 1.00 (determinista) |
| Dependencias externas | Ninguna (TypeScript puro) |
| Límite de filas | 5.000 (PapaParse preview) |

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
| **Algoritmo** | Compara `uniqueCount` vs `distinctLowerCount` — si hay más únicos que únicos-lowercase, existen variantes como "Lima" vs "LIMA" |
| **Penalización** | 3 pts |
| **Umbral** | `uniqueCount > distinctLower` y `uniqueCount < rowCount * 0.8` |

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

**Penalización máxima teórica por columna**: Variable (depende del tipo de columna y problemas detectados).  
**Score mínimo posible**: 0 (capped a `max(0, 100 - total)`).
