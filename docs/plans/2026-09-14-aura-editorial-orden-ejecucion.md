# Aura Editorial · orden de ejecución en tres loops

**Estado: ADDENDUM DE SECUENCIA · AUTORIZADO COMO ORDEN · IMPLEMENTACIÓN NO INICIADA.** 14 de septiembre de 2026.

Este documento no sustituye el paquete del 14 de septiembre. Gobierna **en qué orden** se ejecuta cuando el usuario lo pida. Las especificaciones, invariantes y criterios de aceptación siguen viviendo en:

- [Diseño UI/UX](2026-09-14-aura-editorial-ux-design.md) — U01–U09 y contratos de retorno.
- [Migración integral](2026-09-14-aura-migracion-editorial-integral.md) — F0–F9, exclusividad, aliases, matriz J01–J20.
- [Brechas del showcase](2026-09-14-editorial-showcase-brechas.md) — EC-01–EC-18 y RC-01–RC-06.
- [Inventario](2026-09-14-aura-editorial-inventario.md) — 70 componentes; vigencia runtime pendiente de F0.

No cambia la interfaz, el catálogo, contratos, datos ni campañas. No es autorización de implementación ni de publicación.

## 1. Qué cambia y qué no

| Conservado | Cambiado por este addendum |
|---|---|
| Editorial exclusivo al cierre; cero Ink/Warm en código entregable | El catálogo **no** se completa entero antes del primer consumidor |
| Invariantes funcionales del plan integral §4 | Tres loops cerrados por recorrido humano, no F0→F9 como única cola |
| U01–U09 como arquitectura de rutas | Laboratorio al final, no en paralelo con Inicio |
| EC/RC como especificaciones | Cada loop lleva solo el mínimo EC de su recorrido |
| Matriz J01–J20 y Human-First UX | El cierre de un loop es el camino humano + E2E, no la lista de archivos del diseño §9 |
| No publicar un híbrido | Un loop intermedio es trabajo de desarrollo; no se entrega como producto migrado |

La frase del plan integral «catálogo completo antes de su adopción en producto» queda **acotada**: no se migra un consumidor cuyo patrón P0 siga indefinido; no se exige EC-01–EC-18 resueltos antes de tocar Inicio.

## 2. Registro de loops

| Loop | Objetivo | Superficies | Catálogo mínimo | Fases cubiertas | Caminos humanos | Estado |
|---|---|---|---|---|---|---|
| LOOP-01 | Empezar o reanudar y cargar un CSV en un shell Editorial | U01, U02, hueco de U09 | EC-01, EC-03, EC-05, EC-14, EC-17 | F0, F2, F3 parcial, F4 carga | J01 (hasta carga), J02, J11, J14, J15 | PENDIENTE |
| LOOP-02 | Perfil → diagnóstico → informe → exportar; corrección como última tajada | U03, U04, U05, U07, U06 | EC-02, EC-04, EC-06–EC-09, EC-11, EC-12, EC-18; EC-15 auditoría | F4 resto, F5, F6, F8 parcial | J03–J10, J16 (PDF auditoría), J18–J20 | PENDIENTE |
| LOOP-03 | Laboratorio por estado; utilidades completas; exclusividad | U08, U09 | EC-10 resto, EC-13, EC-15 laboratorio, EC-16 | F3 resto, F7, F8 resto, F9 | J12, J13, J16 resto, J17 | PENDIENTE |

Cada loop sigue `DISCOVER → PLAN → EXECUTE → VERIFY → ITERATE → CLOSEOUT` (`standards/ai/LOOP_ENGINEERING.md`). Máximo tres iteraciones automáticas por fase; un cambio de alcance por loop, documentado.

Al arrancar LOOP-01, crear el diario de ejecución previsto por F0: `docs/plans/2026-09-14-aura-editorial-ejecucion.md`. Ese archivo registra estado y evidencia; este addendum no lo sustituye.

## 3. Contratos transversales (desde LOOP-01)

Aplicar en el primer loop y no reabrirlos como estilo local en los siguientes.

**Tema y tipo**

- `data-casabero-theme="editorial"` en `html`; `data-theme` solo `light|dark`.
- Preset Web estándar: Source Serif 4 en títulos y conclusiones; Source Sans 3 en nav, botones, formularios, tablas y metadata. `--font-sans` permanece sans.
- No copiar el serif extra del catálogo al chrome de Aura. No copiar contenido predial, gaceta ni identidad de Karta.
- Sin hero de estadísticas. Inicio es operativo, no portada comercial.

**Foco, geometría y movimiento**

- Campos: un solo filete inset de 2 px (`box-shadow: inset 0 0 0 2px`). Nunca borde + outline con offset.
- Botones y enlaces: anillo 2 px con hueco de canvas.
- Botones con etiqueta de estado (p. ej. Ver predio / Cargando…): geometría estable; el ancho es el del verbo más largo, no el del texto visible.
- Movimiento editorial: `transform` y `opacity`; `--editorial-motion-fast` 150 ms, `--editorial-motion-base` 220 ms; curva del catálogo `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` y `--motion-enter: 280ms` si faltan en `tokens.css`, añadirlos allí, no solo en Aura.
- Progreso con `scaleX`, no animar `width`. Confirmación destructiva: shake 2 px / 280 ms.
- Overlays: modal con filete superior `scaleX` y entrada 6 px; drawer con filete izquierdo `scaleY` y desliz. Configuración abre **drawer**, no un modal que cubre la tarea.
- `prefers-reduced-motion`: el estado y el mensaje siguen siendo comprensibles.

**Impeccable**

Localizada en `~/.claude/plugins/cache/impeccable/impeccable/1.2.0/.claude/skills/`. El contrato persistente está en `CLAUDE.md` (Design Context). Durante cada loop, aplicar `frontend-design`, `polish`, `quieter` y `animate` sobre esas superficies, sujetos a ese contexto. No `bolder` ni `colorize` salvo instrucción explícita. No afirmar un pase global sobre U01–U09: el diseño permanece propuesto hasta que cada loop lo materialice y se verifique.

**Catálogo**

Los patrones se completan en `estandar-casabero/examples/frontend/showcase-editorial.html`, con ancla estable. Aura no clona el catálogo ni el catálogo clona Aura. Datos sintéticos declarados. Gate: no migrar un consumidor cuyo EC P0 de ese loop siga sin definir o sin evidencia de teclado/oscuro/móvil.

## 4. LOOP-01 — Inicio y carga

GOAL:
Una persona sin sesión empieza una auditoría; una persona con sesión reanuda. Carga un CSV válido y ve identidad de archivo. Un CSV inválido muestra causa y reintento en la misma sección. El shell tiene marca AURA, dos destinos de trabajo (Auditoría, Laboratorio) y Configuración/Ayuda como utilidades etiquetadas que abren drawer y devuelven el foco. Editorial es el contrato visual de esas superficies. Laboratorio puede existir como destino; no se rediseña su interior.

CONTEXT:
- Este addendum; diseño U01, U02, §4 navegación, §6 contratos; plan integral §3–§5, F0, F2, F3, F4 carga, J01/J02/J11/J14/J15.
- Showcase EC-01, EC-03, EC-05, EC-14, EC-17; RC-01, RC-04, RC-06.
- `DESIGN.md` (aún Warm Terminal + Archive, `showcase.html`); `src/index.css`, `src/index.html`, `src/App.tsx`, `AuraMark`, `FileUpload`, `ProgressDisclosure`, `IngestionEvidenceCard`, `PipelineProgress`, `DestructiveSessionDialog`, `SettingsPanel`/`HelpCenter` solo como hueco de utilidad.
- Estándar: `EDITORIAL.md` 1.2, `DESIGN_SYSTEM_EDITORIAL.md`, `WEB.md`, `NAVIGATION.md`, `FORM_CONTROL.md`, `BUTTON.md`, `STATUS.md`, `HUMAN_FIRST_UX.md`.
- Revalidar HEAD de Aura y del estándar al arrancar (referencia de planificación: Aura `96a03b6`, estándar `db8c6ae`).

FOUNDATIONS:
- Autorización humana, preservación de valores y evidencia no se tocan.
- Cero Ink/Warm en preferencias nuevas; no publicar híbrido.
- Una sesión; no inventar historial.
- Recarga declara reimportación si no hay File persistido.
- Laboratorio como destino no dispara campaña ni diagnóstico.

SCOPE:
- F0: SHA, inventario runtime, baseline de Inicio/Carga, diario de ejecución, evidencias en `docs/product/aura/evidence/editorial-migration/`.
- Catálogo mínimo LOOP-01 y tokens de movimiento si faltan.
- `DESIGN.md` Editorial exclusivo; tokens/foundations/shell CSS; fuentes depuradas; favicon alineado con las tres elipses.
- Inicio con/sin sesión; carga; progreso/error reales; recuperación de sesión; nav 52 px / móvil dos líneas.
- Drawer de configuración/ayuda: abrir, Escape, backdrop, retorno de foco. No la composición completa de proveedor/modelo.

OUT OF SCOPE:
- Interior de Perfil, Diagnóstico, Informe, Exportación, Remediación, Laboratorio.
- PDF. EC-02, EC-04 compuesto, EC-06–EC-13, EC-15, EC-16 banco exhaustivo, EC-18.
- Zustand/React Query, V3, nueva campaña, redesenho de marca.
- Overrides al final de `src/index.css` como atajo.

ACTION:
1. Discover: revalidar HEAD, inventario y baseline F0.
2. Plan: corte de archivos y pruebas de este loop; no ampliar a informe.
3. Execute: catálogo mínimo → tokens/`DESIGN.md` → shell → carga.
4. Verify: typecheck/build, pruebas de nav/carga, E2E J01/J02/J11/J14/J15, claro/oscuro, 390 y 1280, 320, teclado, reduced-motion.
5. Iterate dentro del alcance.
6. Closeout: diario, evidencias, siguiente prompt = LOOP-02.

FEEDBACK:
- E2E humano: abrir → entender → cargar fixture → ver identidad o error accionable → reanudar o confirmar destrucción de sesión. Inputs conservados tras render.
- Contraste medido en botones reales, no solo el token.
- Estilos computados Editorial; primer render sin flash Ink/Warm en el shell.
- Catálogo: anclas EC-01/03/05/14/17 navegables.

STOP CONDITION:
Cierra cuando J01 (hasta carga), J02, J11, J14 y J15 pasan con evidencia; `DESIGN.md` prescribe Editorial; el shell no ofrece tema Ink/Warm. Se bloquea si F0 no puede abrir Inicio/Carga, si un EC P0 de este loop sigue indefinido, o si hace falta tocar el motor de ingestión para «arreglar» estilo.

HUMAN GATE:
Revisión visual de Inicio con/sin sesión y de carga válida/inválida, 390 y 1280, claro y oscuro. Autorización expresa antes de LOOP-02.

ROLLBACK:
Revertir commits del loop en Git. No hay publicación intermedia.

## 5. LOOP-02 — Informe y exportar

GOAL:
Con un CSV válido, la persona lee el perfil (conclusión y columnas), obtiene o omite diagnóstico, lee el informe con la conclusión primero, y exporta sin corregir. La rama «Corregir una copia» es opcional, explícita y última. Configurar proveedor desde la tarea y volver conserva archivo y campos. Cancelar un diagnóstico no deja que una respuesta vieja pise la nueva.

CONTEXT:
- U03–U07; plan integral F4 resto, F5, F6, F8 auditoría; J03–J10, J16 auditoría, J18–J20.
- EC-02, EC-04, EC-06, EC-07, EC-08, EC-09, EC-11, EC-12, EC-18; EC-15 para PDF de auditoría/determinista.
- `ProfileStep`, `ColumnStatsPanel`, `DiagnosisStep`, `diagnosis/*`, `DiagnosticReportStep`, exportación en `App`, rama V2 de remediación, generadores PDF de auditoría.
- Contratos transversales ya cerrados en LOOP-01.

FOUNDATIONS:
- Auditoría determinista usable sin LLM.
- Remediación opcional; exportar no exige script.
- Aprobar ≠ ejecutar; descargar ≠ verificar; recibo válido ≠ integridad semántica.
- Preservar `001`, `120.00`, acentos, vacíos y delimitadores.
- `verifiedEvidence` / `verifiedExecution` al ir y volver informe ↔ exportación.
- No alterar scores, umbrales ni ground truth.

SCOPE:
- Catálogo mínimo LOOP-02.
- Perfil como resumen + tabla/detalle (U03).
- Diagnóstico con configuración contextual (U04, EC-18).
- Informe conclusión-primero (U05).
- Exportación por propósito (U07).
- Rama U06 completa, al final del loop, no mezclada con el camino feliz.
- PDF determinista y de diagnóstico.

OUT OF SCOPE:
- Interior de Laboratorio y transferencia lab → auditoría.
- PDF de campaña. EC-13. Banco EC-16 exhaustivo.
- Rediseño de protocolo LLM o V3.
- Extraer archivos del diseño §9 si un solo consumidor no lo justifica.

ACTION:
1. Discover: baseline de perfil/informe/exportación y de la rama opcional.
2. Plan: camino feliz primero; U06 como última tajada.
3. Execute: catálogo → perfil → diagnóstico → informe → exportación → U06 → PDF auditoría.
4. Verify: pruebas citadas en F5/F6/F8; E2E J03–J10, J18–J20; PDF página a página en fixture corto y largo.
5. Iterate.
6. Closeout: diario; siguiente prompt = LOOP-03.

FEEDBACK:
- Conclusión localizable antes del detalle de invocación.
- Exportar sin corregir produce piezas reales; manifiesto coherente.
- U06: aprobar y ejecutar distinguibles; plan vacío/rechazado cierra sin cambios; fixture 5→4 filas conserva `001` y `120.00`.
- Configuración contextual no dispara inferencia.
- Geometría estable en botones de proceso (Iniciar / Cargando… / Cancelar).

STOP CONDITION:
Cierra cuando el camino feliz y la rama opcional pasan J03–J10 y J18–J20 con E2E, y los PDF de auditoría son legibles. Se bloquea si un patrón P0 de este loop no está en el catálogo, si una prueba inyecta estado para fingir el recorrido, o si el estilo exigiría cambiar autorización o preservación.

HUMAN GATE:
Revisión de Perfil denso, Informe determinista y asistido, Exportación, y una aprobación de acción. 390 y 1280, claro y oscuro. Autorización expresa antes de LOOP-03.

ROLLBACK:
Revertir el loop. La rama de corrección no se publica a medias: o el loop cierra U06 o se documenta `BLOQUEADO` sin ofrecerla como avance.

## 6. LOOP-03 — Laboratorio

GOAL:
Una campaña nueva, en curso o completada muestra jerarquía distinta y sigue siendo el mismo expediente. Seleccionar una corrida con teclado sincroniza gráfico, tabla y detalle. Aplicar configuración no inicia diagnóstico. Utilidades (configuración completa, ayuda, registro, `?view=ollama-setup`) son Editorial y devuelven al origen. Al cierre, Aura no contiene implementación Ink/Warm.

CONTEXT:
- U08, U09; plan integral F3 resto, F7, F8 laboratorio, F9; J12, J13, J16 resto, J17.
- EC-10 resto, EC-13, EC-15 laboratorio, EC-16.
- `benchmark/BenchmarkCampaignLab` y consumidores; `experimentPdfReport`; `SettingsPanel`, `OllamaSetupStandalone`, `HelpCenter`, `AuditLogViewer`.
- Inventario: disposición final de cada uno de los 70 componentes.

FOUNDATIONS:
- Aplicar configuración de Laboratorio no inicia diagnóstico.
- Sin ground truth no hay campaña formal válida.
- No modificar pesos, ranking, protocolo ni dataset.
- No reescribir campañas históricas para actualizar su aspecto.
- Exclusividad Editorial es condición de cierre del producto, no de un commit intermedio.

SCOPE:
- Catálogo de campaña, gráficas densas y PDF de experimento.
- Laboratorio por estado (U08).
- U09 completa, incluido standalone.
- Impresión web y PDF de campaña.
- F9: retirar `editorial-pilot`, Ink/Warm, aliases vencidos; matriz de 70 componentes; Graphify update.

OUT OF SCOPE:
- Reabrir U01–U07 salvo regresión causada por este loop.
- Nueva campaña experimental real de 27 inferencias para verificar CSS.
- Migración de infraestructura o frameworks.

ACTION:
1. Discover: vigencia de paneles de laboratorio y de los 15 archivos sin camino.
2. Plan: estado de campaña primero; utilidades; retirada.
3. Execute: catálogo → lab → U09 → PDF → F9.
4. Verify: J12, J13, J16, J17; búsqueda de restos Ink/Warm en fuente, recursos, PDF y bundle; estilos computados.
5. Iterate.
6. Closeout: diario final; `DESIGN.md` y NEXT_STEPS alineados con el árbol.

FEEDBACK:
- Campaña mixta: fallos visibles, selección sincronizada, transferencia exacta sin inferencia.
- Standalone Ollama no depende de montar `App`.
- Cero rutas, flags o bloques Ink/Warm en el entregable. `--ink` solo si es el token Editorial.
- Cada componente inventariado: migrado o retirado con trazabilidad.

STOP CONDITION:
Cierra cuando J12, J13, J16 y J17 pasan y F9 no deja islas visuales. Se bloquea si falta oscuro Editorial, PDF de campaña, un auxiliar conservado sin migrar, o si Graphify/`scripts/validate` del estándar fallan sin registro.

HUMAN GATE:
Revisión de campaña mixta terminada, configuración contextual de lab y una pasada de exclusividad (claro/oscuro, PDF). Autorización expresa antes de publicar.

ROLLBACK:
Revertir F9 no puede dejar un híbrido publicable. Si la retirada no cierra, el producto sigue sin declararse migrado.

## 7. Mapa F0–F9 → loops

| Fase del plan integral | Loop | Nota de secuencia |
|---|---|---|
| F0 línea base | LOOP-01 inicio | Obligatoria al pedir ejecución |
| F1 catálogo | partido en los tres | Mínimo del recorrido, no las 18 familias de una vez |
| F2 fundamentos | LOOP-01 | `DESIGN.md` y tokens antes del shell |
| F3 shell y utilidades | LOOP-01 hueco; LOOP-03 U09 | Drawer en 01; formulario/ayuda/standalone en 03 |
| F4 carga y perfil | LOOP-01 carga; LOOP-02 perfil | No esperar el perfil para cerrar la carga |
| F5 diagnóstico, informe, exportación | LOOP-02 | Camino feliz |
| F6 remediación | LOOP-02 última tajada | No mezclar con el cierre sin corrección |
| F7 Laboratorio | LOOP-03 | Superficie de mayor riesgo Ink |
| F8 PDF | LOOP-02 auditoría; LOOP-03 lab | Mismo tema documental, dos cierres |
| F9 integración | LOOP-03 | Única declaración de migración integral |

## 8. Qué no hacer

- No empezar por Laboratorio, por PDF ni por un bloque de overrides al final de `src/index.css`.
- No esperar a tener las 18 familias EC para tocar Inicio.
- No copiar `showcase-editorial.html` como identidad de Aura ni `showcase-editorial-gaceta.html` como producto.
- No tratar la tabla de archivos del diseño §9 como criterio de cierre.
- No inyectar estado en el E2E del recorrido humano.
- No afirmar Impeccable aplicada sobre un diseño que aún no está implementado.
- No ejecutar LOOP-01 hasta que el usuario lo pida.

## 9. Próxima acción

Este addendum cierra la secuencia. La siguiente acción, **cuando se solicite ejecución**, es LOOP-01: F0 + catálogo mínimo + fundamentos + shell + carga.

Prompt ejecutable previsto (no correrlo ahora):

```text
Execute Aura Editorial LOOP-01 as specified in
docs/plans/2026-09-14-aura-editorial-orden-ejecucion.md.
Do not start LOOP-02. Follow LOOP_ENGINEERING. Use casabero-standards
search/use_tool. Apply Impeccable frontend-design, polish, quieter and
animate only on LOOP-01 surfaces. Close with human-route E2E evidence.
```
