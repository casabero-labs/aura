# 05 — Accesibilidad y relación con WCAG 2.2

Este documento registra riesgos observables. No constituye una declaración de
conformidad WCAG 2.2 ni sustituye pruebas con personas usuarias y tecnologías de
asistencia reales.

## Matriz de evidencia

| Hallazgo | Criterio WCAG 2.2 relacionado | Evidencia | Impacto observado | Confianza |
|---|---|---|---|---|
| `AURA-A11Y-001` | 2.1.1 Teclado | La marca de Home es un `div` clicable sin `tabindex` | El retorno global no tiene operación de teclado equivalente demostrable | Alta |
| `AURA-A11Y-001` | 2.4.3 Orden del foco | El menú móvil cerrado conserva seis controles en el árbol accesible | El orden incluye destinos visualmente ausentes | Alta |
| `AURA-A11Y-001` | 4.1.2 Nombre, función, valor | El toggle móvil no tiene nombre ni estado accesible | No se comunica qué abre ni si el menú está abierto | Alta |
| `AURA-A11Y-002` | 1.3.1 Información y relaciones | Confirmación e Historial no exponen rol de diálogo | La relación entre overlay y contenido no se comunica semánticamente | Alta |
| `AURA-A11Y-002` | 2.4.3 Orden del foco | El foco queda en el disparador detrás del overlay | El foco activo no coincide con el contexto visible | Alta |
| `AURA-A11Y-002` | 4.1.2 Nombre, función, valor | El cierre iconográfico destructivo no tiene nombre accesible | El propósito del control no se anuncia | Alta |
| `AURA-UI-001` | 1.4.10 Reflow | El contenido cabe a 390 px, pero los metadatos se fragmentan | Riesgo de legibilidad; no se declaró fallo de conformidad | Media |

## Evidencia adicional

- El recorrido no produjo desbordamiento horizontal en Home, informe ni
  exportación a `390 × 844`.
- La secuencia de tabulación automatizada no fue estable; por ello no se afirma
  un resultado exhaustivo de 2.1.1 o 2.4.7.
- No se ejecutaron VoiceOver, NVDA, JAWS, TalkBack, zoom al 200 %, contraste por
  estado, dictado ni control por voz.
- `Escape` no cerró la confirmación destructiva observada. Este dato se registra
  como comportamiento del patrón modal, no como criterio WCAG autónomo.

## Priorización accesible

Los dos hallazgos accesibles reciben `P1` por su alcance transversal y severidad
`S3`. No se asignó `P0` porque la evidencia disponible no demuestra un bloqueo
total de una tarea central para una tecnología de asistencia específica.
