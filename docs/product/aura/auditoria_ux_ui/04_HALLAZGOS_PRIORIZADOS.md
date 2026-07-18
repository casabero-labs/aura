# 04 — Hallazgos priorizados

## Resumen de prioridad

| Prioridad | IDs |
|---|---|
| `P1` | `AURA-UX-001`, `AURA-UX-002`, `AURA-A11Y-001`, `AURA-A11Y-002` |
| `P2` | `AURA-UI-001`, `AURA-UX-003`, `AURA-CONTENT-001`, `AURA-UI-002` |
| `P3` | `AURA-IA-001` |

No se asignó `P0`: el recorrido determinista pudo completarse, no se observó
pérdida de trabajo y los bloqueos detectados conservaron alguna vía de salida.

---

## `AURA-UX-001` — Recuperación incompleta ante proveedor no disponible

- **Reproducción y evidencia:** cargar el fixture controlado, continuar desde el perfil y observar `Proveedor: Cloud (No disponible)`. La acción `Generar diagnóstico asistido` queda deshabilitada. `Configurar` abre un diálogo rápido de modelo y evidencia; la selección de proveedor existe en la pantalla global Configuración. El informe determinista solo se alcanzó activando el paso 4. En móvil ese paso quedó fuera de la vista inicial. Laboratorio detectó tres modelos Ollama disponibles.
- **Criterio:** visibilidad del estado, control de la persona usuaria, reconocimiento sobre recuerdo y recuperación ante errores.
- **Manifestación UI:** alerta genérica, CTA bloqueada, recuperación distribuida y transición alternativa alojada en el stepper.
- **Consecuencia UX:** una persona puede concluir que el análisis no puede continuar o no descubrir que el informe determinista ya está disponible.
- **Personas y tareas afectadas:** analista, operador local y responsable de decisión; `FL-02`, `FL-05`, `FL-06`.
- **Severidad:** `S3 — problema mayor`.
- **Prioridad:** `P1 — alta`.
- **Alcance:** flujo central, escritorio y móvil.
- **Confianza:** alta; observación reproducible y contraste de superficies.
- **Limitaciones:** no se activó una API key Cloud ni se guardó un proveedor distinto durante la auditoría.

## `AURA-UX-002` — Doble representación aparente de hallazgos

- **Reproducción y evidencia:** generar el informe del fixture. El resumen declara 4 hallazgos; `Riesgos confirmados` muestra 3 y `Necesitan decisión humana` muestra 4. `Filas Duplicadas` aparece en ambas listas.
- **Criterio:** correspondencia con el modelo mental, consistencia, claridad de agrupación y prevención de interpretación errónea.
- **Manifestación UI:** secciones visualmente equivalentes presentan colecciones solapadas sin declarar la relación entre ellas.
- **Consecuencia UX:** el informe puede parecer contener siete elementos o sugerir que un mismo riesgo tiene dos estados incompatibles.
- **Personas y tareas afectadas:** analista y responsable de decisión; `FL-03`.
- **Severidad:** `S3 — problema mayor`.
- **Prioridad:** `P1 — alta`.
- **Alcance:** lectura central del informe, escritorio y móvil.
- **Confianza:** alta; conteos y título duplicado observados en la misma sesión.
- **Limitaciones:** se auditó un dataset controlado; no se compararon otras combinaciones de hallazgos.

## `AURA-A11Y-001` — Navegación sin nombre, rol o estado consistentes

- **Reproducción y evidencia:** en escritorio, la marca que devuelve a Home es un `div` clicable sin `tabindex`. En móvil, el toggle del menú aparece como botón sin nombre accesible. Con el menú visualmente cerrado, los seis controles internos permanecen visibles y enfocables en el árbol accesible.
- **Criterio:** WCAG 2.1.1 Teclado, 2.4.3 Orden del foco y 4.1.2 Nombre, función, valor.
- **Manifestación UI:** affordance visual sin equivalente semántico, toggle sin nombre/estado y contenido cerrado expuesto a tecnologías de asistencia.
- **Consecuencia UX:** la navegación global pierde previsibilidad; una persona usuaria de teclado o lector de pantalla recibe controles ocultos y no puede identificar con precisión el disparador.
- **Personas y tareas afectadas:** personas usuarias de teclado o lector de pantalla; todos los flujos globales.
- **Severidad:** `S3 — problema mayor`.
- **Prioridad:** `P1 — alta`.
- **Alcance:** transversal, escritorio y móvil.
- **Confianza:** alta; DOM accesible y fuente coincidentes.
- **Limitaciones:** la secuencia completa de tabulación no pudo medirse de forma fiable con la automatización disponible.

## `AURA-A11Y-002` — Contexto y foco incompletos en modales

- **Reproducción y evidencia:** abrir la confirmación `Cerrar sesión y destruir datos` y el Historial. No se detectó rol `dialog`; el foco permaneció en los disparadores situados detrás del overlay. El cierre iconográfico del modal destructivo no expuso nombre accesible y `Escape` no cerró la confirmación.
- **Criterio:** WCAG 1.3.1 Información y relaciones, 2.4.3 Orden del foco y 4.1.2 Nombre, función, valor.
- **Manifestación UI:** overlay visual sin contexto modal equivalente, foco externo y control de cierre sin nombre.
- **Consecuencia UX:** una persona puede seguir interactuando con un contexto que visualmente está suspendido o no identificar cómo cerrar una acción sensible.
- **Personas y tareas afectadas:** personas usuarias de teclado o lector de pantalla; cierre de sesión, historial y patrón modal compartido.
- **Severidad:** `S3 — problema mayor`.
- **Prioridad:** `P1 — alta`.
- **Alcance:** patrón transversal con impacto en una acción destructiva.
- **Confianza:** alta para los dos modales observados; media para cualquier otro modal no abierto.
- **Limitaciones:** no se ejecutó una auditoría completa con lector de pantalla nativo.

## `AURA-UI-001` — El informe móvil fragmenta metadatos y contexto de etapa

- **Reproducción y evidencia:** observar el informe a `390 × 844`. No existe desbordamiento horizontal, pero el nombre del archivo y la fecha se quiebran en fragmentos de pocos caracteres. El stepper muestra inicialmente los pasos 1 a 3 y desplaza fuera de vista el paso actual 4.
- **Criterio:** reflow, jerarquía, escaneabilidad y visibilidad del estado.
- **Manifestación UI:** quiebres de palabra agresivos y navegación de etapa horizontal fuera del primer encuadre.
- **Consecuencia UX:** identificar el artefacto auditado, la fecha y la posición actual exige reconstrucción visual y desplazamiento adicional.
- **Personas y tareas afectadas:** analista y responsable de decisión en móvil; `FL-02`, `FL-03`.
- **Severidad:** `S2 — problema menor`.
- **Prioridad:** `P2 — media`.
- **Alcance:** informe y stepper en viewport móvil.
- **Confianza:** alta para el viewport observado.
- **Limitaciones:** no se midieron todos los anchos intermedios ni zoom al 200 %.

## `AURA-UX-003` — Home conserva una posición de desplazamiento sin contexto

- **Reproducción y evidencia:** con una sesión de Auditoría persistida, recargar en `390 × 844`. AURA vuelve a Home, pero la observación registró `scrollY = 180`; el título y el inicio de la explicación quedaron fuera de la primera vista.
- **Criterio:** orientación, visibilidad del contexto y reconocimiento.
- **Manifestación UI:** el estado de superficie se reinicia a Home y el estado de desplazamiento no acompaña ese reinicio.
- **Consecuencia UX:** una persona que vuelve a entrar puede no reconocer que está en el inicio ni recibir el propósito antes del contenido secundario.
- **Personas y tareas afectadas:** nuevas visitas y retornos móviles; `FL-01`.
- **Severidad:** `S2 — problema menor`.
- **Prioridad:** `P2 — media`.
- **Alcance:** recarga o retorno con desplazamiento previo.
- **Confianza:** media; observado una vez con persistencia activa.
- **Limitaciones:** el navegador puede participar en la restauración del desplazamiento.

## `AURA-CONTENT-001` — Ayuda no refleja el bloqueo ni el contrato visible del flujo

- **Reproducción y evidencia:** buscar `proveedor no disponible` en Ayuda; no hay resultados. La ayuda describe un flujo completo de seis etapas que incluye script y revisión, mientras el stepper principal presenta cinco y el informe ofrece la remediación como rama separada.
- **Criterio:** ayuda contextual, consistencia entre documentación y sistema, y recuperación.
- **Manifestación UI:** vocabulario del error ausente del buscador y numeración de etapas distinta entre soporte y producto.
- **Consecuencia UX:** cuando aparece el bloqueo, la persona no encuentra una explicación con el mismo lenguaje y puede formar una expectativa incorrecta del recorrido restante.
- **Personas y tareas afectadas:** analista y operador local; `FL-02`, `FL-07`.
- **Severidad:** `S2 — problema menor`.
- **Prioridad:** `P2 — media`.
- **Alcance:** soporte y expectativas del flujo central.
- **Confianza:** alta para búsqueda y textos observados.
- **Limitaciones:** no se evaluaron todas las consultas alternativas del buscador.

## `AURA-UI-002` — Identidad visible y estándar Casabero no coinciden

- **Reproducción y evidencia:** observar la marca global y la CTA primaria de Home. La marca usa nueve formas dentro de un símbolo tipo tablero; el estándar Casabero define tres elipses horizontales, con centro rojo. La CTA usa fondo oscuro relleno frente al patrón de botón claro/outline del showcase. El Historial afirma que el logo sigue el estándar Casabero.
- **Criterio:** consistencia externa, credibilidad de identidad y conformidad con la fuente visual canónica.
- **Manifestación UI:** geometría de marca y jerarquía de control distintas al patrón normativo, junto con una afirmación interna de conformidad.
- **Consecuencia UX:** la pertenencia de AURA al ecosistema Casabero depende del texto y no de una identidad visual reconocible; la contradicción reduce credibilidad del historial.
- **Personas y tareas afectadas:** cualquier persona que se orienta o verifica identidad; navegación global y `FL-07`.
- **Severidad:** `S2 — problema menor`.
- **Prioridad:** `P2 — media`.
- **Alcance:** identidad transversal y Home.
- **Confianza:** alta; comparación directa con el showcase y el historial visible.
- **Limitaciones:** esta auditoría no evalúa una eventual excepción de marca documentada fuera de las fuentes revisadas.

## `AURA-IA-001` — Trazabilidad aparece únicamente en navegación móvil

- **Reproducción y evidencia:** comparar navegación a `1440 × 900` y `390 × 844`. `Trazabilidad` no aparece en la barra de escritorio y sí aparece dentro del menú móvil.
- **Criterio:** consistencia, previsibilidad y arquitectura de información.
- **Manifestación UI:** el conjunto de destinos globales cambia según viewport.
- **Consecuencia UX:** dos personas con distinto dispositivo reciben alcances de producto diferentes sin explicación de rol o contexto.
- **Personas y tareas afectadas:** navegación móvil; `FL-08`.
- **Severidad:** `S1 — inconsistencia de impacto reducido`.
- **Prioridad:** `P3 — baja`.
- **Alcance:** menú móvil.
- **Confianza:** alta; comparación directa de ambos viewports.
- **Limitaciones:** no se activó la ruta de Trazabilidad durante este corte.
