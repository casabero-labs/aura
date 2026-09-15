# Aura · migración integral a Casabero Editorial — Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development` when available and explicitly authorized; otherwise execute this plan sequentially.

**Goal:** Convertir Aura íntegramente a Casabero Editorial 1.2 como su único sistema visual, retirando Ink y Warm del código de presentación, recursos y configuración, y conservando decisiones, datos, evidencia y recorridos completos.
**Architecture:** Sustitución completa del sistema visual mediante tokens Editorial canónicos y componentes migrados por recorridos; adaptadores solo transitorios. El catálogo se completa por loop (mínimo EC del recorrido) antes de adoptar esos consumidores, no las 18 familias de una vez. Ver [orden de ejecución](2026-09-14-aura-editorial-orden-ejecucion.md).
**Tech Stack:** React 19, TypeScript, CSS, Vite, Vitest, Testing Library, Playwright, D3/Recharts y jsPDF existentes.

---

## 1. Estado, alcance y punto de reanudación

**PRÓXIMO PLAN · PREPARADO PARA REVISIÓN · IMPLEMENTACIÓN NO INICIADA.** Fecha: 14 de septiembre de 2026.

Solicitud rectora: preparar una manera muy completa de migrar el aspecto de Aura a **Casabero Editorial**, usando `examples/frontend/showcase-editorial.html`, dejando el trabajo como próximo plan y explicando qué falta en el showcase para crearlo allí.

**Aclaración rectora del usuario:** «no quiero nada de ink o warm en aura. por eso esta migración debe ser completa». El resultado final es **Editorial exclusivo**, no un tema adicional, un piloto ni una capa que encubra sistemas anteriores. Esta aclaración gobierna cualquier redacción previa sobre conservar estilos, componentes históricos o compatibilidad.

**Ampliación de diseño autorizada:** reconsiderar íntegramente la disposición UI/UX actual. Navegación, jerarquía, distribución, densidad, agrupaciones y presentación de recorridos pueden cambiar; la estructura visual actual no es una restricción. El [diseño UI/UX](2026-09-14-aura-editorial-ux-design.md) desarrolla nueve superficies y prevalece sobre instrucciones anteriores de conservar posiciones o jerarquías. Se mantienen los invariantes funcionales de §4.

**Revisión con Impecable/Impeccable:** skill localizada en el plugin `impeccable` (`~/.claude/plugins/cache/impeccable/impeccable/1.2.0/.claude/skills/`). No era un bloqueo de planificación. El pase `frontend-design` / `polish` / `quieter` / `animate` se aplica en cada loop de ejecución, no como certificación previa del paquete.

### Exclusividad obligatoria al cierre

- Cero temas, selectores, rutas de configuración, flags o preferencias que activen Ink o Warm en Aura. Claro y oscuro son dos modos de Editorial.
- Cero bloques de tokens, reglas CSS, overrides, estilos inline, recursos o plantillas de presentación Ink/Warm conservados en el código entregable, aunque no estén activos. Retirar los adaptadores específicos del sistema anterior tras migrar consumidores; los nombres genéricos como `--ink` pueden permanecer si expresan únicamente el contrato Editorial canónico.
- Todo componente que permanezca en Aura se migra a Editorial, incluidos auxiliares, rutas condicionales, componentes legacy conservados, fixtures y pantallas de desarrollo. Lo confirmado como no utilizado se retira con sus estilos y pruebas obsoletas durante la ejecución, conservando su trazabilidad en Git. La clasificación no permite dejar islas antiguas.
- Todos los informes nuevos, impresión, gráficos, overlays, errores, carga y descargas usan Editorial. Ninguna plantilla o fuente anterior permanece por ser una superficie secundaria.
- `DESIGN.md`, ejemplos de desarrollo, pruebas visuales y documentación operativa prescriben únicamente Editorial. Los registros históricos y artefactos de evidencia ya emitidos se conservan como archivo inmutable, fuera del sistema visual del producto; no se reescribe la historia ni se modifica una campaña para aparentar la migración.
- No se publica una versión híbrida como avance de esta migración. Las fases son divisiones de trabajo y revisión; la entrega final exige retirar completamente los sistemas anteriores.

Esta entrega autoriza y realiza planificación documental. No cambia la interfaz, el showcase, contratos, datos ni campañas. La ejecución posterior comienza cuando el usuario la solicite; este documento no es una aprobación anticipada de implementación ni de publicación.

**Orden de ejecución autorizado:** [tres loops](2026-09-14-aura-editorial-orden-ejecucion.md) — Inicio+Carga → Informe+exportar → Laboratorio. Las fases F0–F9 siguen siendo las unidades de trabajo; el addendum las agrupa. Ninguna familia se cierra sin recorrido humano y evidencia de sus estados.

Documentos del paquete:

- [Orden de ejecución en tres loops](2026-09-14-aura-editorial-orden-ejecucion.md): secuencia autorizada; no sustituye este plan ni inicia implementación.
- [Diseño UI/UX y arquitectura de información](2026-09-14-aura-editorial-ux-design.md): nueve superficies, navegación propuesta y contratos de retorno/contexto.
- [Brechas y especificaciones para el showcase](2026-09-14-editorial-showcase-brechas.md).
- [Inventario exhaustivo de componentes](2026-09-14-aura-editorial-inventario.md).
- [Registro histórico del piloto y correcciones](2026-09-10-aura-correcciones-ux-editorial-registro.md). Sus cierres históricos no certifican esta migración global.

**Próxima acción concreta:** cuando el usuario solicite ejecución, empezar LOOP-01 (F0 + catálogo mínimo de Inicio/Carga + fundamentos + shell + carga). No completar EC-01–EC-18 antes de ese loop. No empezar añadiendo otro bloque de overrides al final de `src/index.css`.

## 2. Evidencia disponible y límites

| Fuente | Verificación del 14 de septiembre | Implicación |
|---|---|---|
| Aura | `main`, HEAD `96a03b67f8f07f0e061ed917e94b8ceb7c6de276` | Referencia local de este plan; revalidar antes de ejecutar |
| Historial local | `6b91f79` y `96a03b6` revierten `bc8000d` y `a1a0a08`; el árbol confirmado vuelve a `e4d7ed2` | No reaplicar los commits retirados como atajo. La referencia remota local marca `ahead 2`; no acredita publicación de los reverts |
| Estándar | HEAD local `db8c6ae4b4e30043b778e90fd93188cde26c76e5` | Se leyó la copia local; no se afirma sincronización remota |
| `src/index.css:1` | Declara Ink; fondo `#F6F8FB`, Inter en sans y serif, sombras y estados cromáticos | La base del producto aún requiere migración |
| `src/index.css:16319` | Piloto local blanco, Source Serif/Source Sans, `color-scheme: light` | Hay que absorberlo en un tema global y resolver oscuro |
| `ProfileStep`, `DiagnosticReportStep`, exportación en `App` | Usan `editorial-pilot` | Reutilizar trabajo previo, sin confundirlo con cobertura completa |
| `DESIGN.md` | Aún prescribe Warm, Terminal + Archive y showcase Warm | Deuda documental confirmada; actualizar cuando se implemente el nuevo contrato |
| `src/index.html` | Carga Inter, JetBrains, Playfair y Source; favicon distinto a `AuraMark` | Depurar fuentes y alinear favicon sin rediseñar la marca |
| Inventario estático | 70 TSX en `src/components`; 55 alcanzables por imports desde `src/index.tsx`, 15 sin camino detectado | Alcanzabilidad no prueba visibilidad ni desuso; incluye rutas condicionales y fixtures |
| CSS | 16.400 líneas, con capas históricas y overrides | Riesgo de cascada; migración por propiedad y consumidor, no sustitución masiva |
| Showcase | 11 secciones principales, tabla de dos filas, formulario de un campo, workbench ilustrativo | Base útil, cobertura operativa insuficiente para Aura |
| PDF | Generadores separados: determinista, diagnóstico y Laboratorio | CSS web no migra los documentos exportados |

Se inspeccionaron las entradas, imports y fuentes de los recorridos y generadores citados. Graphify se usó una vez como descubrimiento acotado; su resultado truncado solo orientó la búsqueda. La clasificación de componentes se contrastó con imports locales; no se leyó el grafo crudo.

**Antecedente a no repetir:** la revisión histórica de la migración retirada registró botones oscuros sobre fondo oscuro, scroll heredado de Perfil a Diagnóstico, CSS superpuesto y pruebas que inyectaban estados o descartaban resultados de accesibilidad incompletos. El historial de reversión se confirmó en Git; esos defectos históricos no se presentan como reproducidos en el código restaurado. Este plan añade gates de contraste en cada estado de botón, scroll/foco al cambiar de etapa, inspección del código confirmado y recorridos sin inyección de estado.

**Límites expresos:** no se ejecutó una campaña, no se revalidó el piloto en runtime, no se midió contraste nuevo y no se ejecutaron suites durante esta planificación. La política del navegador bloqueó la URL `file://` del showcase: la evaluación de brechas se basa en HTML/CSS/JS y normas, no en una inspección visual completada. F0/F1 deben producir esa evidencia mediante una superficie permitida; un bloqueo de política no se sortea con servidores alternativos, otro navegador o CDP.

Cambios preexistentes excluidos: `.DS_Store`, dos pruebas duplicadas ` 2.ts` y `src/contracts/llm/diagnosisInputPackageV2 2.ts`. En el estándar ya existía `graphify-out/cache/last_query_stamp`. No limpiar ni incorporar estos archivos por esta migración.

## 3. Autoridad y decisiones de diseño propuestas

Orden de autoridad:

1. Solicitud del usuario: **Editorial para todo Aura**.
2. `/Users/casabero/Documents/GitHub/estandar-casabero/standards/design/themes/EDITORIAL.md` (1.2).
3. `standards/design/media/WEB.md`, `standards/frontend/DESIGN_SYSTEM_EDITORIAL.md` y componentes aplicables.
4. `examples/frontend/tokens.css`: valores ejecutables.
5. `examples/frontend/showcase-editorial.html`: catálogo de referencia solicitado.
6. Aura y capturas previas: consumidores/evidencia, no nuevas normas.

El MCP Casabero confirmó la ruta del perfil Editorial mediante `search` y clasificó la tarea mediante `classify_task`. La clasificación amplia no implica incorporar frameworks, backend ni otros temas a una migración visual.

| Decisión | Especificación |
|---|---|
| Tema | `data-casabero-theme="editorial"` en `html`; `data-theme` reservado a `light` o `dark` |
| Preset web | Estándar: Source Serif 4 para lectura y títulos; Source Sans 3 para controles, navegación, ayudas, tablas y metadata |
| Fallback | Georgia/Times para serif, Arial/Helvetica para sans; mono del perfil para código y hashes |
| Claro | Canvas `#FFFFFF`; tinta `#191919`; secundaria `#4D4D4A`; metadata `#6B6B67`; líneas `#D9D9D4`/`#A7A7A0`; superficies puntuales `#F7F7F4`/`#FBFBF9` |
| Oscuro | Se conserva la opción existente; usar los tokens oscuros Editorial del perfil, con validación completa; no mantener islas blancas del piloto |
| Jerarquía | Objeto → resultado/conclusión → evidencia → decisión. Lectura entre 55 y 75 caracteres por línea; tablas a ancho útil |
| Tipo | Lectura 17–19 px; metadatos/tablas 13–15 px; mensajes operativos 14–16 px. Escala fluida de títulos, sin comprimir texto para hacer caber desktop |
| Secciones | Filete, título y espacio; numeración donde oriente. Eliminar cajas operativas redundantes, sin perder agrupación semántica |
| Acciones | Una primaria por contexto, outline o relleno excepcional; secundarias subordinadas; radio web operativo 0–4 px |
| Estados | Texto + icono/filete/posición. Severidad, selección y verificación deben entenderse en monocromo |
| Gráficas | Preservar escala, unidades y precisión. Patrones, etiquetas y formas distinguibles; resumen/tablas equivalentes accesibles |
| Marca | Conservar AURA y sus tres elipses actuales. Corregir el favicon discordante. No insertar escudos, datos catastrales o una identidad de gaceta |
| Navegación | 52 px desktop; móvil recompuesto, marca estable y destinos alcanzables; targets de 44 px para acciones táctiles |
| Movimiento | Tokens canónicos; sin efectos decorativos. Reduced motion mantiene mensajes y estado |

**Tensiones resueltas para este plan:** el perfil Web fija radios operativos más contenidos que el rango general del tema; aplicar el perfil Web. Las tablas densas usan sans aunque la lectura sea serif. Las barras indeterminadas muestran actividad y tiempo transcurrido real, nunca porcentajes o ETA inventados para imitar una demo.

## 4. Límites funcionales e invariantes

La presentación puede cambiar; estas propiedades deben seguir siendo verificables:

1. Auditoría determinista utilizable sin proveedor LLM. Sin proveedor se ofrece recuperación y exportación disponible, no un bloqueo total artificial.
2. Remediación opcional; informe/exportación no requieren aprobar scripts. Un plan vacío o rechazado permite cerrar sin cambios.
3. Aprobar una acción no equivale a ejecutarla. Descargar un bundle no equivale a verificar resultados. Recibo válido no equivale a integridad semántica.
4. Preservar valores no autorizados: `001`, `120.00`, texto con acentos, vacíos y delimitadores. No tocar motores de lectura/remediación para resolver estilo.
5. Conservar `verifiedEvidence`/`verifiedExecution` al volver exportación → informe → exportación. Recarga completa puede requerir reimportar archivos: no prometer persistencia inexistente.
6. Cancelar descarta la respuesta pendiente del diagnóstico; no afirmar que aborta físicamente el proveedor si este no lo soporta. Un intento viejo no sobrescribe el nuevo.
7. No modificar scores, umbrales, ground truth, protocolos, ranking ni configuración al adaptar gráficos/tablas.
8. Aplicar una configuración del Laboratorio no inicia el diagnóstico automáticamente. Sin ground truth no se presenta una campaña formal como válida.
9. Conservar contratos, IDs, nombres y contenido lógico de JSON/CSV/ZIP. Un PDF reformateado cambia bytes y requiere regenerar su hash/tamaño de manifiesto; nunca sobrescribir la campaña histórica para actualizar su aspecto.
10. Mantener distinción entre dato observado, inferencia, ausencia de evidencia y cero. Una señal pendiente de contexto no se convierte en error confirmado mediante la etiqueta visual.

La navegación, URL/History y el estado UI pueden reorganizarse en lo necesario para sostener el nuevo recorrido y su continuidad. No es obligatorio conservar los booleanos de vista o la disposición actual. Fuera de alcance: migraciones de frameworks sin necesidad demostrada (por ejemplo Zustand/React Query), cambiar proveedor/modelo, introducir V3, ejecutar otra campaña formal, migrar infraestructura, reconstruir documentos académicos históricos o rediseñar marca. Si un defecto funcional impide un recorrido, registrarlo y corregirlo como caso delimitado con su regresión, antes de cerrar esa fase.

## 5. Arquitectura de migración y control de cascada

### 5.1 Archivos propuestos

Todos los paths de esta sección son relativos a la raíz Aura; `Create` indica una propuesta, no un archivo ya implementado.

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modify | `DESIGN.md` | Contrato Editorial vigente, fuente y preset, alcance Web/PDF, tabla de excepciones |
| Create | `src/styles/casabero-editorial.tokens.css` | Copia acotada de bloques Editorial claros/oscuros, con SHA y procedencia |
| Create | `src/styles/editorial-foundations.css` | Roles tipográficos, foco, controles, estados y adaptadores de alias existentes |
| Create | `src/styles/editorial-shell.css` | Home, navegación, pie, ayuda y configuración |
| Create | `src/styles/editorial-audit.css` | Carga, perfil, diagnóstico, informe y exportación |
| Create | `src/styles/editorial-remediation.css` | Aprobación, script, ejecución y comparación |
| Create | `src/styles/editorial-lab.css` | Matriz, configuración, resultados y detalle experimental |
| Create | `src/styles/editorial-print.css` | Impresión web; no sustituye los generadores jsPDF |
| Modify | `src/index.css` | Retirar declaraciones migradas por familia; conservar comportamiento pendiente |
| Modify | `src/index.html`, `src/index.tsx`, `src/App.tsx` | Carga de estilos/fuentes, tema inicial, modo persistido y shell |
| Create | `src/services/editorialPdfTheme.ts` | Roles/tamaños/colores de los PDF nuevos, adaptados al medio documental |
| Create | `src/tests/e2e/editorial-migration.spec.ts` | Recorridos visuales y de accesibilidad de superficies productivas |
| Create | `src/tests/e2e/editorial-integrity.spec.ts` | Continuidad y artefactos observables en navegación real |
| Create | `src/tests/e2e/fixtures/editorial-preservacion.csv` | Datos sintéticos de preservación y densidad, sin datos personales |

No crear una segunda biblioteca de componentes `EditorialButton`, `EditorialTable`, etc. Migrar los componentes actuales y extraer una pieza compartida solo si dos consumidores reales justifican la misma responsabilidad. No importar íntegro `tokens.css`, cuyo `:root` también contiene Warm: versionar únicamente el alcance Editorial. Los aliases necesarios para transitar se registran con consumidor y tarea de retirada; no constituyen compatibilidad permanente con otros temas.

### 5.2 Contrato de aliases

- `--bg`/`--canvas` → canvas; `--ink` → tinta; `--ink2` → secundaria; `--ink3`/`--ink4` usados como texto → metadata legible.
- `--surface`, `--surface2`, `--surface-raised`, `--surface-hover` → papel/superficies según función, sin teñir todo el documento.
- `--border*` → líneas de separación; bordes de controles/foco usan contraste propio suficiente.
- `--font-body` y `--font-display` → serif; `--font-sans` y `--font-meta` permanecen sans; `--font-mono` → código/hashes.
- `--success`, `--warning`, `--error`, `--accent` y colores inline: inventariar consumidores antes de neutralizar. Añadir señales textuales/forma donde falten; conservar diferencias de series sin depender del color.
- Sombras y radios se migran por uso. No aplicar `box-shadow:none` o `border:0` a todo: podría borrar foco, inputs o agrupación necesaria.

### 5.3 Secuencia de cada familia CSS

1. Registrar selectores existentes, especificidad, media queries, reglas inline y modo oscuro.
2. Asignar un único archivo propietario a cada regla migrada.
3. Adoptar tokens y roles en una familia; evitar selectores amplios como `p:not(...)` para distinguir lectura de ayuda operativa.
4. Comparar esa familia y sus consumidores compartidos en claro/oscuro/móvil.
5. Retirar solo declaraciones sustituidas tras comprobar equivalencia funcional; no borrar CSS por falta de resultados en una búsqueda.
6. Revisar diff y registrar excepciones con ubicación y motivo. No dejar una nueva capa perpetua al final de 16.400 líneas.

Preparar la sustitución por fases en desarrollo; el selector canónico organiza Editorial, no habilita convivencia permanente con otros temas. Si hace falta una vista de revisión, usar una entrada temporal que se retira al integrar. El selector definitivo debe aplicarse antes del primer render y cubrir también `?view=ollama-setup`. Conservar solo la preferencia clara/oscura válida del usuario: normalizar valores previos a `light|dark`, retirar rutas de activación de temas antiguos y no mantener un selector multitema. Revisar flash inicial y carga de fuentes; no introducir fuentes remotas obligatorias para leer o operar. Un estado de trabajo intermedio no se entrega como producto migrado.

## 6. Mapa de superficies y transformación esperada

El inventario adjunto enumera los 70 componentes. Esta tabla agrupa recorridos; la presencia de un archivo no basta para declararlo una pantalla vigente.

| Superficie | Entradas/consumidores principales | Resultado Editorial | Catálogo |
|---|---|---|---|
| Inicio y navegación | `App`, `AuraMark`, `PipelineProgress` | Portada breve funcional; sesión retomable; índice de etapas y rama opcional claros | EC-01, EC-02, EC-14 |
| Carga | `FileUpload`, `ProgressDisclosure`, `IngestionEvidenceCard` | Selección por teclado/arrastre, archivo y alcance visibles, error recuperable junto a la carga | EC-03, EC-05 |
| Perfil | `ProfileStep`, `ColumnStatsPanel`, `SeverityDistributionChart` | Conclusión legible, cifras comparables, columna seleccionada y evidencia; sin mosaico de tarjetas | EC-06, EC-08, EC-10 |
| Diagnóstico | `DiagnosisStep`, `diagnosis/*`, `ChromeAiStatusPanel` | Preparación/proveedor → evidencia enviada → actividad → resultado → siguiente paso | EC-04, EC-05, EC-08 |
| Informe | `DiagnosticReportStep` y subcomponentes realmente importados | Conclusión y límites antes de hallazgos; detalle trazable y recomendaciones accionables | EC-06, EC-10 |
| Plan/script | `ScriptGenerationStepV2`, `RemediationPlanStepV2`, `SyntaxDisplay` | Acciones por columna, exclusiones, aceptación/rechazo y código diferenciados | EC-07, EC-08 |
| Revisión/aplicación | `ReviewStep`, `ScriptReview`, `ApplyVerifyStep`, `ImprovementRunPanel` | Decisión humana, copia externa, archivos requeridos, validación y comparación de hallazgos | EC-07, EC-09 |
| Exportación | Sección en `App`, `CopyableHash` y generadores | Lista de entregables con propósito, disponibilidad, inclusión opcional y resultado de descarga | EC-11, EC-14 |
| Configuración | `SettingsPanel`, `OllamaSetupWizard`, `OllamaSetupStandalone`, `DiagnosisQuickConfigModal` | Formulario agrupado, estado de proveedor y recuperación coherentes en entrada normal y standalone | EC-04, EC-12 |
| Ayuda y registros | `HelpCenter`, `AuditLogViewer`, `ExecutionLogsPanel`, `ChangelogModal`, `ErrorBoundary` | Lectura editorial, detalles técnicos desplegables, acciones de recuperación evidentes | EC-08, EC-12, EC-14 |
| Laboratorio | `benchmark/BenchmarkCampaignLab` y sus imports | Configuración → protocolo → ejecución → resultados → transferencia/exportación | EC-06, EC-10, EC-13 |
| PDF e impresión | `pdfGenerator`, `diagnosticReport/*`, `benchmark/experimentPdfReport` | Identidad documental congruente, paginación y tablas legibles, contenido preservado | EC-15 |

### Guion de composición por recorrido

El [diseño UI/UX](2026-09-14-aura-editorial-ux-design.md) desarrolla y gobierna estas composiciones. Los componentes actuales pueden dividirse, fusionarse o moverse si mejora la tarea y se preservan identidad, estado y evidencia.

- **Auditoría:** mantener los cinco destinos principales actuales (Carga, Perfil base, Diagnóstico, Reporte diagnóstico, Exportación). La rama Plan → Revisión → Aplicar/verificar permanece identificada como opcional. No imponer ocho pasos obligatorios.
- **Perfil:** identidad del archivo y resultado general → prioridades → columnas/distribuciones → reglas/evidencia accesibles → continuar. Las cantidades muestran unidad y denominador; un valor desconocido se declara.
- **Informe:** conclusión → problemas y soporte → recomendaciones → exportar o corregir copia. El detalle técnico sigue disponible sin competir con la decisión principal.
- **Remediación:** qué cambiaría y dónde → decisión por acción → contrato/script → ejecutar copia fuera de Aura → importar evidencia → verificar → comparar → exportar. El estilo no aplana estas fronteras.
- **Laboratorio:** protocolo e insumos → configuración → matriz/actividad → resumen y límites → comparación de resultados → configuración seleccionada/exportación. La selección debe seguir siendo reconocible fuera del gráfico y con teclado.
- **Móvil:** lectura y selección antes que controles extensos; evidencia a ancho útil; acciones alcanzables; scroll horizontal solo en tablas/rails identificados. No convertir cada fila en tarjeta si se pierde comparación.

## 7. Fases de ejecución

Cada tarea tiene un resultado pequeño verificable. Las fases son unidades de cierre, no estimaciones de duración. Registrar estado `PENDIENTE`, `EN_CURSO`, `BLOQUEADO`, `IMPLEMENTADO_SIN_VALIDAR` o `VERIFICADO`, junto a evidencia y limitaciones.

### F0 — Congelar línea base y resolver vigencia

**Dependencia:** ejecución solicitada. **Archivos:** crear `docs/plans/2026-09-14-aura-editorial-ejecucion.md`; leer/actualizar la clasificación del inventario; evidencia nueva en `docs/product/aura/evidence/editorial-migration/`.

1. Revalidar HEAD/branch/status de ambos repositorios. Registrar SHA del estándar y hash del showcase. Mantener `main`; no crear rama sin instrucción.
2. Confirmar las 55 dependencias alcanzables, sus condiciones y los 15 candidatos no enlazados. Buscar importadores/test harness para cada caso dudoso; etiquetar productivo, condicional, fixture o histórico. Asignar a cada archivo una disposición final obligatoria: migrado a Editorial o retirado por desuso comprobado. Ningún componente conservado queda exento por no estar en la ruta principal.
3. Capturar baseline de cada fila del mapa en datos sintéticos y viewports especificados en §8, incluyendo oscuro, estados vacíos y fallos.
4. Ejecutar typecheck, build, suite unitaria y E2E seleccionados en §9. Anotar fallos previos separadamente; no usar cifras históricas como resultado actual.
5. Crear un manifest de evidencia con viewport, modo, ruta, escenario, SHA y resultado. Reutilizar datasets controlados existentes sin alterarlos.
6. Contrastar U01–U09 con el recorrido actual: documentar qué se conserva, mueve, unifica o retira y su efecto esperado. Completar revisión Impeccable cuando se localice la skill. No etiquetar una hipótesis como validada por estar escrita.

**Salida:** mapa completo de pantallas activas y defectos previos, cobertura medible y ningún caso sin clasificar. Si una superficie no puede abrirse, registrar `BLOQUEADO` para su validación; puede continuarse otra fase independiente.

### F1 — Completar el catálogo Editorial por loop, no de una vez

**Dependencia:** brechas adjuntas revisadas. **Secuencia:** el [orden de ejecución](2026-09-14-aura-editorial-orden-ejecucion.md) parte F1 en tres mínimos (LOOP-01: EC-01/03/05/14/17; LOOP-02: EC-02/04/06–09/11/12/18 y EC-15 auditoría; LOOP-03: EC-10 resto/13/15 laboratorio/16). No se exige el catálogo entero antes de Inicio. Sí se exige patrón P0 definido antes de migrar su consumidor. **Archivos del estándar:** `examples/frontend/showcase-editorial.html`, `examples/frontend/tokens.css` si faltan tokens, componentes normativos correspondientes, `CHANGELOG.md`, `docs/AI_LOG.md`.

1. Resolver las RC que toque el loop en curso (LOOP-01: RC-01, RC-04, RC-06; el resto con su sección) sin replicar defectos en Aura.
2. LOOP-01: EC-01, EC-03, EC-05, EC-14, EC-17 (navegación, carga, actividad, sesión, documento operativo).
3. LOOP-02: EC-02, EC-04, EC-06 a EC-09, EC-11, EC-12, EC-18 y EC-15 de auditoría (etapas, formulario, tablas, decisión, evidencia, exportación, overlays, retorno contextual).
4. LOOP-03: EC-10 resto, EC-13, EC-15 de laboratorio y EC-16 (gráficas, campaña, PDF experimental, banco de estados).
5. Actualizar EC-01/EC-02/EC-11/EC-13 cuando el loop correspondiente demuestre jerarquías y recorridos completos. No bloquear LOOP-01 a la espera de EC-13 o EC-15.
6. Cada patrón nuevo conserva una sección visible con ancla estable dentro de `showcase-editorial.html`. Puede dividir código auxiliar, pero no dejar el patrón únicamente en Aura, una captura o una página desconectada.
7. Vincular la norma que gobierna cada sección. Si el patrón no está cubierto, proponer/crear la norma mínima; si ya existe, ampliar ejemplo, no duplicar estándar.
8. Validar el mínimo del loop (teclado, foco, responsive, oscuro, fuente fallida) antes de adoptar esos consumidores. Ejecutar el validador documentado por el AGENTS vigente del estándar (`bash scripts/validate .` en la copia inspeccionada); confirmar comando antes de correrlo.
9. Las seis muestras revisables se reparte por loop: LOOP-01 Inicio; LOOP-02 Perfil denso, Informe, aprobación y configuración contextual; LOOP-03 Laboratorio con resultados. Obtener revisión visual del usuario al cerrar cada loop; una muestra no publica la interfaz productiva.

**Salida:** enlaces demostrables y matriz de estados por patrón. Gate por dependencia: no migrar una familia de Aura cuyo patrón necesario continúe sin definir/validar. No se exige bloquear trabajo documental independiente.

### F2 — Fundamentos, tokens y documentación

**Archivos:** `DESIGN.md`, nuevos tokens/foundations, `src/index.css`, `src/index.html`, `src/index.tsx`, `src/App.tsx`; pruebas de marca/navegación existentes.

1. Sustituir el contrato `DESIGN.md` por Editorial exclusivo; retirar instrucciones, ejemplos y referencias operativas de otros temas. Los antecedentes se consultan en Git y registros históricos, sin conservar un perfil alternativo en el contrato vigente.
2. Incorporar bloques Editorial versionados; declarar la tabla de aliases de §5.2.
3. Implementar roles de lectura/operación/datos/técnico y el foco distinto para campos y enlaces.
4. Depurar fuentes sin eliminar recursos todavía usados por un componente pendiente. Planear hospedaje local/licencias si se incorporan binarios; probar fallback sin red.
5. Cubrir modo guardado antes del render y entrada standalone; no activar tema global incompleto para una entrega de producto.
6. Unificar favicon con las tres elipses y preservar el lockup AURA.

**Verificación:** typecheck/build; `App.brand.test.tsx`; comprobación de estilos computados claro/oscuro, ausencia de fallback accidental Ink y lectura sin fuentes externas. **Salida:** contrato único y fundamentos listos para consumidores.

### F3 — Shell, Inicio, configuración y ayuda

**Archivos:** `App.tsx`, `AuraMark.tsx`, `SettingsPanel.tsx`, `OllamaSetupWizard.tsx`, `OllamaSetupStandalone.tsx`, `HelpCenter.tsx`, `ChangelogModal.tsx`, `DestructiveSessionDialog.tsx`, `ErrorBoundary.tsx`, `diagnosis/DiagnosisQuickConfigModal.tsx`, `editorial-shell.css`.

1. Migrar Inicio y sesión retomable conservando su acción y explicación de límites.
2. Implementar la arquitectura acordada: Auditoría/Laboratorio como destinos principales, Inicio mediante marca y Configuración/Ayuda como utilidades etiquetadas. Conservar acceso a capacidades existentes, sin obligación de preservar jerarquía o disposición. Adaptar desktop/móvil y pruebas al contrato de foco, ubicación, URL y retorno; no borrar aserciones de comportamiento por conveniencia.
3. Migrar configuración y asistente standalone: todos los tipos de control, instalado/no instalado, conectado/desconectado, error y recuperación.
4. Migrar ayuda/cambios/registros y overlays, conservando cierre seguro y devolución del foco.
5. Activar Editorial global en el entorno de desarrollo cuando fundamentos y shell pasen; completar todas las familias antes de publicar. Registrar el estado intermedio sin ofrecer al usuario alternancia hacia Ink/Warm.

**Verificación:** `App.navigation`, `SettingsPanel`, `HelpCenter`, `DestructiveSessionDialog` y recorrido Home → Configuración → Ayuda → Auditoría; standalone sin montar `App`. **Salida:** shell y utilidades sin variantes visuales accidentales.

### F4 — Auditoría: carga y perfil

**Archivos:** `FileUpload.tsx`, `MainPipeline.tsx` (solo integración visual), `PipelineProgress.tsx`, `ProgressDisclosure.tsx`, `ProfileStep.tsx`, `ColumnStatsPanel.tsx`, `IngestionEvidenceCard.tsx`, `SeverityDistributionChart.tsx`, `editorial-audit.css`.

1. Migrar carga vacía, archivo seleccionado, ingestión, CSV inválido/vacío y reintento.
2. Migrar etapas y actividad, incluyendo rama opcional y progreso indeterminado.
3. Migrar perfil y detalle de columnas; absorber `editorial-pilot` en componentes migrados, no retirarlo aún de consumidores pendientes.
4. Reemplazar agrupaciones decorativas por secciones; conservar metadatos, unidades, descripciones y acceso al detalle.
5. Migrar distribuciones con resumen textual y foco; revisar dataset ancho, nombres largos y ceros iniciales.

**Verificación:** `csvValidation`, `columnProfiler`, pruebas de perfil existentes y E2E con archivo válido/erróneo. **Salida:** carga → perfil → siguiente paso claro, sin pérdida de información o scroll global.

### F5 — Diagnóstico, informe y cierre sin remediación

**Archivos:** `DiagnosisStep.tsx`, `diagnosis/*.tsx`, `DiagnosticReportStep.tsx`, subcomponentes importados de `diagnosticReport/`, `ChromeAiStatusPanel.tsx`, `SyntaxDisplay.tsx`, exportación de `App.tsx`, `editorial-audit.css`.

1. Migrar readiness, configuración rápida, contenido/alcance de entrada y elección del proveedor.
2. Migrar espera/cancelación/error/resultado parcial con feedback y siguiente acción; preservar identidad de intento.
3. Migrar informe: conclusión, hallazgos, recomendaciones y límites; conservar detalle/copy técnico.
4. Migrar exportación sin script; explicar qué contiene cada archivo y qué no está disponible, sin botones muertos.
5. Revalidar el caso sin proveedor y cerrar informe/exportación con evidencia determinista disponible.

**Verificación:** `DiagnosisCancellation`, `diagnosticReportStep`, `pipelineDiagnosticReportState`, `optionalRemediationBranch`, E2E de informe/exportación. **Salida:** auditoría principal completa sin obligar remediación.

### F6 — Remediación, revisión, aplicación y verificación

**Archivos:** `ScriptGenerationStepV2.tsx`, `RemediationPlanStepV2.tsx`, `ReviewStep.tsx`, `ScriptReview.tsx`, `ApplyVerifyStep.tsx`, `ImprovementRunPanel.tsx`, `HealthDeltaDashboard.tsx`, `remediation/*.tsx`, `CopyableHash.tsx`, `editorial-remediation.css`.

1. Migrar tabla/lista de decisiones por columna: pendiente/aprobada/rechazada/excluida, impacto y evidencia.
2. Migrar revisión de script y contrato, línea técnica, copiado y descargas, conservando clasificación real de operaciones.
3. Migrar instrucciones de ejecución externa y archivos de retorno, mostrando el estado de cada requisito.
4. Migrar recibo inválido, hash distinto, archivo incorrecto, recarga que requiere reimportación y reintento.
5. Migrar comparación antes/después con resueltos/persistentes/nuevos y valores no autorizados preservados.
6. Verificar plan vacío/rechazado → cerrar sin cambios; volver a informe y exportación después de verificación.

**Verificación:** `scriptGenerationStepV2`, `ApplyVerifyStep`, `valuePreservation`, `verifiedRemediationEvidence`, exportación/remediación y E2E con recibo real. **Salida:** decisión y evidencia siguen siendo distinguibles; ninguna mejora estética cambia la autorización.

### F7 — Laboratorio completo

**Archivos:** todos los componentes conservados de `src/components/benchmark/`, `SyntaxDisplay.tsx` compartido, `editorial-lab.css`. `ExecutionEvidencePanel`/`HumanRubricPanel` requieren confirmar vigencia en F0 para decidir migración o retirada; no pueden permanecer con presentación anterior.

1. Migrar insumos/configuración/protocolo y ausencia de ground truth/proveedor/modelo.
2. Migrar matriz de ejecuciones con pendientes, calentamientos, corridas válidas/fallidas y actividad.
3. Migrar explorador D3, pestañas y selección sincronizada con tabla/detalle.
4. Migrar metodología, glosario, informe y configuración elegida sin alterar pesos/ranking.
5. Migrar exportación y transferencia Laboratorio → configuración → siguiente diagnóstico, comprobando que no inicia inferencia sola.
6. Probar fixture de campaña mixta y referencia existente de lectura. No repetir las 27 inferencias para verificar CSS ni regenerar la campaña cerrada.

**Verificación:** `CampaignResultsExplorer`, pruebas de benchmark/transferencia y `oe4-p1-04-ux.spec.ts`; matriz y detalle operables con teclado y móvil. **Salida:** laboratorio plenamente Editorial y metodología intacta.

### F8 — Informes PDF e impresión

**Archivos:** `src/services/editorialPdfTheme.ts` (nuevo), `src/services/pdfGenerator.ts`, `src/services/diagnosticReport/pdfLayout.ts`, `pdfTables.ts`, `pdfCharts.ts`, `diagnosticPdfGenerator.ts`, `src/services/benchmark/experimentPdfReport.ts`, `editorial-print.css`.

1. Cargar la norma documental y el flujo PDF al ejecutar esta fase; escoger fuentes incrustables y validar licencias. Preferencia: mismo preset Source en informes nuevos; no declarar que jsPDF incorpora esas fuentes automáticamente.
2. Unificar tokens del medio, portada, títulos, lectura, tablas, código, pies y numeración en los tres generadores.
3. Ajustar saltos, tablas anchas, encabezados repetidos y gráficos con alternativas. No reducir texto por debajo del rango documental para evitar otra página.
4. Generar informes sintéticos cortos/largos, con acentos, hashes, tablas y script; renderizar y revisar **cada página**.
5. Comparar contenido lógico, tablas/cifras y archivos disponibles; regenerar manifiestos nuevos con hashes correctos del PDF nuevo.
6. Verificar impresión web en blanco aunque se use oscuro; conservar texto seleccionable. Registrar por separado cualquier límite de etiquetado accesible del generador.

**Verificación:** `pdfGenerator`, `diagnosticPdfGenerator`, `pdfCharts`, pruebas del exportador experimental y revisión visual paginada. **Salida:** apariencia coherente del documento descargado, no solo de su botón.

### F9 — Integración, retirada de deuda y entrega

**Archivos:** familias CSS migradas, `index.css`, `DESIGN.md`, inventario, registro de ejecución y documentación de producto.

1. Retirar `editorial-pilot` y reglas `:has(.editorial-pilot)` cuando todos sus consumidores ya usen el tema global.
2. Retirar del código entregable todos los tokens, estilos inline, selectores, recursos, imports y plantillas propios de Ink/Warm. Migrar consumidores restantes o retirar componentes cuyo desuso se haya demostrado, junto con sus estilos y pruebas obsoletas. La limpieza del sistema visual anterior es parte necesaria de esta migración; preservar lógica funcional y evidencia histórica.
3. Completar matriz de cobertura: cada uno de los 70 componentes inventariados y cualquier componente descubierto después queda migrado a Editorial o retirado por desuso comprobado. Los auxiliares, legacy y fixtures conservados también deben pasar el contrato Editorial. No quedan excepciones visuales pendientes al cierre.
4. Ejecutar la matriz final §8, checks §9, PDF y descargas. Un fixture verde no sustituye el recorrido productivo.
5. Tras modificar código, mantener Graphify según las instrucciones vigentes (`graphify update .`); registrar si la herramienta falla y no afirmar grafo actualizado.
6. Revisar diff por archivos, registrar SHA probado y punto de restauración; commit/push de cambios autorizados en `main` cuando corresponda a la ejecución. Despliegue/publicación solo si entra en la solicitud de esa fase.

**Salida:** Editorial es el único sistema visual de Aura, con todas las familias conservadas verificadas y catálogo actualizado. No quedan implementaciones Ink/Warm, temas alternativos ni overrides que solo las oculten. Si falta oscuro Editorial, PDF, Laboratorio, un auxiliar conservado o un camino de error crítico, no declarar “migración integral completada”.

## 8. Matriz de aceptación humana

| ID | Camino | Resultado observable obligatorio |
|---|---|---|
| J01 | Inicio → Auditoría → cargar CSV → Perfil | Identidad/datos correctos, lectura clara, siguiente acción visible |
| J02 | CSV vacío, solo encabezado, malformado, extensión incorrecta | Mensaje específico y reintento; no aparece un dataset saludable ficticio |
| J03 | Perfil sin proveedor | Diagnóstico explica requisito y recuperación; evidencia determinista exportable |
| J04 | Diagnóstico válido → Informe → Exportación | Se distinguen hechos/inferencias/límites; descarga real legible |
| J05 | Diagnóstico lento → cancelar → nuevo intento | Foco y actividad claros; respuesta anterior no pisa el resultado nuevo |
| J06 | Proveedor ausente, timeout o contrato inválido | Causa y siguiente paso, sin éxito falso ni inferencia disparada al configurar |
| J07 | Plan sin acciones o todas rechazadas → cerrar | Exporta sin script/ejecución verificada ficticia; datos originales intactos |
| J08 | Aprobar solo duplicados → ejecutar copia → importar recibo/CSV → reauditar | 5→4 filas en fixture; `001` y `120.00` conservados; acciones no autorizadas intactas |
| J09 | Recibo inválido/hash distinto/archivo equivocado | Rechazo visible, causa concreta y capacidad de reimportar |
| J10 | Ejecución verificada → exportación → informe → exportación | Conserva evidencia/CSV corregido; descargas y hashes verificables |
| J11 | Recarga de sesión con archivos no persistidos | Declara reimportación necesaria sin fingir que retuvo objetos File |
| J12 | Laboratorio sin insumos → configuración → resultados mixtos | Gates, corridas fallidas, métricas y límites legibles; cálculos idénticos |
| J13 | Seleccionar resultado con teclado → aplicar configuración → Auditoría | Tabla/gráfico/detalle coinciden; parámetros se transfieren sin arrancar diagnóstico |
| J14 | Ayuda/configuración/modal → cerrar/cancelar | Foco regresa al disparador; fondo no operable si modal; no pérdida de estado |
| J15 | Nuevo análisis/destruir sesión → cancelar y confirmar en fixture | Cancelar preserva todo; confirmar afecta solo la sesión de prueba designada |
| J16 | Exportar PDF determinista, diagnóstico y campaña; ZIP | Abren, todas las páginas legibles, archivos previstos, hashes/tamaños correctos |
| J17 | `?view=ollama-setup` sin App | Tema, fuente, foco y recuperación funcionan independientemente del shell |
| J18 | Tarea → configuración contextual → aplicar/cancelar → regresar | Contexto y valores preservados; sin iniciar inferencia automáticamente |
| J19 | Seleccionar columna/hallazgo/corrida → detalle → volver | Identidad, selección, filtros y posición útil coherentes en desktop/móvil/teclado |
| J20 | Atrás/adelante y entrada directa a una etapa | Vista válida o explicación de requisitos; no reinicia procesamiento ni simula resultados |

Condiciones transversales:

- Anchos 320, 390, 768, 1280 y 1440 CSS px; probar boundaries relevantes 640/960 cuando cambie la composición. Los flujos largos se validan en móvil y desktop, no solo la portada.
- Claro y oscuro en todas las familias; persistencia de modo y primer render. Impresión siempre con reglas de documento.
- Teclado completo: orden, activación Enter/Espacio, tabs con flechas si son tabs, cierre de overlays, foco al cambio de contexto y sin controles ocultos enfocables.
- Transición entre etapas: desde un Perfil desplazado hasta el final, continuar a Diagnóstico debe situar el título/contexto relevante a la vista y el foco en un destino lógico. El retorno conserva o restablece posición según el contrato definido, sin dejar al usuario perdido a media pantalla.
- Zoom 200 %, reduced motion y fuentes remotas bloqueadas. Cadenas largas, 50 columnas y una vista con al menos 100 filas/casos cuando la tabla lo soporte; número de prueba, no promesa de rendimiento ilimitado.
- Contraste medido: 4,5:1 texto normal, 3:1 texto grande; foco/controles con contraste suficiente. No aplicar 3:1 indiscriminadamente a separadores puramente decorativos.
- Medir combinaciones de clases reales, especialmente `btn-p btn-sm`, en normal/hover/focus/active y claro/oscuro. Capturar color de texto y fondo computados; no certificar un botón midiendo solamente el token de tinta.
- Targets táctiles de 44×44 px donde la tarea exige pulsación; filas densas mantienen texto legible y acciones alcanzables. No encoger todo a los 28 px de la variante compacta del showcase.
- Sin scroll horizontal del documento; scroll local rotulado y operable para datos/código; ninguna barra fija cubre foco, contenido o acciones.
- Lectura asistida: al menos revisión real de nombres, headings, tablas, live regions y diálogos con lector de pantalla durante integración; si no es posible, declarar la limitación, no certificar accesibilidad universal.
- No errores de consola/red causados por la migración; medir CSS/bundle/tiempo de interacción antes/después sobre el mismo fixture y entorno. Investigar regresión perceptible; no inventar un umbral sin baseline.
- Si se utiliza axe u otra auditoría automática, conservar `violations` e `incomplete` y resolver la revisión manual pendiente. Ejecutar fuentes normales y fallback como escenarios separados. Un auditor estático inspecciona también código confirmado en HEAD; un diff vacío no demuestra conformidad. Los hooks que inyectan estados quedan limitados a pruebas específicas, nunca a la evidencia del recorrido humano completo.
- Exclusividad Editorial: inspeccionar código fuente, imports, preferencias, rutas condicionales, recursos estáticos, plantillas PDF y bundles generados. Buscar identificadores y referencias de Ink/Warm, revisar cada coincidencia y comprobar eliminación de sus bloques de implementación. Una búsqueda literal sin resultados no basta: comprobar estilos computados y procedencia de tokens en todas las superficies. Una coincidencia con el token canónico `--ink` o un color compartido tampoco prueba un resto del tema Ink.

## 9. Pruebas y comandos previstos

Estos comandos están **planificados**, no ejecutados por esta entrega. Desde `/Users/casabero/Documents/GitHub/aura/src`, con dependencias existentes:

```bash
npm run typecheck
npm run build
npm test -- App.brand.test.tsx App.navigation.test.tsx SettingsPanel.test.tsx HelpCenter.test.tsx DestructiveSessionDialog.test.tsx
npm test -- DiagnosisCancellation.test.tsx pipelineDiagnosticReportState.test.tsx optionalRemediationBranch.test.tsx scriptGenerationStepV2.test.tsx
npm test -- valuePreservation.test.ts verifiedRemediationEvidence.test.ts ApplyVerifyStep.test.tsx
npm test -- pdfGenerator.test.ts diagnosticPdfGenerator.test.ts pdfCharts.test.ts
npm run test:e2e -- tests/e2e/aura-full-flow-export.spec.ts tests/e2e/apply-verify-reaudit.spec.ts tests/e2e/oe4-p1-04-ux.spec.ts --project=chromium
```

Al cierre de integración: `npm test`, typecheck/build y nuevas specs Editorial. No existe script `lint` en el `src/package.json` inspeccionado: no afirmar que se ejecutó lint ni añadir tooling para aparentar un check.

`playwright.config.ts` usa el puerto 3000 y varios harness activados; `reuseExistingServer` puede tomar un servidor sin las mismas flags. Confirmar SHA, puerto y flags antes de interpretar un resultado. Separar evidencia fixture de recorrido normal sin harness. Pruebas reales de proveedores opt-in se ejecutan solo dentro del alcance acordado y se reportan separadamente.

### Ejemplo de contrato de regresión para tema global

Crear primero esta comprobación en la nueva spec; debe fallar mientras `html` no declare Editorial y mientras Inicio conserve la base Ink. No usar solamente la presencia de una clase para certificar la migración.

```ts
import { test, expect } from '@playwright/test';

test('Inicio usa el tema Editorial y permite comenzar con teclado', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-casabero-theme', 'editorial');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const start = page.getByRole('button', { name: 'Empezar auditoría' });
  await start.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Seleccionar archivo' })).toBeVisible();
});
```

Al ejecutar, confirmar los nombres accesibles vigentes. Mantener intención humana si cambia legítimamente el copy. Para CSS reversible de bajo impacto bastan inspección visual y regresiones existentes; añadir pruebas nuevas donde protejan interacción, acceso, estado o resultado, no snapshots que copien toda la implementación. Un resultado antes/después de integridad compara celdas, decisiones y artefactos, no solo un mensaje “Verificado”.

## 10. Riesgos, recuperación y criterios de cierre

| Riesgo | Mitigación y señal de fallo |
|---|---|
| Cascada histórica/inline neutraliza tokens | Asignar propietario por familia; estilos computados y revisión de todos sus consumidores |
| Oscuro conserva paneles blancos del piloto | Retirar tokens locales por consumidor, probar dark antes de cerrar familia |
| Serif reduce capacidad de comparar | Sans tabular para datos, reflujo y detalle; no reducir tamaños |
| Monocromo borra semántica | Texto + forma + leyenda; contraste y lectura sin color |
| Simplificar cajas elimina información | Comparar contenido/acciones del baseline; mover a detalle accesible con entrada visible |
| Reordenar componentes desmonta evidencia | Regresión de navegación y sesión; no trasladar estado por estética |
| Copiar demo introduce fallos ARIA | RC-01 a RC-06 primero; pruebas del componente real después |
| PDF bonito deja ZIP inválido | Comparar contenido, regenerar manifiesto nuevo, abrir ZIP y comprobar hashes |
| Pruebas fixture pasan pero producto falla | Recorridos normales, proveedor ausente y una ejecución real delimitada |
| Se migra código histórico como si fuera producto | Confirmar vigencia; no restaurar pantallas retiradas como Health Delta en la navegación |

Recuperación: commits pequeños por fase/familia, con SHA de baseline y evidencias vinculadas. Si hay regresión, restaurar únicamente los cambios de esa fase mediante un revert selectivo revisado, conservando datos y trabajo ajeno. No usar reset destructivo, limpiar storage del usuario ni manipular campañas históricas. En un revert compartido, verificar otra vez la dependencia entre CSS/tokens/markup.

El registro por fase debe contener: fecha, alcance, archivos, patrones EC utilizados, estados ejercitados, comandos/resultados, capturas/artefactos durables, SHA probado, pendientes y siguiente acción exacta. `IMPLEMENTADO_SIN_VALIDAR` no puede convertirse en `VERIFICADO` por el paso del tiempo o una captura de Home.

**Definición de terminado:** Editorial es el único sistema visual implementado y distribuido en Aura; cada componente inventariado está migrado o retirado por desuso comprobado; no quedan restos de implementación Ink/Warm ni controles para activarlos; todos los patrones reutilizables están incorporados al showcase; claro/oscuro Editorial/responsive/teclado y diseño U01–U09 contrastado con las tareas y recorridos J01–J20 verificados; PDF/descargas comprobados; contratos e invariantes preservados; documentación operativa únicamente Editorial. La fase final no admite excepciones visuales por antigüedad, baja frecuencia de uso o carácter auxiliar.

**Validación de esta entrega documental:** 70/70 archivos del inventario presentes; 18 familias EC, seis correcciones RC, diez fases y 20 recorridos enumerados; enlaces nuevos locales comprobados y `git diff --check` sin errores. Se observó un enlace previo roto en `docs/README.md` hacia `docs/tfm/memoria_final/README.md`; no se cambió por ser ajeno a este plan. No se ejecutaron suites ni se hizo commit/push de esta entrega. El plan queda guardado localmente y enlazado como próximo trabajo.

## 11. Handoff compacto para la futura ejecución

```text
Execute Aura Editorial according to docs/plans/2026-09-14-aura-editorial-orden-ejecucion.md. Run LOOP-01, then LOOP-02, then LOOP-03; do not start a later loop without authorization. Specifications live in the 2026-09-14 pack (integral plan, UX design, showcase gaps, inventory). Editorial must be Aura's only visual system at closeout. Remove all Ink/Warm implementations from deliverable code; do not publish a hybrid. Migrate every retained component; remove demonstrably unused ones with their obsolete styles. Light and dark must both be Editorial. Current layout is not a constraint. Preserve functional invariants. Apply Impeccable frontend-design, polish, quieter and animate on the surfaces of the current loop. Complete only the catalog minimum of that loop in showcase-editorial.html before adopting those consumers; do not wait for all 18 EC families. Preserve audit/remediation decisions, provider behavior, values, evidence, session continuity and export contracts. Keep historical evidence immutable. Keep a Spanish phase register and stay on main. Close each loop with human-route E2E, not screenshots or file lists. This remains a plan until the user requests LOOP-01.
```
