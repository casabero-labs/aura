# AURA — recorrido completo: UX/UI y pipeline

Fecha: 2026-10-03. Recorrido humano en Chrome 154 sobre `aura.casabero.com` y `localhost:3000`, con `titanic.csv` (891 filas, 12 columnas) y Gemini Nano local.

## Estado 2026-10-05

Resueltos los puntos 1–9, 11, 12, 14 y 16 de la sección 2 (`e3cbf16`), además del recibo con `runId` por ejecución y de la codificación en el bundle. Siguen pendientes:

- **10, archivos grandes.** La auditoría sigue en el hilo principal.
- **13.** La evidencia procesada sigue en `localStorage` (las filas ya no).
- **15, código muerto.** Siguen `GeminiAdvisor`, los proveedores cloud y los artefactos en la raíz; `api.ts` y la ruta V1 ya se eliminaron.
- **17, cifras de Nano.** Las cifras sin comillas no se validan.
- **Specs de Playwright** que recorren la pantalla de script V1 eliminada: `aura-development-loops`, `aura-qa-screenshots` y `aura-qa-audit`.
- **Toda la sección 3 de UX/UI.**
- **Evaluación multidataset (2026-10-05).** `experiments/evaluation/2026-10-05-multidataset/REPORT.md`. Verificado como resuelto: Latin-1 y `;` (D7, puntos 5 y 7), inyección de fórmulas (punto 12), parseo estricto en carga. Nuevos: **P1-B1** (columnas `name`/`id` bloquean la rama B), **P1-N1** (un fragmento con `requiresHumanReview=false` hunde el diagnóstico), **P1-T1** (el recorte de hallazgos no se declara). Confirmados REP-1, REP-2, EXP-1.

Blindaje activo:

- **CI** (`.github/workflows/ci.yml`): tipos, invariantes, suite completa y build con Node 22 y Python 3.13 + pandas, más los tests de la API. Solo si todo pasa avanza la rama `production`, que es lo que despliega Coolify.
- **Pre-push**: rechaza archivos sin versionar y ejecuta `npm run verify`.
- **Invariantes**: INV-1…INV-5 en `src/__tests__/invariants/`, documentados en `AGENTS.md`.

## 1. Arreglado en esta sesión

| # | Problema | Evidencia | Arreglo |
|---|---|---|---|
| P1 | Gemini Nano no diagnosticaba (`DIAGNOSIS_JSON_INVALID` tras 133 s) | Contexto de Nano 9.216 tokens; el prompt usaba 6.814. Respuesta con ```` ```json ````, campos extra (`responseContract`, `severity`), 1 de 10 bloques | **Diagnóstico por hallazgo** para Chrome AI (`contracts/llm/diagnosisFragmentsV2.ts`): AURA fija los identificadores del envelope y Nano redacta los campos interpretativos con `responseConstraint`. El contrato ensamblado pasa por el mismo parser, validador y normalización. Resultado: 10/10 al primer intento, 108 s, «Contrato validado» |
| P2 | El streaming de Chrome nunca mostraba texto y generaba dos veces | Chrome 154 emite chunks `string`; `TextDecoder.decode(string)` lanzaba y caía a `prompt()`, que regeneraba todo | `readPromptStream` acepta string, bytes y modo acumulado; el respaldo con `prompt()` solo actúa si el stream no arranca |
| P3 | La sesión de Nano se reutilizaba entre diagnósticos | `getSession()` devolvía siempre la misma sesión, así que el contexto se acumulaba en cada intento | Sesión limpia por solicitud; base con instrucción de sistema clonada por fragmento |
| P4 | Bucle de espacios con `responseConstraint` | Con el schema completo Nano emitió `\n` sin fin | Guarda: si aparecen más de 64 espacios seguidos se aborta y se repite el fragmento (1 reintento) |
| P5 | Cancelar no detenía al modelo | Solo descartaba el resultado; Ollama tampoco tenía `AbortSignal` | `AbortController` desde la UI hasta Chrome y Ollama |
| P6 | Estadísticas por columna vacías al LLM | El envelope leía `distinctCount/nullPercentage/topValues/stats` y el motor emite `uniqueCount/topFreq`/campos planos: Cabin llegaba con `nullPercentage: 0` y `nullCount: 687` | `normalizeColumnStatsInput` acepta ambas formas |
| P7 | `LazyChromeProvider` ocultaba métodos | No reexponía `preloadModel`/`unloadModel`; «Preparar Gemini Nano» no descargaba por esta vía | Delegación completa |
| P8 | Respuesta cruda «no disponible» en la UI | El ZIP sí la tenía | La UI muestra la respuesta cruda o ensamblada y cada fragmento con sus hashes; el ZIP incluye `diagnosis/fragments/*.json` |
| P9 | Dataset completo en `localStorage` | 891 filas (245 KB) persistentes, mientras la UI decía «El archivo original no se guarda» | Ya no se guardan filas; las sesiones antiguas se purgan; si falla la escritura se borra la clave en vez de dejar una sesión obsoleta; la simulación pide reimportar con comprobación de SHA-256 |
| P10 | Longitudes calculadas con la muestra de 3 | Name: máximo 25 cuando hay nombres de 51+ caracteres | Cálculo sobre todos los valores, sin `Math.min(...spread)` |
| P11 | Perfil incoherente con las reglas | Parch con 213 «outliers» por IQR = 0; Age con 0 cuando la regla 1,5× marca 8 | Mismas guardas que las reglas (`outlierStatus`), conteos separados 3× y 1,5× |
| P12 | Copia equivocada | «se envía a Ollama» con proveedor Chrome; aviso de descarga en estado de error; «no un trabajo cognitivo interno» | Corregido |

El recibo registra `fragmentedExecution` (estrategia, número de solicitudes con reintentos, y hash de prompt y respuesta por hallazgo). `promptHash` sigue identificando el paquete canónico. Los recibos de una sola solicitud no cambian de hash.

Tests: 2.068 en verde (152 archivos), `tsc` limpio, `vite build` correcto. Nuevos: `diagnosisFragmentsV2.test.ts`, `chromePromptStream.test.ts`, `columnStatsProfile.test.ts`, `ReviewStep.rowsGuard.test.tsx`, `pipelineSession.test.ts`.

## 2. Pipeline: pendiente, por severidad

**Alta**
1. **API sin autenticación.** `api/src/index.ts` no tiene middleware de auth; `ai_config` es global para todos los usuarios y existen `DELETE /api/settings/:key` y `/api/sessions/:id` abiertos. El arranque sigue aunque falle la migración. `api/` tiene 0 tests.
2. **El recibo de privacidad usa datos de relleno.** `DiagnosisStep` llama a `generateQuickReceipt([['placeholder']], ['column'], …)`: el recibo no describe el dataset real.
3. **La ruta V1 legada sigue accesible** (`LegacyScriptGenerationStepV1`) y envía `sample_values`/`topFreq` sin pasar por `privacyPolicy`.
4. **«Solo local» no se impone.** `ollamaBaseUrl` es texto libre y `OllamaProvider` no comprueba loopback, aunque Privacidad afirma que nada sale del equipo.
5. **Se anuncia Latin-1 pero no se soporta.** `parseCsv` no fija la codificación, así que los acentos se corrompen sin aviso, y la verificación decodifica con `fatal: true`. Choca con el principio «preservar acentos».

**Media**
6. **Coerción numérica.** `"120"` y `"120.00"` se funden en frecuencias y únicos, y las muestras al LLM pierden el formato original (`001` sí se preserva).
7. **La copia corregida cambia el delimitador.** El runner siempre escribe comas, aunque la fuente use `;`.
8. **El recibo de inferencia de Chrome certifica parámetros de Ollama** (`numCtx 16384`, `numPredict 4096`) que nunca se aplicaron, y `inferenceHash` los firma.
9. **Reglas con falsos positivos estructurales.** «Cola larga categórica» sobre `Name` (identificador, 100 %); «Outliers extremos» sobre `Ticket` (texto/ID). El enmascarado es incoherente: `Name` viaja en claro mientras un `Fare` sale como `"1***8"` (número convertido en texto).
10. **Archivos grandes.** La auditoría corre en el hilo principal, con varias copias en memoria y el SHA en JS puro en la verificación.
11. **Parseo distinto entre carga y reauditoría.** La carga trata como fatal un número de columnas desigual; la reauditoría solo falla por comillas.
12. **Inyección de fórmulas en el CSV de hallazgos.** `csvCell` no neutraliza `= + - @`.
13. **`localStorage` conserva evidencia procesada** (176 KB, con muestras que pueden incluir nombres). Valorar `sessionStorage` o IndexedDB con caducidad.

**Baja**
14. La regla de fechas futuras depende del reloj: el mismo archivo puede puntuar distinto otro día.
15. Código muerto (`GeminiAdvisor`, proveedores cloud, `api.sessions`/`benchmarks`) y artefactos en la raíz (`source.csv`, `corrected.csv`, `receipt.json`, `execution-bundle.json`).
16. En el ZIP, `report/diagnostic-report.pdf` se describe como «Informe diagnóstico Showcase Ink» (`evidenceArchive.ts:224`).
17. Calidad de Nano. El validador solo comprueba literales entre comillas, así que una cifra mal citada sin comillas pasa: en la prueba, un fragmento dijo «3 filas (1,8 %)» donde había 16. Con más de ~20 hallazgos el diagnóstico superará 3 min; valorar priorizar por severidad y declarar la limitación.

## 3. UX/UI por etapa

Referencia: Design Context de `CLAUDE.md` (Editorial 1.2, sin rellenos ni cajas, una primaria por contexto, la conclusión antes que la maquinaria).

**Global**
- G1. **El scroll no vuelve arriba al cambiar de etapa** (Perfil → Diagnóstico → Reporte): se aterriza a media página y sin stepper.
- G2. **Los botones deshabilitados heredan el hover invertido** («Diagnosticando…», «Descargar evidencia» mientras genera): aparece un relleno gris que parece un estado pulsado.
- G3. **Exportación pierde el stepper** y lo sustituye por «Volver al informe diagnóstico»: la geometría no es estable.
- G4. **Nombres distintos para lo mismo**: «Informe» (inicio), «Reporte diagnóstico» (stepper), «Exportar informe». Elegir uno.
- G5. **Jerga y mezcla de idiomas en recibos y reporte**: `Estado: valid`, `smart_sample`, `Digest: n/d`, HITL, score, «script seguro», `108.6s` con punto decimal.
- G6. **Cajas contra la regla de no usar cajas**: borde discontinuo en Carga con riel «ENTRADA/00», tarjeta de progreso, dos cajas de error apiladas, «Puntos importantes» enmarcado, chips en la muestra de valores, barra IQR enmarcada y fila de etiquetas en cada hallazgo.
- G7. **Iconos Lucide en el chrome** (engranaje de proveedor, escudos, descargas): anti-referencia explícita.

**Inicio / Carga**
- La pantalla de reanudar no marca «Auditoría» como activa en la navegación.
- Carga promete «UTF-8 o Latin-1» (ver pipeline 5). Microcopy en cursiva y metáforas de «bandeja» y «registro de archivos».

**Perfil base**
- Buena conclusión primero («Requiere limpieza», 58/100).
- **Datos duplicados**: «Tipo y completitud» y «Perfil estadístico completo» repiten la misma información. Dentro del acordeón aparece otro encabezado numerado («01 Estructura»), así que la jerarquía no se entiende.
- **La selección de fila** dibuja un filete grueso en cada celda y el detalle repite la fila («Cabin: string. 687 nulos de 891 filas.»). La pista «Selecciona una fila» sigue visible después de seleccionar.
- El resumen mide ~650 px y las tablas ~1080: dos medidas distintas en la misma página.

**Diagnóstico**
- La línea de proveedor usa texto diminuto, «(Disponible)» entre paréntesis y «Configurar» en otra línea.
- **El fallo muestra dos cajas y tres acciones** (Generar, Reintentar, «Continuar sin diagnóstico»). «Continuar» oculta la consecuencia; mejor «Ir al reporte sin diagnóstico». Lo mismo con «Continuar al reporte diagnóstico →».
- Con el arreglo, el progreso por hallazgo (1 de 10…) y el stream en vivo hacen la espera legible. Siguiente paso posible: mostrar cada hallazgo ya diagnosticado como una línea legible, no como JSON.

**Reporte**
- **La cabecera** junta un H1 en columna estrecha con tres botones apilados a su derecha, todos con el mismo peso: incumple «una primaria por contexto».
- **Los conteos no cuadran**: «10 hallazgos», «15 hallazgos únicos», la sección «Hallazgos únicos 4» y «Ver 11 hallazgos más».
- **Gramática y acentos**: «hallazgo(s)», «1 son críticos», «columna unica», «Observacion principal».
- **La «Observación principal» toma el primer hallazgo del registro** (espacios en Name, informativo) y no el crítico (Cabin 77,1 %): debería ordenarse por severidad.
- «Usa el botón Exportar informe de arriba» es una referencia espacial; mejor un enlace directo.

**Exportación**
- «Remediación opcional: No ejecutada» aparece antes de los archivos, es decir, la maquinaria antes que el resultado.
- La descripción del ZIP promete «respuesta del modelo, recibo, plan, contrato, verificación, script» aunque no existan en esa sesión. Debería listar lo que contiene de verdad.
- Cada archivo lleva dos descripciones casi iguales.
- «Cerrar sesión y destruir datos locales» tiene el mismo peso visual que una descarga. Confirmar que pide confirmación y diferenciarlo como acción destructiva.

## 4. Siguiente loop sugerido

1. G1–G3 y los conteos y la gramática del Reporte: arreglos baratos con mucho efecto en la confianza.
2. Pipeline 1–5: seguridad y veracidad de las promesas de privacidad.
3. Pasada `quieter` sobre G6–G7 (cajas e iconos) siguiendo `2026-10-01-aura-sin-rellenos.md`.
