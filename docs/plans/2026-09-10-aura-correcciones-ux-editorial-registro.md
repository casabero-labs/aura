# Aura — registro de correcciones UX y piloto Editorial

Fecha de inicio: 2026-09-10. Rama: `main`. Base: `3b0470d`.

## Autoridad y alcance

El usuario autorizó implementar las etapas 1–3 de la propuesta del chat: integridad/continuidad/accesibilidad P1; claridad de decisiones y recorrido P2; piloto Editorial en Perfil → Informe → Exportación. Pidió corregir caso por caso y registrar cada avance para que otro agente pueda retomar o colaborar desde el punto pendiente. Investigación doctoral: solo sugerencia, fuera de implementación. Auditoría fuente: [2026-09-06-aura-ux-editorial-investigacion-doctoral.md](2026-09-06-aura-ux-editorial-investigacion-doctoral.md), especialmente cierre del 8 de septiembre.

No confundir código cambiado, prueba automatizada, recorrido real y publicación. Usar `COMPLETADO` para una corrección implementada y verificada en el alcance explícito; usar estados `PENDIENTE`, `EN CURSO`, `IMPLEMENTADO / VALIDACIÓN PENDIENTE`, `VERIFICADO` y `BLOQUEADO` con motivo concreto. Una limitación de herramientas no demuestra defecto del producto. No afirmar cobertura universal.

## Estado vigente y punto de reanudación — actualizado 2026-09-12

Esta sección y la matriz son el resumen vigente. Las olas posteriores son evidencia histórica, no estados acumulativos ni instrucciones actuales. No reabrir UX-01, UX-02 o UX-03 por pendientes históricos ya superados. Las verificaciones tienen el alcance explícito de cada fila. El piloto acotado de Perfil → Informe → Exportación está completado; no implica una auditoría universal del producto.

- **Solicitud actual COMPLETADA (2026-09-11): cancelación concurrente, cierre sin cambios y separación de 999/nulos corregidos y verificados. No hay un caso activo de esta solicitud ni trabajo que deba trasladarse a otro agente.**
- Evidencia vigente: 146 archivos de pruebas pasan, 2021 pruebas pasan, 6 omitidas; typecheck y build pasan. CUA verificó CSV → perfil → informe: tres datos no nulos, cero críticos, marcador contextual y ninguna recomendación de imputación sin vacíos. Las carreras de solicitudes y el cierre V2 se verifican mediante pruebas de integración de componentes con resultados observables.
- Los tres defectos de la revisión anterior están cerrados por la entrada «Cierre de los tres defectos» al final. No retomarlos como pendientes leyendo la cola histórica anterior a ese cierre.
- **Piloto Editorial COMPLETADO (2026-09-12).** Perfil, Informe y Exportación verificados a 320/390/1280; contraste y foco de Copiar medidos; recorrido real Qwen → aprobación → Python → reauditoría → descargas conserva `001` y `120.00`. También corregida la pérdida de evidencia al volver Exportación → Informe → Exportación. No hay correcciones activas de estas etapas; investigación doctoral sigue fuera de alcance.
- Validación final ampliada: 146 archivos, **2022 pruebas pasan, 6 omitidas**; typecheck y build pasan. Código publicado en `origin/main`: `14c2500` (2026-09-12). Este registro consolida el cierre; no hay un despliegue público certificado.
- Cambios preexistentes que deben preservarse: `.DS_Store`, `src/__tests__/diagnosisPromptV2.test 2.ts`, `src/__tests__/diagnosisSystemInstructionV2.test 2.ts`, `src/contracts/llm/diagnosisInputPackageV2 2.ts`.
- Coordinación: consultar este punto y el estado de Git antes de tocar archivos. El caso activo pertenece a esta tarea; un agente de apoyo debe acordar un caso/archivos distintos o retomar cuando esta tarea haya finalizado/interrumpido. No sobrescribir cambios de otro agente.

## Matriz de avance

| Orden | Caso | Estado | Evidencia disponible / pendiente de cierre |
| --- | --- | --- | --- |
| 1 | UX-08 preservación de valores | VERIFICADO | COMPLETADO: recorrido real Qwen V2, runner, reingreso y ZIP conservan `001`/`120.00`; 5→4 filas, score 73→100; vuelta por el informe conserva las descargas |
| 2 | UX-01 entrada vacía / ilegible | VERIFICADO | Vacío → «No se pudo auditar» y otro archivo; sin score 100 ni Continuar |
| 3 | UX-02 continuidad determinista | VERIFICADO | Aviso de alcance en informe determinista; «Corregir una copia» deshabilitado; no hay Aplicar y verificar |
| 4 | UX-03 diálogo destructivo | VERIFICADO | Modal nativo, Cancelar inicial, Tab contenido, Escape y retorno; trampa de foco añadida en verificación |
| 5 | UX-04 certeza, marcadores y porcentajes | COMPLETADO | 999 conserva su valor y no incrementa nullCount ni genera NULL_VALUES o recomendación de imputación; vacíos reales siguen detectados. Pruebas CSV/motor/informe y CUA |
| 6 | UX-05 revisión de código / evidencia | VERIFICADO | Clasificación unitaria + plan muestra Conservar como válido en marcadores |
| 7 | UX-06 reanudación / comprensión | VERIFICADO | Portada Reanudar sentinelas.csv · Perfil base |
| 8 | UX-07 progreso real | COMPLETADO | A cancelada no publica éxito/error/progreso ni apaga B; respuesta posterior a B y desmontaje también cubiertos |
| 9 | Decisiones informadas / exportación | COMPLETADO | Cerrar sin cambios llega a exportación con plan vacío o rechazado, conserva 001 y no crea contrato ni evidencia de ejecución. Cierre referido a este defecto |
| 10 | Piloto Editorial | COMPLETADO | Perfil/Informe/Exportación a 320/390/1280 sin desbordamiento; texto visible medido, Copiar 15,57:1 y foco de teclado; V2 y descargas verificados |

## Bitácora histórica por caso

**Los tres defectos reabiertos en la revisión de integración quedaron corregidos el 2026-09-11. El orden de trabajo indicado en entradas anteriores ya no está pendiente.**

Los resultados describen cada ejecución en su fecha. Los pendientes superados llevan una aclaración; los defectos reabiertos se gobiernan desde el resumen vigente.

### 2026-09-10 — inicio

- Confirmados checkout y rama `main`; cambios ajenos identificados y preservados.
- Leído cierre de auditoría: V2 y descargas ya tienen evidencia histórica; no reiniciar pendientes superados.
- Inspección previa confirma `pd.read_csv` sin tipos explícitos en runner y `dynamicTyping: true` en carga web. Es necesario tratar ambos extremos.
- Registro creado antes de editar comportamiento. Pendientes implementación, validación y recorrido actual.

## Validación y entrega

### UX-01 — entrada y recuperación

- `csvValidation.ts`: rechaza vacío/sin registros útiles, encabezados ausentes/repetidos, comillas incompletas y filas con diferente número de campos. Admite CSV de una columna, punto y coma y valores entrecomillados.
- `csvService.ts` aplica guardia antes de resolver; `ProfileStep.tsx` ofrece seleccionar otro archivo; `MainPipeline.tsx` vuelve a carga sin recargar página. `pipelineSession.ts` no restaura informes históricos de cero filas/columnas.
- Verificación: 23 pruebas de `csvValidation`, `csvService` y `pipelineSession` pasan. Pendiente en esta primera validación; superado por el recorrido visible vacío → mensaje → otro CSV de Ola 0.

### UX-02 — alcance de ruta determinista

- `DiagnosticReportStep.tsx` y `MainPipeline.tsx`: sin contexto V2 se explica antes de generar/aprobar que el informe es exportable y que la corrección verificada no está disponible. El usuario puede volver al diagnóstico/configurar proveedor.
- Sesión histórica de script: aviso de alcance y salida a exportación; `ReviewStep.tsx` distingue Exportar propuesta sin ejecutar de Preparar ejecución externa. No se fabrican recibos ni se eliminan validaciones V2.
- Decisión de alcance: resuelve la precondición imposible mediante declaración temprana y salida real, como permite la auditoría. Una remediación determinista con contrato neutral propio requiere un caso de implementación adicional; no se declara implementada.

### UX-03 — diálogo destructivo

- `DestructiveSessionDialog.tsx`, integrado en `App.tsx`: modal nativo con fondo inerte, foco en Cancelar, Escape, X con nombre accesible y devolución del foco al disparador. La comprobación en navegador estaba pendiente en esta entrada y se completó en Ola 0, incluida la corrección del ciclo de foco.

### Baseline de pruebas anteriores

- Reproducidos en copia de HEAD sin cambios los fallos de `pipelineDiagnosticReportState.test.tsx` (textos de agrupación obsoletos) y `exportJsonPreflight.integration.test.tsx` (espera dos botones Laboratorio aunque existe uno). Evidencia: `/var/folders/sk/8kk5l44d4dg65vnlrdlvtn3h0000gn/T/aura-baseline-bsxgaaud/baseline-test.log`. No son regresiones de esta implementación. Revisar expectativas al cerrar las pantallas relacionadas.

### UX-08 — implementación y primera validación

- `src/services/csvService.ts` y `reauditService.ts`: valores originales textuales, sin conversión automática. El motor calcula una vista estadística desechable con `auditValue.ts`. Deduplicación compara valores originales completos en lugar de hashes de 32 bits.
- `experiments/runners/run-aura-remediation.mjs`: lectura lexical del CSV (incluye detección de delimitador), DataFrame sin inferencia de tipos/nulos; columnas y valores protegidos comprobados antes de publicar salida/recibo positivo. El original permanece intacto.
- `src/services/remediationExecution/valuePreservation.mjs`: comprobación compartida por ejecutor y reingreso web, enlazada a `columnRefs` del payload aprobado. Conserva orden/esquema y limita eliminación a duplicados exactos originales. La operación de deduplicación se reconoce únicamente como línea exacta del renderer V2 aprobado.
- `pythonExecutionContract.ts`: un recibo coherente con el CSV dañado también se rechaza por preservación. No basta recalcular hashes.
- Regresión `valuePreservation.test.ts`: fallo previo reproducido; ejecución real Python/Pandas para conservación de `001`, `120.00`, vacíos, `NA`, `null`, booleanos textuales y CSV con punto y coma; rechazo de conversión de claves y eliminación de fila única. 61 pruebas focalizadas pasan; `npm run typecheck` pasa.
- La suite general inicial: 1967 pasan, 6 omitidas, 3 fallan y 1 suite no inicia. Se ajusta expectativa de edad lexical (`'30'`) y fixture de exportación con plan vacío que cambiaba `Ana` a `ANA`. Otros dos fallos de textos/nav se contrastan con HEAD en copia temporal independiente; no se debilita el control de preservación.
- Límite explícito: bundles históricos sin `columnRefs` conservan compatibilidad de ejecución y no certifican alcance de ediciones. La protección comprueba columnas no autorizadas y filas; no valida semánticamente cada cambio permitido. No promete igualdad byte a byte de quoting/saltos de línea; sí de valores de celdas conservadas. La reauditoría detecta el delimitador de salida independientemente del original.

Registrar por caso: problema, archivos exactos, decisión, pruebas/comandos y resultado, evidencia de navegador cuando corresponda, límites y siguiente paso. Mantener este archivo actualizado al terminar cada caso y antes de cualquier interrupción. Las capturas y datos sintéticos de ejecución se guardan fuera del código; las regresiones reutilizables sí pertenecen a tests.

La aprobación de implementación no equivale a despliegue. Estado de commits/publicación: todavía no realizados en esta continuación.

### 2026-09-10 — Ola 0: suite y recorrido P1

- Suite general: 2005 pasan, 6 omitidas, 0 fallan. `npm run typecheck` pasa. Playwright `npx playwright test tests/e2e/ux-p1-wave0.spec.ts` pasa.
- Expectativas antiguas ajustadas, no relajadas: `pipelineDiagnosticReportState.test.tsx` usa «Hallazgos únicos» / «Riesgo confirmado»; `exportJsonPreflight.integration.test.tsx` espera 1 Laboratorio accesible y 2 con `hidden: true` (el móvil sigue `hidden`).
- Pruebas añadidas: admisión vacía en `csvService.test.ts`; sesiones históricas de 0 filas/columnas en `pipelineSession.test.ts`; alcance determinista en `diagnosticReportStep.test.tsx`; foco/Escape/Tab en `DestructiveSessionDialog.test.tsx`; recorrido `src/tests/e2e/ux-p1-wave0.spec.ts`.
- UX-03: el `<dialog>` nativo no retuvo Tab en Chromium/Playwright; se añadió ciclo explícito de foco entre botones del modal. Escape sigue cancelando y el foco vuelve al disparador.
- Recorrido visible (Playwright Chromium 1280×900, sin In-app Browser): vacío → mensaje → otro CSV → informe determinista → exportación → diálogo. Capturas fuera del repo: `/Users/casabero/Documents/Codex/audits/aura-2026-09-10/screenshots/15-csv-vacio-rechazado.png`, `16-alcance-determinista.png`, `17-dialogo-destructivo.png`.
- UX-08: las pruebas `valuePreservation.test.ts` ejecutan el runner real y rechazan conversión de `001` y borrado de fila única. Límite: no se reabrió Ollama ni el flujo UI de aprobación V2 en esta ola.
- Observación fuera de alcance P1 (pertenece a UX-04): un CSV válido de 2 filas aún muestra «Base defendible para análisis posterior» y 100/100.
- Siguiente caso: UX-04.

### 2026-09-10 — Olas 1–2 y tokens Editorial

Nota de vigencia: la ausencia de recorrido Ollama/999 y de revisión a 320/390 solo aplica a esta ola; el recorrido siguiente amplió esa evidencia. La afirmación sobre 999 no cubre nullCount ni el issue separado NULL_VALUES y quedó refutada por la revisión de integración.

- UX-04: `formatAffectedShare` en perfil e informe; `999` sigue detectándose pero sale como «Señal pendiente de contexto», no como riesgo confirmado. Conservar como válido en el plan V2 para `normalize_placeholders`.
- UX-05: `pythonLineClassification` ignora comentarios y cuenta `drop_duplicates` como transformación. Revisión humana: «Análisis estático» y «Trazas en el texto»; el texto aclara que no equivalen a ejecución.
- UX-07: se elimina el intervalo de 2,5 s. Estados: enviando, recibiendo, validando, error, cancelar, segundos transcurridos.
- UX-06: portada muestra Reanudar + etapa si hay informe; Empezar otra auditoría. Columnas: pista IQR/cardinalidad.
- Exportación: PDF etiquetado como diagnóstico inicial. Plan V2: muestras observadas y Cerrar sin cambios si no hay acciones.
- Editorial: Source Serif 4 en títulos de Perfil/Informe/Exportación; fondo blanco `#FFFFFF`, tinta `#191919`. No se midió contraste ni 320/390.
- Suite: 2013 pasan, 6 omitidas. Typecheck pasa. Playwright P1 y config Ollama/Qwen pasan. No se reejecutó un diagnóstico Ollama completo ni un CSV con `999`.
- Límite: no hay commit ni publicación.

### 2026-09-10 — Recorrido local Qwen y viewports

- Playwright `tests/e2e/ux-local-qwen-walkthrough.spec.ts`: perfil/reanudar/320/390 y cancelar + Qwen 3.5 4B (contrato válido, ~1,9–3,5 min).
- Perfil: conteos `de 201`, no `0%`. Portada: Reanudar sentinelas.csv · Perfil base.
- Diagnóstico: progreso «Enviando solicitud»; Cancelar; luego Qwen válido (modelo observado = solicitado, 0 errores de contrato).
- Informe: se observó «AURA integró evidencia determinista y diagnóstico asistido». La conclusión anterior «999 no aparece como riesgo confirmado» se retira: la comprobación de texto no demuestra ausencia de NULL_VALUES ni valida nullCount. Véase el contraejemplo de integración.
- Plan V2: Conservar como válido en normalizar marcadores. Exportación: PDF de diagnóstico inicial.
- CSS: stepper y gráfico de severidad ya no ensanchan el documento a 320 px.
- Capturas: `19`–`26` en `/Users/casabero/Documents/Codex/audits/aura-2026-09-10/screenshots/`.
- Límite: contraste del botón Copiar no medido. No hay commit.


### 2026-09-10 — Revisión de integración solicitada por el usuario

Revisión del árbol de trabajo observado en esa ejecución, sin cambios al código de aplicación. Fecha original conservada: el log empezó a las 22:41 del 10 de septiembre en America/Bogota (11 de septiembre en UTC). Los números de línea son referencias de esa instantánea; localizar por archivo y símbolos antes de editar. Las verificaciones anteriores se conservan como evidencia histórica; no cubren los contraejemplos siguientes.

1. **P1 / UX-07 — una solicitud cancelada puede publicar en la siguiente.** En `src/components/DiagnosisStep.tsx:734`, Cancelar marca un ref compartido y libera `isLoading`, pero no aborta la solicitud. Un segundo intento pone el mismo ref en `false` (línea 436). La respuesta o los eventos del primer intento vuelven a aceptarse; su `finally` también puede liberar el indicador mientras el segundo sigue activo. Evidencia: inspección de las rutas de inicio, progreso, resultado y finalización (415–637). No se reprodujo esta carrera en navegador en esta revisión. Corregir con identidad por intento, invalidación de callbacks/resultados/finally anteriores y abortar el proveedor cuando sea posible. Regresión necesaria: cancelar A, iniciar B y entregar A después; solo B puede publicar estado y diagnóstico.

2. **P2 / Decisiones — Cerrar sin cambios no hace nada en la ruta V2.** `src/components/RemediationPlanStepV2.tsx:291` ejecuta `onContinue`, pero `src/components/ScriptGenerationStepV2.tsx:280` entrega una función vacía. Además, el botón aparece solo con `plan.length === 0`, no cuando todas las acciones fueron rechazadas. Evidencia: conexión directa de props, sin recorrido nuevo de navegador. Conectar una salida explícita a informe/exportación sin exigir script y contemplar el plan sin acciones aprobadas. Verificar el destino tras el clic y la conservación del dataset.

3. **P1 / UX-04 — 999 todavía produce nulos confirmados sin vacíos.** Reproducción ejecutando los módulos actuales mediante Vite SSR: `runAudit([{codigo:'100'},{codigo:'101'},{codigo:'999'}], ['codigo'], ',')`, seguido de `buildDiagnosticReport({report})`. Resultado: `nullCount=1`, issue crítico `integrity-null-codigo`, y `confirmedRisks` con «1 de 3 (33,3%) afectados». A la vez aparece «posible sentinela, no nulo confirmado». `src/services/auditEngine.ts:296` excluye 999 de los no nulos; `src/services/diagnosticReport/diagnosticReportBuilder.ts:447`, donde solo se contextualiza TOXIC_PLACEHOLDERS y queda fuera NULL_VALUES. Separar ausencia real y marcador contextual en estadísticas, puntuación y agrupación. Regresión necesaria desde CSV/motor hasta informe, con marcador válido, vacío real y mezcla de ambos.

Validación actual: `npm test -- --run`: **144 archivos, 2013 pruebas pasan, 6 omitidas**. `npx tsc --noEmit`: pasa. Log de esta ejecución: `/tmp/aura-review-tests.log` (temporal). La suite verde no invalida los tres hallazgos; falta cubrir esos escenarios. No se reejecutó E2E ni se midió contraste en esta revisión. No hubo commit ni publicación. Próximo agente: resolver los tres hallazgos y añadir comprobaciones que observen el resultado final, no solo presencia de textos/botones.


### 2026-09-11 — Consolidación documental tras revisión de otro agente

- Separados resumen vigente, alcance de la matriz y bitácora histórica. UX-01/02/03 mantienen su cierre acotado; no se reabren por entradas antiguas.
- Retirada la conclusión general sobre 999 del recorrido Qwen. Editorial queda IMPLEMENTADO / VALIDACIÓN PENDIENTE: overflow de perfil/informe comprobado no sustituye contraste ni validación integral de exportación.
- Orden de ejecución vigente: UX-07 concurrencia → cierre sin cambios → UX-04 marcadores/nulos. Referencias estables: `DiagnosisStep.runDiagnosis`, callbacks de `RemediationPlanStepV2` en `ScriptGenerationStepV2`, `calculateStats`/`runAudit` y `buildDiagnosticReport`. Los nombres de botones y grupos del informe pueden cambiar; comprobar resultados y no depender solo del texto.
- Las menciones a «Riesgo confirmado» de Ola 0 describen las expectativas de esa ejecución, no fijan el nombre actual de la interfaz.
- Los logs en `/tmp` y carpetas temporales no son evidencia durable. Las cifras previas quedan como resultados registrados, no como nueva ejecución. En los próximos cierres conservar resultados y reproducción en una ubicación persistente junto con la revisión del código probado.
- Solo se modificó este registro; no se corrigieron los tres defectos, no se reejecutaron pruebas, no hubo commit ni publicación en esta actualización.


### 2026-09-11 — Cierre de los tres defectos: COMPLETADO

Esta entrada sustituye las instrucciones de reanudación de la revisión de integración y de la consolidación documental. El usuario pidió resolver los tres casos y dejar un cierre inequívoco.

**UX-07 — COMPLETADO.** `DiagnosisStep`: identidad monotónica por intento; cancelación y desmontaje invalidan respuestas anteriores. Preparación de entrada, progreso, resultado, errores, temporizador, recibo tardío y finalización comprueban vigencia. Cancelar detiene el temporizador y permite otro intento sin compartir una bandera reiniciable. La interfaz aclara que se descarta la respuesta pendiente: no promete detener físicamente la inferencia del proveedor, cuya interfaz actual no expone abortado. `DiagnosisCancellation.test.tsx` entrega éxito y error de A mientras B espera, entrega A después de B, y resuelve C tras desmontar: solo B publica; A no habilita el botón durante B.

**Cierre sin cambios — COMPLETADO.** `RemediationPlanStepV2` ofrece cierre cuando no hay acciones aprobadas (incluye plan vacío, pendiente o rechazado). `ScriptGenerationStepV2` conecta `onCloseWithoutChanges`; `MainPipeline` invalida resultados de remediación y navega a exportación. La prueba integrada en `scriptGenerationStepV2.test.tsx` monta el pipeline real, pulsa el botón con plan vacío y rechazado, y comprueba `state=export`, valores intactos incluido `001`, contrato nulo, script vacío y ausencia de evidencia verificada.

**UX-04 / 999 — COMPLETADO.** `calculateStats` conserva sentinelas numéricos entre valores presentes. La señal contextual sigue disponible sin descuento por placeholder numérico; no se generan nulos a partir de 999. `isNullIssue` en el builder prioriza el identificador de regla frente a palabras de una explicación contextual: «no tratar como nulo» no dispara recomendación de imputación. `sentinelNullSeparation.test.ts` recorre CSV → motor → informe con marcador sin vacíos, vacío sin marcador y mezcla: nullCount 0/1/1, NULL_VALUES solo para ausencias reales, confirmedRisks y recomendaciones coherentes. CUA verificó además la carga y el informe real de `marcadores.csv`: 3 datos presentes, 0 críticos, marcador contextual y ninguna recomendación de imputación. Se conservó la sesión sintética anterior utilizando un origen de prueba nuevo.

**Validación final:** `npm test -- --run`: 146 archivos pasan, **2021 pruebas pasan y 6 omitidas**. `npx tsc --noEmit` y `npm run build` pasan. La compilación advierte sobre tamaño de bundles; no bloquea. El SyntaxError del log de pruebas corresponde al caso intencional de rechazo de Python inválido, no a un fallo de suite. `graphify update .` ejecutado; informa archivos sin nodos y límite de tamaño para HTML, sin impedir actualizar el grafo.

**Evidencia persistente:** `/Users/casabero/Documents/Codex/audits/aura-2026-09-11/cierre-tres-defectos/` contiene `tests.log`, `typecheck.log`, `build.log`, `graphify.log`, `marcadores.csv`, `perfil-dom.txt`, `informe-dom.txt` y `revision.json` con base Git y hashes SHA-256 de código/pruebas revisados. Son resultados del árbol de trabajo, no de un commit publicado. Las pruebas de carrera usan proveedor diferido controlado para garantizar el orden adverso; no se afirma una nueva ejecución completa Ollama V2 en navegador.

**Entrega:** los tres defectos de esta solicitud están completados. No requieren continuación por otro agente. Cualquier futura modificación debe contrastarse con estas regresiones y hashes; las entradas históricas no reabren por sí solas un caso. El piloto Editorial conserva su pendiente independiente. No hubo commit ni publicación.


### 2026-09-12 — Cierre del piloto Editorial: COMPLETADO

Esta entrada sustituye el pendiente Editorial de las olas históricas y del cierre de los tres defectos. El usuario autorizó proseguir con este piloto y su entrega.

- **Editorial:** contenedores explícitos en `ProfileStep`, `DiagnosticReportStep` y exportación de `App`; tokens locales blanco/tinta, Source Serif 4 en títulos y párrafos de lectura, Source Sans 3 en controles/metadatos. Se añadió peso 400 a la fuente. Se corrigieron índices/separadores y etiquetas de tipo que tenían contraste insuficiente. La casilla para incluir corrected.csv tiene ancho propio, texto próximo y etiqueta clicable de 44 px, sin heredar el ancho completo de los campos.
- **Contraste y adaptación:** mediciones DOM con estilos cargados en Perfil, Informe y Exportación a **320, 390 y 1280 px CSS**, sin desbordamiento horizontal. Ningún fallo de contraste en el muestreo de texto visible del piloto (4,5:1 normal / 3:1 grande). Copiar JSON: **15,57:1**, alto 44 px y foco visible; activación Enter mostró «Copiado». Copiar script comprobado además mediante lectura del portapapeles. El lector de portapapeles de la herramienta devolvió vacío para el JSON: no se declara validado su contenido por esa vía. Teclado: Tab y Enter en controles del perfil/informe/exportación, foco visible al pasar a Descargar CSV/PDF. No equivale a certificación WCAG ni a revisión con lector de pantalla.
- **V2 real:** `preservacion-v2.csv` de 5 filas/4 columnas con duplicado exacto. Qwen 3.5 4B local devolvió contrato válido en 58,3 s, modelo observado igual al solicitado, 0 errores de contrato. Se aprobó únicamente deduplicación, se revisó el script completo, se descargó el bundle y se ejecutó el runner real. CSV/recibo reingresados y aceptados: **5→4 filas, 73→100, 1→0 hallazgos deterministas**, sin hallazgos nuevos. Se compararon todas las celdas conservadas con el original; `001`, `120.00` y demás valores permanecen intactos.
- **Continuidad adicional, COMPLETADA:** al volver de Exportación al Informe, `MainPipeline` reinicializaba `verifiedEvidence` y `verifiedExecution` a null pese a recibirlos en memoria desde App. Ahora los conserva al remontar. Regresión de dos viajes de exportación falla antes y pasa después, comprueba identidad de evidencia, bytes CSV, recibo y estado. Navegador: ejecución → exportación → informe → exportación conserva «Reauditoría completada», corrected.csv y ZIP verificable. La recarga completa del navegador sigue requiriendo reimportar archivos; `pipelineSession` los excluye deliberadamente del almacenamiento persistente.
- **Descargas:** PDF, JSON, CSV de hallazgos, corrected.csv y ZIP descargados desde controles reales. ZIP inicial y ZIP tras ida/vuelta: **31 artefactos, cero diferencias de hash/tamaño**; CSV del runner, descarga y ZIP coinciden. PDF de seis páginas renderizado e inspeccionado: legible y sin solapamientos; conserva el diagnóstico inicial de 73, no promete comparación posterior. Este caso no produjo especificaciones de gráficos; el PDF lo declara. El resumen de reauditoría está en JSON/ZIP/interfaz.
- **Validación:** suite completa 146 archivos, **2022 pruebas pasan y 6 omitidas**; typecheck y build pasan. Advertencia de tamaño de bundle no bloqueante. El SyntaxError de la suite corresponde al rechazo intencional de Python inválido. Grafo actualizado después de los cambios.
- **Evidencia durable:** `/Users/casabero/Documents/Codex/audits/aura-2026-09-11/piloto-editorial/` conserva mediciones, capturas, registros de teclado, logs, CSV origen/copia, contrato/recibo y descargas. `navigation-before.log` documenta el fallo previo; `navigation-final/` conserva contrato, ejecución, DOM y ZIP posteriores al arreglo. `revision.json` identifica base y hashes finales. La carpeta mantiene su fecha de inicio; el cierre ocurrió el 12 de septiembre. Las primeras capturas del informe sin estilos se descartaron y reemplazaron; el margen gris de algunas capturas corresponde al visor de la herramienta, no al ancho CSS medido.

**Estado de implementación: COMPLETADO.** No trasladar estos casos a otro agente como pendientes. Código y regresiones publicados en `origin/main` mediante commit `14c2500` el 2026-09-12; push confirmado. Este cierre documental se entrega en el commit siguiente. No se afirma despliegue de una aplicación pública. Los únicos cambios locales excluidos son `.DS_Store` y los tres archivos duplicados ` 2.ts` identificados al inicio.
