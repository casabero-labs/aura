# Situaciones de dataset para reforzar AURA

> Objetivo: identificar nuevos casos que pueden convertirse en reglas deterministas, benchmarks o tareas de interpretacion cognitiva.

## 1. Casos que conviene detectar en Capa 1

| Situacion | Ejemplo | Deteccion determinista posible | Rol de Capa 2 |
|---|---|---|---|
| Redundancia temporal derivable | `datetime` contiene fecha+hora y `time` repite la hora | Extraer hora de `datetime` y comparar contra `time` | Decidir si `time` es redundante, hora local, hora de negocio o campo optimizado |
| Fecha descompuesta redundante | `date`, `year`, `month`, `day` | Reconstruir fecha y comparar partes | Recomendar conservar partes si son utiles para analitica |
| Edad vs fecha de nacimiento | `birth_date`, `age` | Calcular edad aproximada y comparar | Evaluar fecha de corte, zona horaria y actualizacion |
| Total derivable | `price`, `quantity`, `total` | Verificar `price * quantity ~= total` | Explicar impacto contable y tolerancias |
| Porcentaje derivable | `completed`, `total`, `completion_rate` | Verificar division y escala 0-1/0-100 | Interpretar si es KPI historico o recalculable |
| Columnas duplicadas con distinto nombre | `customer_id`, `client_id` con mismos valores | Comparar hashes/frecuencia por columna | Inferir si representan entidades distintas |
| IDs con formato inestable | `00123`, `123`, `123.0` | Detectar padding perdido y floats | Recomendar normalizacion sin romper joins |
| Monedas mezcladas | `$1,200`, `1200 COP`, `1.200,50` | Regex de simbolos/separadores | Inferir localizacion y unidad monetaria |
| Unidades mezcladas | `1.70 m`, `170 cm`, `70 kg` | Detectar sufijos/unidades | Proponer normalizacion con conversiones |
| Categorias semiduplicadas | `M`, `Masculino`, `male` | Agrupar variantes por normalizacion textual | Resolver equivalencias de dominio |
| Fechas futuras imposibles | `birth_date > today` | Comparar contra fecha actual | Distinguir agenda/evento futuro vs dato imposible |
| Coordenadas fuera de rango | latitud 190, longitud -500 | Rangos validos | Identificar dominio geografico |
| PII contextual | columna `notes` con emails/tarjetas | Regex dentro de texto libre | Clasificar riesgo y redaccion/anonimizacion |

## 2. Casos que deben quedar como Capa 1 + Capa 2

Algunos problemas pueden detectarse de forma determinista, pero no resolverse automaticamente:

- redundancias derivadas;
- columnas candidatas a eliminar;
- outliers plausibles;
- fechas futuras;
- columnas con alta cardinalidad;
- categorias textuales que podrian ser dimension;
- PII que podria ser necesaria por finalidad legitima.

Patron recomendado:

1. Capa 1 detecta y cuantifica.
2. Capa 2 interpreta contexto y riesgos.
3. Capa 3 propone script o recomendacion revisable.

## 3. Nuevas reglas candidatas

| ID sugerido | Regla | Prioridad |
|---|---|---|
| R23 | Redundancia temporal derivable | Implementada |
| R24 | Fecha descompuesta redundante | Alta |
| R25 | Total aritmetico inconsistente | Alta |
| R26 | Columnas duplicadas semanticamente | Media |
| R27 | Monedas/separadores mezclados | Alta |
| R28 | Unidades mezcladas | Media |
| R29 | PII incrustada en texto libre | Alta |
| R30 | Fechas futuras imposibles por dominio | Media |

## 4. Valor para publicacion

Estos casos refuerzan la tesis porque muestran el limite natural de las reglas:

- La regla puede detectar evidencia.
- El LLM puede explicar implicaciones.
- El humano decide si transformar.

Esto evita una conclusion ingenua como "las reglas limpian el dataset" y sostiene una conclusion mas fuerte:

> AURA combina deteccion reproducible, interpretacion cognitiva y gobernanza humana para reducir errores en diagnosticos de calidad del dato.

