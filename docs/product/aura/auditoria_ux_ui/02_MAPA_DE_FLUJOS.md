# 02 — Mapa de flujos de usuario

## Resumen

| ID | Flujo | Objetivo | Resultado observado | Hallazgos relacionados |
|---|---|---|---|---|
| `FL-01` | Orientación | Entender AURA e iniciar | Inicia; el retorno puede conservar desplazamiento y ocultar el encabezado | `AURA-UX-003` |
| `FL-02` | Auditoría central | CSV → perfil → diagnóstico → informe | Completa con una salida implícita cuando el proveedor no está disponible | `AURA-UX-001`, `AURA-A11Y-001` |
| `FL-03` | Interpretación | Comprender los riesgos y decisiones | Completa con doble representación aparente de los mismos hallazgos | `AURA-UX-002`, `AURA-UI-001` |
| `FL-04` | Exportación y cierre | Descargar evidencia o destruir la sesión | Exportación visible; cierre con semántica y foco incompletos | `AURA-A11Y-002` |
| `FL-05` | Configuración | Seleccionar proveedor y nivel de evidencia | La superficie completa existe, pero no es la recuperación enlazada desde el bloqueo | `AURA-UX-001` |
| `FL-06` | Laboratorio | Preparar una evaluación reproducible | Detecta tres modelos Ollama; contrasta con el proveedor no disponible de Auditoría | `AURA-UX-001` |
| `FL-07` | Ayuda e historial | Resolver dudas y conocer cambios | No recupera el bloqueo exacto y mezcla contratos de flujo distintos | `AURA-CONTENT-001`, `AURA-UI-002` |
| `FL-08` | Navegación móvil | Acceder a las superficies globales | El menú visualmente cerrado sigue expuesto; aparece una ruta solo móvil | `AURA-A11Y-001`, `AURA-IA-001` |

## `FL-01` — Home → inicio de auditoría

`Home → Empezar auditoría → Carga de datos`

- La acción inicia el espacio de Auditoría.
- Una recarga con estado persistido conserva Home como superficie inicial.
- En la observación móvil, la recarga mantuvo `scrollY = 180`; el título y el
  inicio del contexto quedaron fuera de la primera vista.

## `FL-02` — CSV → perfil → diagnóstico → informe

`Carga inválida → error recuperable → carga válida → procesamiento → perfil → diagnóstico → informe`

- Un `.md` genera el mensaje que solicita un `.csv` y permite reintentar.
- El CSV controlado produce 6 filas, 4 columnas, 4 hallazgos y salud `60/100`.
- Al continuar, el proveedor Cloud aparece como no disponible y la acción
  `Generar diagnóstico asistido` queda deshabilitada.
- El bloque de indisponibilidad no muestra causa concreta ni una transición a
  la configuración completa de proveedor.
- El diálogo rápido enlazado permite cambiar modelo y evidencia, no proveedor.
- El informe determinista es alcanzable al activar el paso 4 del stepper. Esa
  transición no aparece como acción textual de recuperación y, en móvil, el
  paso 4 queda inicialmente fuera del área visible.

## `FL-03` — Informe → comprensión

`Informe → métricas → riesgos confirmados → decisiones humanas → exportación`

- El encabezado declara 4 hallazgos.
- La sección `Riesgos confirmados` muestra 3 elementos.
- `Necesitan decisión humana` vuelve a mostrar los 4 hallazgos; por ejemplo,
  `Filas Duplicadas` aparece en ambas secciones.
- En móvil no hay desbordamiento horizontal, pero el nombre del archivo y la
  fecha se fragmentan en secuencias cortas.

## `FL-04` — Exportación → cierre de sesión

`Exportar informe → formatos → cerrar sesión → confirmación`

- Se muestran ZIP, PDF, JSON y CSV junto con el estado contractual.
- La confirmación destructiva aparece visualmente, pero el foco permanece en el
  control situado detrás del overlay.
- No se expone un rol de diálogo, el botón iconográfico de cierre carece de
  nombre accesible y `Escape` no cerró el modal durante la observación.

## `FL-05` y `FL-06` — Configuración y Laboratorio

- Configuración ofrece Chrome AI, Ollama local y Cloud, además de explicar qué
  evidencia sale del dispositivo.
- Laboratorio detectó tres modelos disponibles en Ollama.
- El estado de Auditoría continuó señalando Cloud no disponible; la recuperación
  local del paso de diagnóstico no conectó estas posibilidades.

## `FL-07` y `FL-08` — Soporte y navegación global

- La búsqueda de Ayuda con `proveedor no disponible` no devolvió resultados.
- Ayuda describe un flujo completo de seis etapas, mientras el stepper principal
  presenta cinco y la remediación se ofrece como rama opcional desde el informe.
- En móvil, `Trazabilidad` aparece en el menú aunque no está en la navegación de
  escritorio.
