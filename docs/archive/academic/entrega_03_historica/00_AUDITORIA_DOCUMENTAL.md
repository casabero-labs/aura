# Auditoria documental y depuracion

Fecha: 2026-06-19

## Decision

La documentacion de AURA estaba dispersa en entregas previas, reportes de loop, QA visual, planes antiguos, tablas, evidencias y borradores. Para continuar el desarrollo de la tercera entrega, se consolido todo lo util en `docs/tercera_entrega_aura/`.

## Criterios usados

Se conservo un documento si cumplia al menos una condicion:

- sostiene un objetivo de tercera entrega;
- aporta evidencia reproducible o exportable;
- define metodologia o protocolo;
- alimenta resultados, glosario o articulo;
- conserva contexto historico minimo.

Se retiro un documento si era:

- duplicado de un documento consolidado;
- reporte granular de loop ya resumido;
- captura repetida sin valor directo para la memoria;
- plan obsoleto;
- entrega historica densa que ya tenia resumen;
- archivo de sistema como `.DS_Store`.

## Documentos vivos principales

| Documento | Uso |
|---|---|
| `00_LEEME.md` | Entrada unica de navegacion. |
| `01_borrador/BORRADOR_TERCERA_ENTREGA_AURA.md` | Base narrativa para seguir desarrollo y redaccion. |
| `05_desarrollo/NEXT_STEPS.md` | Orden de ejecucion desde este punto. |
| `03_evidencia/MATRIZ_EVIDENCIA_RESULTADOS.md` | Mapa objetivo-evidencia-resultado-limite. |
| `02_metodologia/PROTOCOLO_BENCHMARK_AURA_2026-06.md` | Regla para no inflar resultados LLM. |
| `10_glosario/glosario_reglas_deterministas_aura.md` | Base de glosario auditable R01-R28. |

## Ruido retirado

- Entregas antiguas completas en `.docx` y borradores densos.
- Reportes `LOOP_*` que ya no deben ser lectura principal.
- Capturas QA repetidas de desktop/mobile y regresiones visuales.
- Planes antiguos no alineados con los objetivos actuales.
- Duplicados de figuras para docx.
- `.DS_Store` rastreados.

## Regla de continuidad

Cada nuevo avance debe dejar una de estas evidencias:

1. test o build ejecutado;
2. resultado exportable;
3. tabla academica actualizada;
4. borrador actualizado;
5. limite explicito si algo no pudo cerrarse.
