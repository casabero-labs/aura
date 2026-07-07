# Glosario de reglas deterministas AURA

Este glosario documenta reglas auditables del motor determinista. Cada ficha debe permitir reconstruir qué observa la regla, cuándo se activa, qué evidencia entrega y qué límites conserva.

## Plantilla reutilizable R01-R28

| Campo | Contenido esperado |
|---|---|
| ID de regla | `RXX` |
| Nombre operativo | Nombre visible en AURA |
| Familia | Integridad, higiene, tipos, lógica, semántica o seguridad |
| Implementación | `src/services/auditEngine.ts` y función/bloque principal |
| Activación | Condición determinista exacta |
| Exclusiones | Columnas, tipos o patrones que no deben disparar la regla |
| Evidencia | Forma de `sampleValues` y conteo |
| `count` | Qué unidad cuenta: filas, grupos, columnas o comparaciones |
| `affectedPercentage` | Denominador usado |
| Severidad | `critical`, `warning` o `info` |
| Penalización | Puntos base antes de pesos compuestos |
| Acción sugerida | Revisión humana o normalización esperada |
| Riesgos / límites | Casos donde puede requerir criterio de dominio |

## R07 - Caos de Capitalización

| Campo | Detalle |
|---|---|
| ID de regla | `R07` |
| ID técnico | `hygiene-case-{col}` |
| Nombre operativo | Caos de Capitalización |
| Familia | Higiene de Texto |
| Implementación | `src/services/auditEngine.ts`, agrupación por variantes de capitalización |
| Activación | Una columna textual contiene dos o más variantes que, tras recortar espacios, colapsar espacios internos, quitar acentos y pasar a minúsculas, comparten la misma clave normalizada, pero conservan diferencias de mayúsculas/minúsculas en el valor original canónico. |
| Evidencia | `sampleValues` muestra grupos reales con formato `normalizedKey: Variante1 \| VARIANTE1`; por ejemplo `bogota: Bogotá \| BOGOTÁ \| bogotá`. |
| `count` | Número de filas que pertenecen a grupos con variantes de capitalización. |
| `affectedPercentage` | `count / rowCount * 100`. Si `count > 0`, el porcentaje debe ser mayor que 0. |
| Severidad | `info` |
| Penalización | 3 pts base, sin cambiar el scoring global. |
| Exclusiones | Columnas inferidas como no textuales; columnas `date`, `datetime`, `time`, `timestamp` o equivalentes como `CallDateTime`; identificadores; email; teléfono; URL; UUID; ZIP/código postal. |
| No activación | No dispara cuando la diferencia es solo por espacios iniciales/finales o espacios internos equivalentes. |
| Acción sugerida | Normalizar capitalización solo después de validar el vocabulario con el dominio o documentar el criterio en glosario de datos. |
| Riesgos / límites | La regla no decide cuál variante es correcta. Solo entrega evidencia reproducible para revisión, especialmente en columnas categóricas de baja o media cardinalidad. |

## Pendientes R01-R28

| Regla | Estado de ficha | Nota |
|---|---|---|
| R01 | Pendiente | Completar con la plantilla. |
| R02 | Pendiente | Completar con la plantilla. |
| R03 | Pendiente | Completar con la plantilla. |
| R04 | Pendiente | Completar con la plantilla. |
| R05 | Pendiente | Completar con la plantilla. |
| R06 | Pendiente | Completar con la plantilla. |
| R07 | Completa | Ficha inicial incluida. |
| R08 | Pendiente | Completar con la plantilla. |
| R09 | Pendiente | Completar con la plantilla. |
| R10 | Pendiente | Completar con la plantilla. |
| R11 | Pendiente | Completar con la plantilla. |
| R12 | Pendiente | Completar con la plantilla. |
| R13 | Pendiente | Completar con la plantilla. |
| R14 | Pendiente | Completar con la plantilla. |
| R15 | Pendiente | Completar con la plantilla. |
| R16 | Pendiente | Completar con la plantilla. |
| R17 | Pendiente | Completar con la plantilla. |
| R18 | Pendiente | Completar con la plantilla. |
| R19 | Pendiente | Completar con la plantilla. |
| R20 | Pendiente | Completar con la plantilla. |
| R21 | Pendiente | Completar con la plantilla. |
| R22 | Pendiente | Completar con la plantilla. |
| R23 | Pendiente | Completar con la plantilla. |
| R24 | Pendiente | Completar con la plantilla. |
| R25 | Pendiente | Completar con la plantilla. |
| R26 | Pendiente | Completar con la plantilla. |
| R27 | Pendiente | Completar con la plantilla. |
| R28 | Pendiente | Completar con la plantilla. |
