# Auditoría UX/UI de AURA — hallazgos

**Corte:** 18 de julio de 2026<br>
**Versión observada:** `d9272a2`<br>
**Modo:** híbrido; inspección de interfaz, recorridos humanos y contraste de código<br>
**Estado:** línea base de hallazgos cerrada; fase de mejora fuera de alcance

## Propósito

Esta carpeta registra qué interfiere con los objetivos de las personas usuarias,
dónde ocurre y con qué prioridad. No contiene soluciones, rediseños, backlog ni
plan de implementación.

La unidad de análisis aplicada fue:

`rol y contexto → objetivo → flujo y estado → manifestación UI → consecuencia UX → severidad → prioridad`

## Resultado ejecutivo

Se documentaron **9 hallazgos**:

| Prioridad | Cantidad | Lectura operativa |
|---|---:|---|
| `P0 — Crítica` | 0 | No se observó pérdida de datos ni bloqueo total sin recuperación. |
| `P1 — Alta` | 4 | Afectan el flujo central o una capacidad transversal de acceso y comprensión. |
| `P2 — Media` | 4 | Introducen fricción recuperable en orientación, soporte o lectura responsiva. |
| `P3 — Baja` | 1 | Inconsistencia de alcance reducido en la navegación. |

Los hallazgos `P1` son:

1. `AURA-UX-001`: la indisponibilidad del proveedor bloquea la acción principal y la salida disponible queda implícita.
2. `AURA-UX-002`: el informe representa los mismos hallazgos en secciones que parecen conjuntos distintos.
3. `AURA-A11Y-001`: la navegación expone controles sin semántica o nombre accesible y mantiene visible el menú móvil cerrado para tecnologías de asistencia.
4. `AURA-A11Y-002`: los modales observados no establecen de forma consistente contexto, foco y cierre accesible.

## Documentos

- [`01_ALCANCE_USUARIOS_Y_CONTEXTO.md`](./01_ALCANCE_USUARIOS_Y_CONTEXTO.md)
- [`02_MAPA_DE_FLUJOS.md`](./02_MAPA_DE_FLUJOS.md)
- [`03_MATRIZ_RELACIONES_UX_UI.md`](./03_MATRIZ_RELACIONES_UX_UI.md)
- [`04_HALLAZGOS_PRIORIZADOS.md`](./04_HALLAZGOS_PRIORIZADOS.md)
- [`05_ACCESIBILIDAD_WCAG_22.md`](./05_ACCESIBILIDAD_WCAG_22.md)
- [`06_CONSISTENCIA_CASABERO.md`](./06_CONSISTENCIA_CASABERO.md)
- [`07_LIMITACIONES_Y_EVIDENCIA_FALTANTE.md`](./07_LIMITACIONES_Y_EVIDENCIA_FALTANTE.md)
- [`evidencias/README.md`](./evidencias/README.md)

## Base metodológica

- `estandar-casabero/standards/frontend/UX_UI_AUDIT.md`
- `estandar-casabero/standards/frontend/HUMAN_FIRST_UX.md`
- `estandar-casabero/examples/frontend/showcase.html`
- heurísticas de Nielsen, ISO 9241-11, ISO 9241-210 y WCAG 2.2, según la ruta de evidencia definida por el estándar Casabero

## Frontera de fase

Este corte termina en hallazgos, relaciones UX/UI, severidad, prioridad y
limitaciones de evidencia. Cualquier decisión de cambio pertenece a una fase
posterior y separada.
