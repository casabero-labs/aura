# Casabero Editorial · brechas del showcase necesarias para Aura

**Estado: ESPECIFICACIÓN PROPUESTA · NO IMPLEMENTADA.** Inspección estática: 14 de septiembre de 2026. [Plan principal](2026-09-14-aura-migracion-editorial-integral.md) · [Orden de ejecución](2026-09-14-aura-editorial-orden-ejecucion.md).

**Destino de Aura: Editorial exclusivo.** Todos los patrones y estados necesarios deben resolverse dentro de Editorial, incluidos datos densos, Laboratorio, modo oscuro y PDF. Una brecha del catálogo se completa en Editorial; no se cubre importando un patrón visual Ink/Warm. El catálogo del estándar puede conservar sus otros temas para otros productos, pero Aura no los incorpora ni ofrece alternancia hacia ellos.

Referencia: `/Users/casabero/Documents/GitHub/estandar-casabero/examples/frontend/showcase-editorial.html`, HEAD local `db8c6ae4b4e30043b778e90fd93188cde26c76e5`. La revisión de HTML/CSS/JS no equivale a validación visual o de teclado; la apertura `file://` fue bloqueada por la política del navegador.

## Qué está cubierto

Secciones presentes: `#tokens`, `#tipo`, `#boton`, `#overlays`, `#formulario`, `#estado`, `#tabla`, `#ficha`, `#seccion`, `#progresos`, `#aplicaciones`.

Hay paleta, tres presets de demostración, botón outline/ghost, modal/drawer, campo con ayuda/error, metadata de estado, tabla básica, ficha, secciones con filete, progresos y workbench con pestañas. Existe modo oscuro y reduced motion. **No se propone recrear estas bases.** Se propone ampliarlas y completar contratos de interacción antes de usarlas en Aura.

La tabla de `#tabla` tiene dos filas y tres columnas; no demuestra densidad, filtros ni selección. `#formulario` demuestra un input de número predial; no demuestra la configuración compuesta de un proveedor. `#aplicaciones` cambia contenido ilustrativo de GIS/telemetría/auditoría, no reproduce decisiones, datos o exportación de Aura. Los términos prediales no deben trasladarse al producto.

## Regla para toda incorporación

Cada patrón debe quedar visible, navegable y enlazado desde **el mismo showcase Editorial**, con ancla estable. Puede reutilizar código auxiliar, pero la evidencia no puede quedar solo en una rama de Aura o en una imagen. Mostrar anatomía, casos válidos, fallos, estados de teclado, móvil, oscuro y cómo recuperarse. Los controles de simulación se rotulan como demo y se separan del patrón de producto.

Usar contenido sintético neutral o de calidad de datos; ningún nombre, matrícula o identificador personal real. Mantener un solo preset en cada pieza. Las 18 entradas siguientes son familias de patrones y variantes; no exigen 18 librerías ni 18 pantallas nuevas de Aura. Las composiciones se gobiernan por el [diseño UI/UX](2026-09-14-aura-editorial-ux-design.md).

## Catálogo de ampliaciones

| ID / prioridad | Cobertura actual | Sección propuesta | Necesidad de Aura |
|---|---|---|---|
| EC-01 / P0 | Parcial: nav del catálogo, no shell completo de producto | `#navegacion-producto` | Inicio/Auditoría/Laboratorio/Configuración, ubicación actual y sesión |
| EC-02 / P0 | Parcial: barra de etapas animada | `#flujo-etapas` | Etapas navegables y rama de remediación opcional |
| EC-03 / P0 | Ausente como patrón de archivo | `#carga-archivos` | CSV inicial y evidencia de retorno |
| EC-04 / P0 | Parcial: un campo y switch de tema | Ampliar `#formulario` con `#configuracion` | Select, checkbox, radio, textarea, parámetros/modelo, ayuda/error |
| EC-05 / P0 | Parcial: metadata y simulaciones de progreso | Ampliar `#estado` y `#progresos` | Vacío, error, bloqueado, parcial, cancelado, reintento, actividad real |
| EC-06 / P0 | Parcial: tabla estática mínima | `#tabla-analitica` | Comparar hallazgos/columnas/corridas con filtro, orden, selección y detalle |
| EC-07 / P0 | Ausente como contrato de decisión | `#revision-aprobacion` | Revisar/aprobar/rechazar por acción, exclusiones y cierre sin cambios |
| EC-08 / P0 | Parcial: algunos códigos en ficha | `#codigo-evidencia` | Código/JSON/logs/hash, copiar, detalle técnico y procedencia |
| EC-09 / P0 | Ausente | `#comparacion-verificada` | Antes/después, resueltos/persistentes/nuevos y validación de cadena |
| EC-10 / P1 | Parcial: ilustración de telemetría en workbench | `#graficas-datos` | Distribuciones, cajas/barras/matrices, selección accesible y dato equivalente |
| EC-11 / P0 | Ausente como flujo de entrega | `#exportacion` | Disponibilidad de PDF/CSV/JSON/ZIP y corrected.csv opcional |
| EC-12 / P0 | Parcial: modal y drawer básicos | Ampliar `#overlays` | Foco completo, formulario largo, confirmación destructiva, recuperación |
| EC-13 / P1 | Parcial: workbench genérico | `#campana-experimental` | Matriz de intentos, calentamientos, fallos, metodología y selección |
| EC-14 / P0 | Ausente como recuperación de sesión | `#recuperacion-sesion` | Sesión retomable, archivo por reimportar, nuevo análisis, error global |
| EC-15 / P1 | Sin ejemplo integral Web → impreso/PDF | `#informe-imprimible` | Portada, conclusiones, tablas multipágina, figuras/código y referencias |
| EC-16 / P0 | Parcial: toggles globales, sin banco exhaustivo | `#estados-y-adaptaciones` | Referencia completa de variantes, contraste, teclado y móvil |
| EC-17 / P0 | Parcial: ficha/workbench ilustrativos | `#documento-operativo` | Contexto, resumen, selección, detalle y acciones con reflujo móvil |
| EC-18 / P0 | Ausente como recorrido entre contextos | `#configuracion-contextual` | Ajustar una dependencia desde la tarea y volver conservando estado |

P0 significa necesario antes de migrar el consumidor afectado. P1 significa una dependencia de fases posteriores que también debe cerrarse para declarar la migración integral.

### EC-01 — Navegación de producto

**Mostrar:** wordmark con tres elipses, cuatro destinos genéricos, activo con filete, enlace de salto, control de modo y estado de sesión separado de la navegación.

**Variantes:** desktop 52 px; móvil marca en primera línea y destinos en segunda línea con scroll local; títulos largos; teclado; sesión nueva/restaurada. No abreviar marca durante scroll.

**Aceptar cuando:** todos los destinos son alcanzables, `aria-current` corresponde a la vista, el foco no queda oculto y el documento no desborda a 320 px/zoom 200 %. No copiar la cabecera del catálogo como navegación de aplicación.

### EC-02 — Etapas y rama opcional

**Mostrar:** lista ordenada de etapas con actual/completada/pendiente/bloqueada; botón real si hay navegación, texto si no la hay; motivo accesible cuando no se puede avanzar.

**Variantes:** cinco etapas principales y rama opcional de tres acciones; retorno al informe; fallo de etapa; etapa sin resultado. Las barras de avance cuantitativo son otra pieza.

**Aceptar cuando:** se sabe dónde está el usuario, qué puede hacer y cómo salir de la rama; teclado opera solo destinos permitidos y no altera el estado de negocio.

### EC-03 — Carga de archivos

**Mostrar:** selección nativa y arrastre, nombre/tamaño/tipo, ayuda antes de elegir, área de error y acción de reemplazar/reintentar. Dos ejemplos: un CSV y un par CSV + recibo JSON.

**Variantes:** vacío, seleccionado, arrastrando, procesando, aceptado, inválido, parcial (falta uno), rechazado, reimportación tras recarga. No inventar porcentajes durante parseo sin dato medible.

**Aceptar cuando:** se completa con teclado, el input tiene asociación accesible, cada archivo conserva identidad visible y el error permite corregir sin perder el resto del contexto.

### EC-04 — Formularios y proveedor

**Mostrar:** label/ayuda/error, select nativo, radio group, checkbox individual y grupo, campo numérico con unidad/rango, textarea, campo sensible con mostrar/ocultar, switch con nombre y estado. El catálogo usa valores ficticios, nunca credenciales reales.

**Composición:** proveedor → modelo disponible → parámetros → verificar conexión → resultado → aplicar. Cambiar opciones no ejecuta una inferencia.

**Variantes:** válido/inválido, disabled con motivo, readonly, requerido, guardando/guardado, sin modelos, modelo no instalado, desconexión y reintento. Errores vinculados con `aria-describedby` y `aria-invalid`.

**Aceptar cuando:** targets táctiles, foco de campo en un solo perímetro y errores específicos; entradas largas se recomponen en móvil, sin sidebar alto con doble scroll.

### EC-05 — Estados y operaciones largas

**Mostrar:** éxito, error, aviso, vacío, sin coincidencias, bloqueado por requisito, parcial, cancelado y esperando insumo externo. Cada uno: qué pasó, alcance y siguiente acción.

**Progreso:** determinate con total conocido; indeterminate sin `aria-valuenow`; pasos completados/total; tiempo transcurrido; finalización/fallo. Mensajes persistentes y live region moderada, sin anunciar cada frame.

**Aceptar cuando:** una operación >800 ms tiene actividad comprensible; cancelar explica su alcance; un porcentaje refleja trabajo conocido; reduced motion mantiene comprensión. Copiado/descarga/guardado muestran éxito o fallo localmente, no solo un toast efímero.

### EC-06 — Tabla analítica/transaccional

**Mostrar:** caption, resumen y unidades; al menos 30 filas de muestra y 8 columnas para demostrar overflow local; filtros, ordenar con `aria-sort`, selección inequívoca y panel/fila de detalle. Añadir paginación como variante del catálogo; Aura solo la adopta si su recorrido y volumen lo justifican.

**Variantes:** vacía, cargando, error, sin coincidencias, selección, texto largo, valores no disponibles, cifras tabulares, vista numérica/comparativa y tabla de acciones. No confundir “0” con “no medido”.

**Aceptar cuando:** filtros y orden conservan selección coherente o comunican el cambio; acción por fila tiene nombre; datos completos accesibles a 320 px sin miniaturizar texto. Si se virtualiza, demostrar teclado/lector y acceso al conjunto completo antes de adoptarlo.

### EC-07 — Revisión y aprobación humana

**Mostrar:** acción propuesta, columna real, evidencia, alcance, consecuencia y decisión pendiente/aprobada/rechazada/excluida. Resumen de decisiones y botón explícito para continuar.

**Variantes:** plan vacío; ninguna aprobada; mezcla de decisiones; cambio de plan que invalida aprobación previa; acción destructiva; revisión de código. El patrón no aprueba todas por defecto ni confunde checkbox de selección con autorización.

**Aceptar cuando:** aprobar y ejecutar son pasos visualmente distintos; cerrar sin cambios es accesible; la confirmación sensible explica exactamente qué se cambiaría y en qué copia.

### EC-08 — Código, trazabilidad y copia

**Mostrar:** bloque de código/JSON con lenguaje y numeración opcional, scroll local, copiar contenido íntegro, descargar cuando exista; ficha hash/archivo/tamaño/procedencia; logs con hora/nivel/mensaje.

**Variantes:** cadena SHA-256 larga, JSON grande, error de portapapeles, copiado confirmado, truncado con acceso al contenido completo, log vacío/cargando/fallido. El código tiene números de línea separados de los bytes copiados.

**Aceptar cuando:** copiar se puede operar con teclado y se verifica su contenido; hashes completos recuperables; no colorear peligrosidad mediante un simple match de texto; selección/copiar de una tabla no cambia la evidencia.

### EC-09 — Comparación y verificación

**Mostrar:** fuente/resultado, identidad de archivos, indicadores con unidades y diferencia; listas resueltos/persistentes/nuevos; estado independiente de recibo, integridad y reauditoría.

**Variantes:** sin ejecución, esperando resultado, validando, verificado, inválido, reauditoría fallida, cambio de archivo, mejor score con problema nuevo. Móvil presenta antes/después como secuencia legible.

**Aceptar cuando:** mejora de score no implica “seguro”; cero hallazgos nuevos y valores preservados se explican con la evidencia disponible; no hay check global engañoso por validar solo un recibo.

### EC-10 — Visualización de datos

**Mostrar:** barra/distribución, box plot cuando aplique, matriz comparativa y gráfico de resultados seleccionables. Título, pregunta, ejes, unidad, leyenda, fuente, resumen y tabla equivalente.

**Variantes:** cero, no disponible, única serie, muchas series, valores extremos, selección/foco, tooltip accesible sin depender del hover, comparación en escala de grises y oscuro.

**Aceptar cuando:** la interacción mantiene sincronizados gráfico/tabla/detalle, las escalas no cambian semántica y etiquetas/series siguen distinguibles al imprimir. No declarar el SVG ilustrativo del workbench como cobertura de analítica real.

### EC-11 — Centro de exportación

**Mostrar:** lista editorial de entregables con propósito, formato, contenido y disponibilidad; estado preparando/listo/falló; botón de descarga contextual; opción explícita de incluir archivo corregido.

**Variantes:** auditoría sin LLM, informe disponible, sin script, sin archivo corregido, evidencia completa, error de generación y ZIP. Descarga de cada pieza conserva la identidad del análisis.

**Aceptar cuando:** se entiende qué se recibirá antes de pulsar; existe recuperación; marcar “descargado” solo con evidencia disponible y sin prometer que el sistema conoce la apertura posterior del archivo.

### EC-12 — Overlays completos

**Mostrar:** modal nativo o contrato equivalente, drawer de ayuda/configuración, confirmación destructiva y cierre con cambios sin guardar.

**Variantes:** contenido largo, error dentro del formulario, acciones disabled con motivo, 320 px, oscuro y reduced motion. Confirmación sensible inicia foco en la opción segura.

**Aceptar cuando:** Tab/Shift+Tab no salen de un modal; fondo inerte; Escape respeta protección de cambios; foco vuelve al disparador; título/descripción accesibles; scroll/foco no se ocultan bajo acciones fijas. Reutilizar la buena implementación de Aura solo después de demostrarla en el catálogo.

### EC-13 — Campaña experimental

**Mostrar:** preflight/protocolo → matriz de modelos/métodos/repeticiones → estados por intento → resumen → comparación → selección de configuración/exportación.

**Variantes:** sin ground truth, sin modelo, calentamiento excluido, intento en curso/fallido, campaña parcial/completa, resultados muy próximos, tabla sin suficiente evidencia para recomendar.

**Aceptar cuando:** unidades, número de intentos y validez están separados; la clasificación no oculta fallos; aplicar una configuración no ejecuta la siguiente tarea. La demo usa una campaña sintética pequeña y precomputada.

### EC-14 — Recuperación y continuidad

**Mostrar:** sesión recuperada con su alcance, archivos que deben reimportarse, ausencia de resultados, error global con conservar/reintentar, volver al informe y nuevo análisis.

**Variantes:** regreso entre vistas, recarga, archivo distinto, cancelar nueva sesión y destrucción confirmada de datos de demo.

**Aceptar cuando:** cancelar deja contexto intacto, el usuario sabe qué se conservará/perderá y no se promete guardar bytes no persistidos. El showcase no accede al storage de Aura.

### EC-15 — Informe imprimible y documento descargado

**Mostrar:** ejemplo de informe con resumen, alcance, tabla larga, gráfica con fuente, conclusiones, evidencia técnica y paginación. Vista impresa y PDF real generado para revisión, enlazados desde la sección.

**Variantes:** informe corto/largo; determinista/diagnóstico/campaña; texto con acentos y códigos largos; impresión desde oscuro.

**Aceptar cuando:** todas las páginas se revisaron; tabla no recortada, texto seleccionable, portada sobria, títulos no huérfanos. Apariencia web no certifica PDF etiquetado: declarar por separado cualquier límite de accesibilidad documental.

### EC-16 — Banco de estados y adaptaciones

**Mostrar:** índice por patrón y selector de escenario de demo con estado explícito; vista de controles normal/hover/focus/active/disabled/loading/error/success; referencias claro/oscuro/móvil/fallback.

**Aceptar cuando:** cada EC tiene norma, ancla, estados, ruta de verificación y fecha/SHA; sin enlaces muertos o controles de adorno. La tabla de cobertura diferencia implementado de validado; no declarar accesibilidad por tener `aria-*` en código.

### EC-17 — Documento operativo y selección con detalle

**Mostrar:** shell de tarea con destinos de trabajo y utilidades, identidad de análisis, hitos, conclusión/resumen, tabla o índice seleccionable, detalle asociado y zona de acciones. Distinguir lectura de comparación de datos.

**Variantes:** sesión nueva/restaurada, selección vacía/activa, resultado pendiente/disponible, detalle largo y retorno. Desktop permite comparación cuando existe ancho útil; móvil recompone en contexto → resumen → selección → detalle → acciones. No necesita una sidebar permanente.

**Aceptar cuando:** se identifica objeto y tarea; seleccionar y volver conserva el contexto; la utilidad no compite con el destino principal; no hay datos recortados ni doble scroll involuntario. Demostrar en el showcase una composición completa y no solo componentes aislados.

### EC-18 — Configuración contextual y retorno al trabajo

**Mostrar:** una tarea con requisito pendiente → abrir configuración esencial → editar → validar → aplicar o cancelar → volver al contexto. La configuración completa permanece accesible desde la versión contextual.

**Variantes:** cambios sin guardar, validación fallida, modelo no disponible, aplicar con éxito, cancelar y navegación atrás. Valores sintéticos; no conectar con proveedores reales desde la demo.

**Aceptar cuando:** contexto de origen y borrador se conservan según la acción; error específico permite corregir; aplicar no inicia el proceso siguiente; regresar orienta foco/scroll y muestra si el requisito quedó resuelto. Complementar EC-01, EC-04, EC-12 y EC-14.

## Correcciones del ejemplo existente antes de copiar interacciones

Hallazgos de fuente; la reproducción visual/teclado queda pendiente. No describen una certificación de toda la página.

| ID | Evidencia de código | Corrección requerida |
|---|---|---|
| RC-01 | `openModal`/`openDrawer` enfocan un control, `closeOverlays` solo cambia clases/hidden; no se observa trampa de foco, `inert` o restauración de disparador | Completar semántica modal, cierre seguro, foco inicial/retorno y Tab/Shift+Tab |
| RC-02 | Tabs de `#aplicaciones` tienen `role=tab`/`aria-selected`, sin relación `aria-controls`/tabpanel ni navegación con flechas en el script inspeccionado; capas usan `div onclick` | Completar patrón tabs y controles nativos/teclado de selección |
| RC-03 | Submit de `npnForm` alterna `.is-invalid`; no cambia `aria-invalid` ni comunica el error mediante un estado accesible observado | Asociar error y estado real, activar anuncio apropiado y limpiar estado al corregir |
| RC-04 | Barras demo actualizan anchos/textos con intervalos; no aparecen roles/valores de progreso; copy pide cifra incluso para trabajo desconocido | Separar demo de actividad real; `progressbar` accesible determinate/indeterminate, sin porcentajes inventados |
| RC-05 | `.cb-track` declara 2 px; `STATUS.md` prescribe track de estado 4 px | Alinear barra de proceso con norma; mantener track de lectura distinto y documentado |
| RC-06 | `:focus`/`:focus-visible` global eliminan outline, luego se repone solo para lista de selectores; inputs/workbench compacto incluyen targets pequeños | Auditar todos los controles y links, eliminar huecos de foco; mostrar variante táctil y compacta con uso explícito |

No convertir “no aparece en esta demo” en “no existe en todo el estándar”: TABLE, STATUS, FORM_CONTROL, NAVIGATION y WEB ya definen parte de estas capacidades. La primera operación de F1 es decidir ampliación de ejemplo frente a norma realmente nueva.

## Orden de construcción y aceptación del showcase

Secuencia autorizada en el [addendum de loops](2026-09-14-aura-editorial-orden-ejecucion.md). No hace falta cerrar las 18 familias antes de Inicio.

1. LOOP-01: RC-01, RC-04, RC-06; EC-01, EC-03, EC-05, EC-14, EC-17.
2. LOOP-02: RC restantes al tocar su sección; EC-02, EC-04, EC-06–EC-09, EC-11, EC-12, EC-18; EC-15 de auditoría.
3. LOOP-03: EC-10 resto, EC-13, EC-15 de laboratorio, EC-16.

Para cada bloque: fuente/copy sintético → anatomía/estados → interacción → adaptación móvil/oscuro → revisión humana → validadores → evidencia y enlace estable. El usuario puede crear el mínimo de un loop en el estándar antes de autorizar ese loop en Aura; el plan del producto consume esos resultados sin inventar variantes locales aisladas.

**Cierre requerido al final de LOOP-03:** 18 familias con disposición explícita y seis correcciones resueltas/verificadas; cada consumidor conservado de Aura tiene patrón suficiente. No hace falta copiar la lógica de auditoría al showcase: escenarios simulados bien rotulados demuestran presentación y comportamiento, mientras la integridad real se prueba en Aura.
