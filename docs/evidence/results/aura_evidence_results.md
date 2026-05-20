# Evidencia actualizada AURA - segunda entrega

Generado: 2026-05-20T01:32:36.977Z

| Dataset | Proposito | Filas | Columnas | Score | Hallazgos | Criticos | Advertencias | Info | Duplicados |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| clientes_sucio.csv | valores nulos, placeholders y errores de higiene textual | 6 | 5 | 18/100 | 7 | 4 | 1 | 2 | 1 |
| inventario_sucio.csv | tipos mixtos, negativos y consistencia de inventario | 6 | 6 | 15/100 | 8 | 4 | 2 | 2 | 1 |
| operaciones_sucio.csv | duplicados, formatos temporales y coherencia operacional | 6 | 6 | 24/100 | 8 | 3 | 4 | 1 | 1 |

## Hallazgos principales por dataset

### clientes_sucio.csv

| Severidad | Regla | Columna | Conteo | Afectacion |
|---|---|---|---:|---:|
| critical | Filas Duplicadas | - | 1 | 16.67% |
| info | Espacios Fantasma (Trim) | nombre | 2 | 33.33% |
| info | Espacios Múltiples | nombre | 3 | 50% |
| critical | Formato Email Inválido | email | 2 | 33.33% |
| critical | Valores Nulos / Vacíos | estado | 4 | 66.67% |

### inventario_sucio.csv

| Severidad | Regla | Columna | Conteo | Afectacion |
|---|---|---|---:|---:|
| critical | Filas Duplicadas | - | 1 | 16.67% |
| info | Espacios Fantasma (Trim) | producto | 2 | 33.33% |
| info | Espacios Múltiples | producto | 2 | 33.33% |
| critical | Valores Nulos / Vacíos | categoria | 2 | 33.33% |
| warning | Placeholders Tóxicos | categoria | 2 | 33.33% |

### operaciones_sucio.csv

| Severidad | Regla | Columna | Conteo | Afectacion |
|---|---|---|---:|---:|
| critical | Filas Duplicadas | - | 1 | 16.67% |
| info | Espacios Múltiples | cliente | 2 | 33.33% |
| warning | Valores Nulos / Vacíos | fecha_cierre | 1 | 16.67% |
| critical | Valores Nulos / Vacíos | prioridad | 2 | 33.33% |
| warning | Placeholders Tóxicos | prioridad | 2 | 33.33% |
