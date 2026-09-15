# Aura Editorial · arquitectura de información y diseño de recorridos

**Estado: DISEÑO PROPUESTO · SIN IMPLEMENTAR.** 14 de septiembre de 2026.

**Orden de ejecución:** [tres loops](2026-09-14-aura-editorial-orden-ejecucion.md) — Inicio+Carga → Informe+exportar → Laboratorio. Este archivo sigue siendo la especificación de superficies; el addendum gobierna la secuencia. Implementación no iniciada.

**Impeccable:** localizada en el plugin `impeccable` (`frontend-design`, `polish`, `quieter`, `animate`). No era un bloqueo de este diseño. El pase formal se aplica en cada loop al materializar las superficies, no como certificación previa de U01–U09.

Complementa el [plan integral](2026-09-14-aura-migracion-editorial-integral.md), el [inventario](2026-09-14-aura-editorial-inventario.md) y las [brechas del showcase](2026-09-14-editorial-showcase-brechas.md).

## 1. Mandato y frontera

El usuario autoriza reconsiderar por completo la disposición actual de UI y UX para favorecer una migración correcta. El trabajo sigue en la fase de diseño/planificación solicitada: esta ampliación no inicia implementación ni publicación.

La disposición de Aura **no es una restricción que haya que conservar**. Se pueden reorganizar navegación, pantallas, agrupación de contenido, densidad, posición de acciones, formularios, tablas, detalles, mensajes y recorridos. El objetivo es que el usuario entienda el análisis, decida con evidencia y termine su tarea dentro de un único sistema Editorial.

Sí son restricciones los contratos y resultados: autorización humana, alcance de cambios, preservación de valores, límites del proveedor, evidencia verificable y coherencia de descargas. Un paso de procesamiento interno no necesita una pantalla propia; una decisión o autorización distinta sí debe seguir siendo distinguible.

Cuando falte un patrón, se completa Editorial en el showcase canónico. No conservar una disposición inadecuada porque el catálogo actual no ofrece otra, ni importar presentación Ink/Warm para resolverla.

## 2. Base observada e hipótesis de diseño

Lectura actual de `App.tsx`, `MainPipeline.tsx`, `PipelineProgress.tsx`, `ProfileStep.tsx`, `ColumnStatsPanel.tsx`, `DiagnosticReportStep.tsx`, `SettingsPanel.tsx` y `benchmark/BenchmarkCampaignLab.tsx`. No se presenta esta inspección de fuentes como estudio con participantes ni como nueva validación runtime.

| Observación de código | Consecuencia que debe evaluarse | Respuesta de diseño propuesta |
|---|---|---|
| App expone Inicio, Auditoría, Laboratorio y Configuración al mismo nivel; ayuda/registros se abren aparte | Puede competir orientación general con tareas y utilidades | Dos destinos de trabajo; Inicio mediante marca; Configuración/Ayuda como utilidades etiquetadas |
| Home combina presentación, tres bloques del proceso y CTA/reanudación | La tarea recurrente puede beneficiarse de contexto de sesión más inmediato | Inicio operativo: reanudar o cargar; explicación breve subordinada |
| Navegación usa varios booleanos; entrada standalone ya usa `?view=ollama-setup` | Cambiar disposición obliga a explicitar exclusión entre vistas, retorno y estado de URL | Contrato de navegación único y restauración sin perder el análisis |
| Informe muestra resumen de dataset, invocación del modelo y decisión antes de la conclusión; exportar/corregir se repiten en varias zonas | Revisar repetición y prioridad entre conclusión y detalle de ejecución | Conclusión primero; una zona coherente de decisiones; detalles técnicos accesibles por contexto |
| Perfil reúne prioridades y estadísticas de columnas; existen componentes de tablas no enlazados | Unificar exploración puede ayudar, pero reactivar código antiguo sin validar puede añadir deuda | Diseñar índice/tabla de columnas y detalle a partir de necesidades reales; no resucitar componentes solo por su nombre |
| Laboratorio conserva campaña, matriz, ejecución y resultados dentro de un componente principal | El orden óptimo puede variar con campaña nueva, en curso o completada | Cambiar jerarquía por estado, conservando acceso al protocolo y ejecución |
| Exportación vive en App y desmonta el pipeline | Reorganizarla puede afectar evidencia y retorno | Extraer presentación si conviene; mantener propiedad/identidad del análisis y regresión de ida y vuelta |

Los roles utilizados para diseñar son **hipótesis de tareas**, no nuevos permisos: persona que revisa un CSV; persona que aprueba una corrección; persona que compara diagnósticos en Laboratorio. Pueden ser la misma persona. No añadir cuentas, roles de acceso ni onboarding obligatorio para sostener estas hipótesis.

## 3. Alternativas consideradas

| Alternativa | Ventaja | Coste o límite | Decisión |
|---|---|---|---|
| Conservar estructura y sustituir presentación | Menor cambio de navegación | Mantiene duplicaciones y disposición aunque no apoyen Editorial ni la tarea | Insuficiente como estrategia global |
| Espacio de trabajo por tarea con documento operativo | Contexto estable, lectura principal clara, detalle bajo demanda y composición móvil natural | Requiere rediseñar jerarquía y probar continuidad | **Propuesta elegida** |
| Panel analítico con sidebar permanente y muchos paneles simultáneos | Permite comparar varias áreas en escritorio amplio | Mayor competencia visual, doble scroll y menor ancho útil en móvil | Usar comparación local solo donde aporta valor, sin convertirlo en estructura general |

La propuesta elegida se aplica completamente en Editorial. La densidad técnica se resuelve con sans, tablas, selección y secciones, no con otro tema.

## 4. Arquitectura de información objetivo

```text
AURA / Inicio
├── Auditoría
│   ├── Carga
│   ├── Perfil
│   ├── Diagnóstico
│   ├── Informe
│   │   └── Corregir una copia (rama opcional)
│   │       ├── Propuesta y script
│   │       ├── Aprobación
│   │       └── Aplicar y verificar
│   └── Exportación
├── Laboratorio
│   ├── Preparación y protocolo
│   ├── Ejecución
│   ├── Resultados y detalle
│   └── Configuración elegida y exportación
└── Utilidades disponibles desde el contexto
    ├── Configuración
    ├── Ayuda
    └── Registro y evidencia técnica
```

Es una jerarquía conceptual, no la orden de crear una URL o un componente por cada línea. Auditoría mantiene sus cinco hitos humanos y Laboratorio organiza su campaña por estado. La rama de corrección no se convierte en requisito para entregar un informe.

### Navegación global

- Marca AURA con destino Inicio; dos destinos de trabajo: **Auditoría** y **Laboratorio**.
- Configuración y Ayuda visibles como utilidades con texto; no ocultarlas exclusivamente en iconos, hover o un menú sin etiqueta.
- En móvil, marca/utilidades en primera línea; destinos de trabajo en segunda línea. Ninguna acción crítica desaparece para hacer caber desktop.
- Estado activo y título de vista coherentes. Configuración abierta muestra su propia ubicación y un retorno claro al contexto de origen.
- Registro técnico accesible desde el análisis/campaña y desde Ayuda si es global. Evitar convertirlo en un tercer flujo principal.

Los cuatro destinos actuales siguen disponibles, pero ya no tienen que compartir jerarquía, posición o mecanismo de navegación. Las pruebas se actualizan al nuevo contrato humano en lugar de congelar la disposición anterior.

### Estructura común de una vista de trabajo

```text
Navegación global
Identidad del análisis/campaña · estado real · acceso a información de contexto
Hitos o navegación local pertinente
Título y explicación breve de la tarea
Resultado o contenido principal
Evidencia y detalles accesibles por sección
Acción primaria + alternativas y resultado de la acción
```

La identidad se muestra una vez con archivo/campaña y estado; el hash completo queda en detalle técnico con copia. Los requisitos que impiden actuar y los riesgos de una decisión permanecen visibles junto a la acción, no escondidos en ese detalle.

## 5. Especificación por superficie

### U01 — Inicio operativo

**Objetivo:** comenzar o recuperar el trabajo sin recorrer una presentación comercial.

- Sin sesión: título de tarea breve, explicación de qué puede hacer Aura y primaria «Empezar auditoría»; acceso secundario al Laboratorio.
- Con sesión: archivo, etapa, alcance de recuperación y primaria «Reanudar análisis»; «Empezar otra auditoría» subordinada y con confirmación si afecta trabajo existente.
- Resumen del proceso conciso, sin tres tarjetas grandes obligatorias ni repetir contenido que aparece en cada etapa.
- No añadir historial multisesión si el producto solo conserva una sesión. No confundir volver a Inicio con cerrar o borrar el análisis.

**Catálogo:** EC-01, EC-14, EC-17. **Validación:** usuario identifica archivo/etapa y reanuda; inicio nuevo no borra silenciosamente la sesión.

### U02 — Carga y preparación

**Objetivo:** saber qué archivo se analizará y corregir un error de entrada.

- Secuencia única: selección de CSV → identidad/resultado de lectura → perfil cuando termina correctamente.
- Ayuda de formato cerca de la selección; progreso/error en la misma sección. La carga no exige elegir modelo.
- Datos técnicos de ingestión en detalle expandible; error que impide continuar visible con causa y reintento.
- Si un resultado parcial se puede inspeccionar, explicitar su límite; no dar al usuario una apariencia de análisis completo.

**Catálogo:** EC-03, EC-05. **Validación:** archivo válido/inválido, teclado, reintento y ausencia de proveedor.

### U03 — Perfil como resumen y exploración de datos

**Objetivo:** comprender qué contiene el dataset, qué señales requieren atención y qué observar antes del diagnóstico.

Orden propuesto: identidad del dataset → conclusión/alcance de reglas → cifras esenciales con denominador → prioridades → exploración de columnas → evidencia de ingestión/reglas → siguiente paso.

- Convertir cifras repetidas en una fila de métricas con títulos y unidades, no en múltiples cards autónomas.
- Explorar columnas mediante índice o tabla seleccionable; detalle con tipo, completitud, distribución y muestras. Selección inequívoca y nombres completos.
- Escritorio ancho: tabla y detalle pueden compartir espacio si ambos permanecen legibles. Móvil: tabla/resumen → columna seleccionada → detalle, con retorno explícito al punto de selección.
- No deducir riesgos semánticos por estilo o color. «No evaluado» y «sin alertas» siguen siendo distintos.

**Catálogo:** EC-06, EC-08, EC-10, EC-17. **Validación:** seleccionar una columna, leer evidencia y volver conservando selección/filtros, a 320 px y con teclado.

### U04 — Diagnóstico: preparar, ejecutar y entender

**Objetivo:** conocer qué recibirá el proveedor y obtener una interpretación sin perder acceso a resultados deterministas.

Orden: objetivo de la etapa → proveedor/modelo y disponibilidad → resumen de evidencia que se enviará → acción «Iniciar diagnóstico» → actividad → resultado o recuperación.

- Configuración esencial contextual; parámetros avanzados en detalle o Configuración completa con retorno al diagnóstico.
- Distinguir local/cloud y evidencia enviada antes de iniciar. La reorganización no amplía autorizaciones de transmisión ni ejecuta una prueba de inferencia al abrir configuración.
- Mientras procesa, mostrar etapa/tiempo real y cancelación con alcance preciso. El contenido previo permanece disponible si el sistema lo permite.
- Fallo o ausencia de proveedor: causa y recuperación, junto a la alternativa determinista soportada. No prometer remediación verificada si esa ruta no la ofrece.
- Después de éxito: resumen comprensible y primaria «Ver informe»; contrato y respuesta técnica en detalle.

**Catálogo:** EC-04, EC-05, EC-08, EC-18. **Validación:** configurar → regresar con campos/archivo intactos; iniciar una vez; cancelar/reintentar sin respuesta vieja sobreescrita.

### U05 — Informe orientado a una decisión

**Objetivo:** entender qué se encontró, su evidencia y qué hacer con el resultado.

Orden: conclusión y alcance → resumen de hallazgos → hallazgos con soporte → recomendaciones → decisión de exportar o corregir → evidencia técnica.

- Metadata de invocación y recibos detrás de «Cómo se obtuvo este resultado», conservando fuente y limitaciones esenciales visibles.
- Unificar presentación de un hallazgo: regla/señal, columna real, cantidad afectada, evidencia y grado de confirmación. Repeticiones de la misma entidad se presentan como atributos cuando el contrato actual ya las identifica así; no cambiar deduplicación por estética.
- Primaria «Exportar resultados»; alternativa «Corregir una copia» con disponibilidad y alcance. Si hay repetición arriba/abajo por longitud, es la misma zona de acción coherente, con idéntico estado y etiqueta; no tres llamadas con significados parecidos.
- Gráficas cerca de la afirmación que ayudan a interpretar, con alternativa tabular. No mover una figura que explica un resultado esencial a un apartado difícil de descubrir.

**Catálogo:** EC-06, EC-10, EC-11, EC-17. **Validación:** conclusión localizable, evidencia alcanzable y salida sin corrección; datos/resultados iguales al baseline.

### U06 — Corrección como rama de decisiones explícitas

**Objetivo:** aprobar solo lo deseado, ejecutar una copia y comprobar el resultado.

- Encabezado contextual persistente «Corregir una copia» con enlace al informe y tres hitos locales; no sumar tres etapas obligatorias al flujo principal.
- Propuesta y script: lista/tabla de acciones con columnas reales, evidencia y consecuencia; detalle técnico del script asociado.
- Aprobación: resumen de decisiones, exclusiones y alcance antes de continuar. Desplazar un botón no puede aprobar, resetear aprobación o ejecutar implícitamente.
- Aplicar/verificar: instrucciones externas → estado individual de bundle/recibo/CSV → validación → comparación → exportación. Formularios y comparación pueden cambiar disposición según estado, sin ocultar el requisito pendiente.
- Plan vacío/rechazado: cierre sin cambios al mismo nivel de claridad que continuar; evitar pantallas vacías con un botón deshabilitado sin salida.

**Catálogo:** EC-02, EC-07, EC-08, EC-09, EC-11. **Validación:** decisiones y archivos conservados al navegar; recibo válido no equivale a cambios semánticos autorizados.

### U07 — Exportación como cierre del análisis

**Objetivo:** obtener la pieza adecuada y saber qué contiene.

- Contexto de análisis + estado de evidencia; lista de entregables agrupados por propósito: informe legible, datos/tablas y evidencia técnica.
- Selección inclusiva de corrected.csv explícita, con requisito y descripción, junto al paquete afectado.
- Jerarquía según objetivo: una descarga recomendada por contexto y alternativas visibles; no cuatro tarjetas con primarias igualmente dominantes.
- Progreso/fallo/reintento por generación; acceso al informe tras descargar.
- «Empezar otra auditoría» y «Eliminar datos de esta sesión» separados conceptualmente de descargar; no presentar destrucción como paso obligatorio para terminar.

**Catálogo:** EC-11, EC-14, EC-15. **Validación:** descargar/abrir cada pieza, comparar manifiesto y volver al informe sin perder evidencia.

### U08 — Laboratorio organizado por estado de campaña

**Objetivo:** comparar diagnósticos bajo un protocolo y elegir una configuración con sus límites.

- Sin campaña: insumos → modelo/configuración → resumen del protocolo → iniciar cuando existan requisitos.
- En curso: progreso y ejecución actual primero; matriz y fallos accesibles; protocolo de consulta sin permitir cambios que invaliden el experimento.
- Completada: resultado y validez primero → comparación gráfica/tabular → detalle de una corrida → metodología → configuración seleccionada/exportación. No obligar a pasar por toda la configuración inicial para leer resultados.
- Índice local por secciones para campañas largas. Pestañas solo entre representaciones del mismo resultado, no para esconder fallos o requisitos esenciales.
- Selección sincronizada entre gráfico, tabla y detalle. En móvil, detalle en secuencia natural con retorno a selección; sin tres paneles estrechos ni scroll interno obligatorio.
- Configuración elegida: resumen exacto y acción de aplicarla; feedback visible y enlace a Auditoría. No iniciar diagnóstico automáticamente ni dar una recomendación sin evidencia suficiente.

**Catálogo:** EC-06, EC-10, EC-13, EC-17, EC-18. **Validación:** campaña sintética mixta, error parcial, selección con teclado y transferencia exacta.

### U09 — Configuración, ayuda y registro

**Objetivo:** resolver una necesidad y volver al trabajo.

- Configuración completa agrupada por proveedor/modelo, evidencia de entrada, parámetros y diagnóstico de conexión; evitar resúmenes duplicados de proveedor activo/proveedor de diagnóstico si no añaden información diferente.
- Configuración contextual presenta solo lo necesario para desbloquear esa tarea, reutilizando validación y estado de configuración completos.
- Ayuda específica junto a conceptos difíciles; ayuda extensa navegable como documento. No insertar manuales completos antes de la tarea.
- Registro técnico por análisis/campaña con fecha/estado y copia de evidencia disponible. No crear historial ni persistencia adicional sin diseño funcional separado.
- Mantener ruta standalone de Ollama con Editorial y salida clara; no hacerla depender del montaje de App.

**Catálogo:** EC-04, EC-08, EC-12, EC-18. **Validación:** campo inválido no desaparece tras rerender, cerrar conserva o descarta cambios explícitamente, volver retorna al contexto correcto.

## 6. Contratos transversales de interacción

| Situación | Comportamiento requerido |
|---|---|
| Avanzar a otra etapa | Mostrar su título/contexto al inicio útil; foco lógico y estado actual anunciado sin repetir toda la pantalla |
| Volver a una exploración | Restaurar selección, filtros y posición útil cuando ese estado siga siendo válido |
| Abrir utilidad desde una tarea | Conservar análisis/campaña y registrar destino de retorno; cerrar no navega arbitrariamente a Inicio |
| Cambiar un insumo que invalida resultados | Explicar qué se invalida antes de la acción cuando corresponda; aplicar las reglas existentes de invalidez, no esconder resultado obsoleto como vigente |
| Atrás/adelante del navegador | Volver a una vista válida, sin reiniciar inferencias ni descargar automáticamente |
| Entrada directa a una etapa sin requisitos | Explicar qué falta y dirigir al punto válido; no crear datos ficticios para renderizar la pantalla |
| Recargar | Respetar persistencia real; reimportación cuando falten archivos, sin prometer un expediente completo en storage |
| Abrir/cerrar detalle | Nombre/estado expandido accesible; foco y selección estables; contenido esencial de decisiones visible |
| Esperar/procesar | Estado y siguiente acción reales; no reemplazar toda la vista por un spinner que elimina contexto |
| Confirmar/cancelar | No mezclar selección visual con aprobación; cancelar conserva el contexto descrito |

La URL puede representar `view`, etapa y sección cuando aporte retorno fiable. La ruta existente `?view=ollama-setup` se conserva. Propuesta técnica mínima: ampliar parámetros de navegación y usar History API con validación; no incorporar un framework de routing por defecto. Solo estado de navegación no sensible en URL: nunca dataset, credenciales, contenido de filas ni evidencia privada.

Se permite reemplazar booleanos mutuamente excluyentes por un estado de vista discriminado si simplifica este contrato. La propiedad del análisis y su evidencia permanece estable, independientemente de qué panel se monte. Los cambios de contenedores, routing y estado UI requieren pruebas de navegación; los motores y contratos no se reescriben para conseguir una nueva disposición.

## 7. Contrato de composición y contenido

- **Lectura:** ancho de párrafo controlado; títulos/conclusiones serif; metadata y controles sans; espacio y filetes separan responsabilidades.
- **Operación densa:** ancho útil para comparar; no forzar tablas dentro de la columna estrecha de lectura. Detalle vinculado a selección y unidades visibles.
- **Móvil:** una secuencia principal, controles agrupados y acciones a mano. Reordenar por tarea; no reducir toda la interfaz hasta que quepa.
- **Acciones fijas:** solo cuando la longitud del trabajo las justifique; reservar espacio y comprobar teclado/zoom. Preferir repetición coherente de acciones si un sticky oculta contenido.
- **Divulgación progresiva:** detalles técnicos bajo demanda; impacto, autorización, ausencia de evidencia y requisitos siempre cerca de la decisión. No usar accordions como depósito de todo lo difícil.
- **Copy:** una misma acción tiene el mismo nombre en entrada y resultado. Distinguir iniciar, generar, aprobar, aplicar, verificar y descargar; no usar «Continuar» cuando oculta la consecuencia.
- **Estado:** una vista cambia jerarquía cuando el resultado pasa de pendiente a disponible; no salta de composición sin orientar al usuario ni cambia foco durante polling.
- **PDF:** mismo orden cognitivo que el informe web, adaptado a documento paginado. No trasladar botones, tabs o paneles colapsados al PDF; su evidencia relevante debe estar disponible en el documento o anexos identificados.

## 8. Nuevos requisitos del showcase por esta reorganización

Las familias EC-01–EC-16 cubren piezas, pero faltan composiciones y retorno entre contextos. Se agregan:

- **EC-17 · Documento operativo y selección con detalle:** shell de tarea con contexto, hitos, resumen, tabla/índice seleccionable, detalle y acciones; desktop y móvil. Debe demostrar selección/retorno y jerarquía por estado.
- **EC-18 · Configuración contextual y retorno al trabajo:** abrir ajuste desde una tarea, conservar borrador/contexto, validar, aplicar/cancelar y regresar; ejemplo de error y de requisito no resuelto.

EC-01 pasa a demostrar destinos principales más utilidades; EC-02 distingue hitos de procesamiento frente a autorización; EC-11 separa descargar, nuevo análisis y eliminar sesión; EC-13 demuestra campaña nueva/en curso/completada con jerarquía diferente.

No convertir el showcase en una copia completa de Aura con motor y proveedores. Sus composiciones usan datos simulados declarados y enlaces/estados demostrables. Aura valida después el comportamiento con datos y contratos reales.

## 9. Archivos y decisiones de implementación previstos

| Archivo | Cambio previsto | Condición |
|---|---|---|
| `src/App.tsx` | Separar shell/vista y contexto de análisis; eliminar booleans de vista incompatibles si se adopta el estado discriminado | Probar navegación y propiedad de evidencia antes/después |
| `src/services/appNavigation.ts` (nuevo) | Parseo/serialización de navegación permitida y validación de destinos | Crear al adoptar URL/History; no persistir datos sensibles |
| `src/components/AuditContextHeader.tsx` (nuevo) | Identidad/estado del análisis compartidos por etapas y exportación | Extraer cuando haya dos consumidores; evitar duplicar identidad en cada panel |
| `src/components/ExportResultsPanel.tsx` (nuevo) | Presentación de exportación extraída de App | Mantener generación, disponibilidad y evidencia en su propietario correspondiente |
| `src/components/PipelineProgress.tsx` | Hitos navegables y rama contextual accesibles | Conservar gates reales del pipeline |
| `src/components/ProfileStep.tsx`, `ColumnStatsPanel.tsx` | Resumen/selección/detalle y distribución responsive | Preservar cifras, muestras, filtros e identidad de columna |
| `src/components/DiagnosticReportStep.tsx` | Priorizar conclusión; agrupar evidencia y decisiones; reducir repeticiones | Comparar contenido y rutas de salida |
| `src/components/SettingsPanel.tsx`, `diagnosis/DiagnosisQuickConfigModal.tsx` | Compartir configuración esencial y retorno, reducir duplicación | No crear otra fuente de verdad de configuración |
| `src/components/benchmark/BenchmarkCampaignLab.tsx` y consumidores | Jerarquía según estado, selección y detalle | No tocar protocolo, puntuaciones o dataset |
| `src/tests/e2e/editorial-information-architecture.spec.ts` (nuevo) | Recorridos de orientación/retorno/selección/URL | Camino productivo, sin inyección que salte decisiones |

Son destinos propuestos; antes de extraer, comprobar los consumidores y el alcance mínimo. No crear contenedores vacíos ni duplicar una biblioteca para cumplir una lista de archivos.

## 10. Validación previa a ampliar la implementación

Orden: observaciones actuales y baseline → arquitectura propuesta → patrones ausentes → composiciones de baja fidelidad → revisión visual → implementación por los [tres loops](2026-09-14-aura-editorial-orden-ejecucion.md) → comparación con baseline.

Muestras mínimas revisables: Inicio con/sin sesión; Perfil denso con columna seleccionada; Informe con ruta determinista y ruta asistida; aprobación de acción; campaña mixta terminada; ajuste contextual con retorno. Todas a 390 y 1280 px, con una comprobación específica a 320 px y oscuro Editorial. Estos prototipos aún deben crearse durante F1: el presente documento es su especificación, no evidencia de prototipos terminados.

| Pregunta de evaluación | Evidencia observable |
|---|---|
| ¿Sé qué estoy analizando y dónde estoy? | Archivo/campaña y etapa correctos al entrar, volver y recargar |
| ¿Encuentro la conclusión antes del detalle técnico? | Recorrido de lectura del informe y acceso a fuente/limitación sin buscar entre varias secciones repetidas |
| ¿Puedo contrastar un dato? | Seleccionar columna/hallazgo/corrida y alcanzar detalle, volver sin perder selección |
| ¿Puedo resolver un bloqueo y continuar? | Configurar proveedor/modelo desde tarea y regresar al estado coherente |
| ¿Entiendo qué autorizo? | Acción, columna, consecuencia y estado de aprobación visibles antes de ejecutar |
| ¿Puedo terminar sin corregir? | Exportar evidencia disponible sin generar ni aprobar script |
| ¿Puedo completar la tarea en móvil/teclado? | Mismo resultado con lectura útil, acciones alcanzables y sin doble scroll involuntario |

Medir acciones necesarias, errores de navegación, pérdida de contexto y tiempo para localizar una conclusión/archivo antes y después en escenarios iguales. Sin participantes, declarar evaluación experta; no inventar porcentajes de mejora ni afirmar usabilidad validada por contar clics.

**Cierre de diseño:** cada U01–U09 enlaza una disposición, estado, patrón EC y comprobación; los cambios de posición responden a tarea/evidencia, no al deseo de imitar la página del catálogo. **Cierre del producto:** todos los recorridos del plan integral siguen pasando con Editorial exclusivo y sin perder funciones.
