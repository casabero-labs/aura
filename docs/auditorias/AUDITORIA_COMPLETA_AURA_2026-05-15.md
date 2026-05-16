# Auditoria completa de AURA

Fecha: 2026-05-15  
Alcance: interfaz, arquitectura por capas, seguridad, motor determinista, modulo benchmark, documentacion TFM y reproducibilidad experimental.  
Estado: auditoria tecnica y academica previa a redisenar la interfaz.

## Resumen ejecutivo

AURA tiene una propuesta fuerte para el TFM: combinar privacidad local, reglas deterministas, analisis cognitivo anclado y benchmarking local vs cloud. Sin embargo, la implementacion actual todavia no comunica esa propuesta con la claridad que necesita. La interfaz se siente mas como una pagina de presentacion larga que como un laboratorio de auditoria de datos. Esto debilita la percepcion profesional del producto y tambien complica mostrar resultados cientificos.

El mayor riesgo tecnico no esta en la idea, sino en tres frentes:

1. Seguridad: hay dependencias con vulnerabilidades criticas y posibles exposiciones de API keys en el cliente.
2. Evidencia experimental: el modulo benchmark existe, pero aun no guarda resultados reproducibles ni controla costos/descargas al probar varios modelos.
3. Coherencia visual y documental: la carpeta `segunda_entrega` quedo saturada con notas de soporte, y la UI no refleja todavia la arquitectura de capas de forma operativa.

Mi recomendacion es no maquillar la interfaz actual. Conviene redisenarla como una consola de trabajo modular: Dataset, Capa 1 Motor Determinista, Capa 2 Analisis Cognitivo, Benchmark Experimental y Evidencia/Exportacion.

## Verificaciones ejecutadas

- `npm run build` en `src`: correcto. Advertencia: bundle JavaScript grande, aproximadamente 7.4 MB sin comprimir.
- `npm audit --audit-level=moderate` en `src`: falla con 11 vulnerabilidades, incluyendo 2 criticas.
- `npm audit --audit-level=moderate` en `experiments`: sin vulnerabilidades.
- Revision estatica de codigo con foco OWASP, logica de negocio, mantenibilidad, documentacion y alineacion TFM.

## Hallazgos criticos

### C1. Dependencias vulnerables en la aplicacion frontend

Ubicacion: `src/package-lock.json`, `src/package.json`

El audit de npm reporta 11 vulnerabilidades en `src`: 4 moderadas, 5 altas y 2 criticas. El riesgo mas delicado esta asociado a `protobufjs <=7.5.5`, dependencia transitiva probablemente relacionada con WebLLM. Tambien aparecen vulnerabilidades en `vite`, `rollup`, `picomatch`, `minimatch`, `postcss`, `dompurify` y paquetes derivados de `jspdf`.

Impacto:

- Riesgo de ejecucion o inyeccion de codigo por dependencias vulnerables.
- Riesgo reputacional si el TFM presenta AURA como herramienta de privacidad pero mantiene una cadena de dependencias vulnerable.
- Riesgo de bloqueo si la universidad o un evaluador ejecuta `npm audit`.

Accion recomendada:

- Actualizar dependencias con una rama especifica de seguridad.
- Probar si `@mlc-ai/web-llm` tiene version que resuelva `protobufjs`.
- Evaluar `overrides` solo si no rompe WebLLM.
- Actualizar `vite` y `jspdf` con pruebas de build y PDF.

Prioridad: critica.

### C2. Posible exposicion de API keys en el bundle y en localStorage

Ubicaciones:

- `src/vite.config.ts:13`
- `src/vite.config.ts:14`
- `src/vite.config.ts:15`
- `src/App.tsx:29`
- `src/App.tsx:38`
- `src/components/SettingsPanel.tsx:104`

El build define `process.env.API_KEY` y `process.env.GEMINI_API_KEY` dentro del cliente. Si existe `GEMINI_API_KEY` durante el build, la key puede quedar embebida en JavaScript distribuible. Ademas, la configuracion completa de IA se guarda en `localStorage`, incluyendo `apiKey` cuando el usuario usa cloud.

Impacto:

- API key persistente y legible por scripts, extensiones o XSS.
- Contradiccion directa con la narrativa de privacidad y soberania de datos.
- Riesgo economico por uso no autorizado de la API cloud.

Accion recomendada:

- Eliminar `process.env.API_KEY` y `process.env.GEMINI_API_KEY` de `vite.config.ts`.
- No persistir `apiKey` en `localStorage`; guardar solo proveedor, modelo y preferencias no sensibles.
- Mantener la API key en memoria de sesion o pedirla por ejecucion.
- Si AURA se despliega publicamente, usar backend/proxy o vault, no key directa en cliente.

Prioridad: critica.

## Hallazgos altos

### A1. La interfaz no representa un laboratorio cientifico de AURA

Ubicaciones:

- `src/App.tsx:130`
- `src/App.tsx:180`
- `src/App.tsx:216`
- `src/index.css:13`
- `src/index.css:14`
- `src/index.css:15`
- `src/index.css:16`

La UI actual usa un hero, una bitacora tipo terminal y muchas tarjetas verticales. Esto comunica una narrativa interesante, pero no ayuda a operar una herramienta cientifica. El usuario necesita comparar modelos, revisar reglas, auditar evidencia y exportar resultados. Esas tareas requieren una interfaz de trabajo mas densa, modular y verificable.

Problemas concretos:

- La navegacion lateral parece real pero no cambia de vista ni lleva a secciones.
- La paleta se apoya demasiado en beige/crema/tinta y se siente monotona.
- El benchmark queda enterrado despues del flujo principal.
- No hay una vista clara de arquitectura por capas.
- La herramienta no prioriza tabulacion, filtros, tablas, comparacion ni exportacion.

Accion recomendada:

- Replantear la UI como workspace con tabs o vistas: `Dataset`, `Reglas`, `Cognitivo`, `Benchmark`, `Evidencia`.
- Colocar el score, estado de capas y controles de ejecucion en una barra superior compacta.
- Usar tablas densas para hallazgos y resultados.
- Reducir discurso visual y aumentar accion: cargar, auditar, comparar, exportar.

Prioridad: alta.

### A2. El boton "Probar todos los LLM" puede disparar descargas y llamadas costosas

Ubicaciones:

- `src/components/BenchmarkPanel.tsx:81`
- `src/components/BenchmarkPanel.tsx:83`
- `src/components/BenchmarkPanel.tsx:84`
- `src/components/BenchmarkPanel.tsx:85`
- `src/components/BenchmarkPanel.tsx:186`

El boton ejecuta todos los modelos locales y cloud en dos modos de entrada. En local, esto puede implicar descargas pesadas de modelos WebLLM. En cloud, puede implicar multiples llamadas API. No hay confirmacion, estimacion, cancelacion ni control de presupuesto.

Impacto:

- Mala experiencia de usuario.
- Consumo inesperado de datos, tiempo, GPU y cuota cloud.
- Resultados experimentales contaminados por ejecuciones incompletas.

Accion recomendada:

- Reemplazar el boton por una configuracion de suite experimental con seleccion explicita.
- Mostrar numero de ejecuciones, modelos, coste estimado y tiempo esperado.
- Agregar cancelacion y progreso por modelo.
- Permitir repetir N veces por modelo para obtener promedios y desviacion.

Prioridad: alta.

### A3. El benchmark no produce evidencia reproducible

Ubicaciones:

- `src/components/BenchmarkPanel.tsx:21`
- `src/components/BenchmarkPanel.tsx:22`
- `src/services/benchmarkService.ts:42`
- `src/services/benchmarkService.ts:77`
- `src/services/benchmarkService.ts:99`

Los resultados viven solo en estado React. No se exportan como JSON/CSV ni se guardan con version del dataset, hash del reporte, modelo, modo de entrada, prompt, timestamp y salida cruda. Para publicacion cientifica, esto todavia no basta.

Impacto:

- No hay trazabilidad completa.
- No se pueden reproducir tablas del TFM desde evidencia bruta.
- Se dificulta defender conclusiones sobre reduccion de alucinaciones.

Accion recomendada:

- Agregar exportacion JSON y CSV desde el modulo benchmark.
- Guardar `dataset_hash`, `audit_report_hash`, `prompt_hash`, modelo, proveedor, temperatura, modo, latencias, salida cruda y metricas.
- Separar claramente resultados validos de errores o ejecuciones manuales fallidas.

Prioridad: alta.

### A4. El desglose de score no coincide siempre con la penalizacion real

Ubicaciones:

- `src/services/auditEngine.ts:455`
- `src/services/auditEngine.ts:456`
- `src/services/auditEngine.ts:464`
- `src/services/auditEngine.ts:465`
- `src/services/auditEngine.ts:600`

Algunas penalizaciones se suman directamente con `penaltyPoints += ...` y no pasan por `addDeduction`. Esto hace que el score total pueda bajar sin que el `ScoreBreakdown` explique por que.

Impacto:

- Inconsistencia en la Capa 1.
- El usuario no puede auditar completamente la puntuacion.
- Debilita la trazabilidad que se quiere defender en el TFM.

Accion recomendada:

- Reemplazar esas sumas directas por `addDeduction`.
- Agregar test que valide que la suma de deducciones coincide con `100 - score`.

Prioridad: alta.

### A5. El esquema Gemini no incluye `python_script`, aunque el benchmark lo mide

Ubicaciones:

- `src/services/providers/geminiProvider.ts:117`
- `src/services/providers/geminiProvider.ts:126`
- `src/services/providers/geminiProvider.ts:128`
- `src/services/benchmarkService.ts:100`
- `src/services/benchmarkService.ts:121`

El tipo `ExecutiveReportContent` admite `python_script`, y el benchmark mide si existe script HITL. Pero el `responseSchema` de Gemini no declara `python_script`. Si el proveedor respeta el schema, esa propiedad puede no aparecer.

Impacto:

- Metrica HITL falsa o incompleta.
- Inconsistencia entre Capa 3 y benchmark.
- El PDF puede no incluir evidencia accionable si depende de ese campo.

Accion recomendada:

- Agregar `python_script` al schema cuando el flujo requiera reporte ejecutivo con correccion HITL.
- O separar dos flujos: `executive_report` y `remediation_script`.

Prioridad: alta.

## Hallazgos medios

### M1. La metrica de alucinacion de columnas es todavia debil

Ubicaciones:

- `src/services/benchmarkService.ts:9`
- `src/services/benchmarkService.ts:14`
- `src/services/benchmarkService.ts:18`

La deteccion actual busca cadenas entre comillas o columnas usadas como `df['columna']`. Esto puede marcar falsos positivos, por ejemplo conceptos, nombres de archivo o etiquetas, y puede no detectar columnas inventadas si el modelo no las cita entre comillas.

Accion recomendada:

- Renombrarla como metrica proxy.
- Agregar validacion semantica por AST para scripts Python.
- Medir tambien: cumplimiento de columnas conocidas, afirmaciones no soportadas, uso de evidencias `bad_samples`, y referencias a reglas reales.

Prioridad: media.

### M2. El modo `prompt_libre` no es completamente libre

Ubicacion: `src/services/benchmarkService.ts:32`

El prompt libre incluye columnas y score. Eso esta bien como contraste controlado, pero no debe describirse como prompt sin control. Es mas correcto llamarlo `esquema_minimo` o `baseline_no_anclado`.

Accion recomendada:

- Renombrar `prompt_libre` a `baseline_esquema`.
- Definir experimentalmente tres condiciones: esquema minimo, smart sample, smart sample + salida estructurada.

Prioridad: media.

### M3. La regla R23 puede tener falsos positivos o lecturas ambiguas

Ubicaciones:

- `src/services/auditEngine.ts:542`
- `src/services/auditEngine.ts:543`
- `src/services/auditEngine.ts:547`
- `src/services/auditEngine.ts:572`
- `src/services/auditEngine.ts:574`

La regla de redundancia temporal derivable es pertinente para tu ejemplo `datetime` + `time`, pero debe ser mas conservadora. Hoy se apoya en candidatos por nombre y valores, y reporta porcentaje sobre filas comparables, no sobre total de filas.

Accion recomendada:

- Exigir umbral minimo de cobertura sobre el total de filas.
- Separar `match_pct_comparable` y `coverage_pct_total`.
- Reportar confianza: baja, media, alta.
- Agregar test con `datetime` + `time`, y otro donde `time` no deriva de `datetime`.

Prioridad: media.

### M4. Servicio Gemini legado duplica logica y puede confundir el flujo

Ubicaciones:

- `src/services/geminiService.ts:1`
- `src/services/geminiService.ts:4`
- `src/services/geminiService.ts:156`

Existe un servicio Gemini antiguo junto al nuevo `GeminiProvider`. Aunque no parece ser el flujo principal, mantiene prompts, lectura de API key y schema duplicados.

Accion recomendada:

- Eliminarlo si no se usa.
- O marcarlo como legacy y migrar todo a providers.

Prioridad: media.

### M5. La carpeta `segunda_entrega` quedo mezclando entregables y notas de trabajo

Ubicacion: `docs/memoria/entregas/segunda_entrega/`

Actualmente hay multiples archivos Markdown de soporte: linea oficial, diagnosticos, observaciones, planes, analisis y situaciones de dataset. Esto responde a una necesidad de trabajo, pero no es ideal para la entrega formal.

Accion recomendada:

- Dejar en `segunda_entrega` solo el Word, anexos formales y un `README.md` de control.
- Mover observaciones internas a `docs/memoria/entregas/segunda_entrega/_soporte/` o a `docs/auditorias/`.
- Crear una tabla de control: documento, proposito, usar en Word si/no, estado.

Prioridad: media.

### M6. Hay artefactos documentales antiguos que contradicen la linea actual

Ubicaciones:

- `docs/design/aura_propuesta_definitiva.html`
- `docs/tablas/resultados_benchmark_llm.md:14`
- `docs/tablas/resultados_benchmark_llm.md:15`
- `docs/tablas/resultados_benchmark_llm.md:16`
- `experiments/results/benchmark_multimodelo.json:6`
- `experiments/results/benchmark_multimodelo.json:13`

El prototipo HTML y las tablas de benchmark tienen placeholders o resultados fallidos con API key invalida. No deben aparecer como evidencia real.

Accion recomendada:

- Archivar prototipos antiguos bajo `docs/archive/`.
- Marcar tablas placeholder como `pendiente`.
- Excluir resultados con error de las tablas finales, o etiquetarlos como ejecuciones fallidas.

Prioridad: media.

### M7. Bundle demasiado grande para la carga inicial

Ubicacion: `src/package.json`

El build genera un chunk grande, muy probablemente por WebLLM y dependencias asociadas. Para una app local-first es aceptable que el modelo pese, pero no que toda la aplicacion cargue ese peso desde el inicio si el usuario aun no ha elegido benchmark local.

Accion recomendada:

- Cargar WebLLM con dynamic import solo cuando se use proveedor local.
- Separar el modulo benchmark en lazy route o lazy component.
- Medir tiempo de carga inicial y memoria.

Prioridad: media.

### M8. La UI afirma `PII SAFE` incluso cuando el modo puede ser cloud

Ubicaciones:

- `src/App.tsx:146`
- `src/App.tsx:148`
- `src/App.tsx:150`

La fase determinista local es privada, pero en modo cloud se envia un smart sample. La etiqueta `PII SAFE` es demasiado absoluta.

Accion recomendada:

- Cambiar a estados contextuales: `Local`, `Smart sample`, `Cloud activo`.
- Mostrar advertencia si hay PII detectada y el usuario intenta usar cloud.

Prioridad: media.

## Hallazgos bajos

### B1. Estado no usado

Ubicaciones:

- `src/App.tsx:18`
- `src/App.tsx:27`
- `src/App.tsx:63`
- `src/App.tsx:104`

`file` y `lastMetrics` se almacenan, pero no se aprovechan visualmente. Es una oportunidad para mostrar nombre de dataset, ultima latencia, proveedor y reproducibilidad.

Prioridad: baja.

### B2. Navegacion lateral sin comportamiento real

Ubicaciones:

- `src/App.tsx:130`
- `src/App.tsx:131`
- `src/App.tsx:132`
- `src/App.tsx:133`
- `src/App.tsx:134`

Los botones laterales no tienen `onClick`, rutas ni anclas. Generan expectativa de modulo, pero no ejecutan ninguna navegacion.

Prioridad: baja si se redisenia la UI; alta si se conserva la estructura actual.

### B3. Mensajes y versionado visual pueden quedar desactualizados

Ubicaciones:

- `src/App.tsx:159`
- `src/App.tsx:183`
- `src/App.tsx:188`

La UI muestra version fija `v1.0.4` y `22+ reglas`, mientras el motor ya incluye la regla R23. Esto debe derivarse de constantes o del catalogo de reglas.

Prioridad: baja.

## Evaluacion frente a las capas propuestas

### Capa 0. Infraestructura local y privacidad

Implementada parcialmente. La app arranca en modo local y usa WebLLM/WebGPU como proveedor principal. El problema es que la seguridad de API keys y el mensaje `PII SAFE` deben corregirse para no contradecir la promesa de privacidad.

Estado: correcto conceptualmente, incompleto en seguridad y comunicacion.

### Capa 1. Motor determinista

Implementada con una base fuerte. La regla R23 para redundancia temporal va en la direccion correcta. Falta reforzar trazabilidad del score, pruebas unitarias por regla y mejor explicacion visual de cada hallazgo.

Estado: solido, con bugs de score breakdown y necesidad de tests.

### Capa 2. Estabilidad cognitiva

Implementada mediante smart sample, temperatura baja y salida estructurada. El benchmark empieza a medir si esto reduce alucinaciones frente a una entrada menos controlada, pero la metrica actual aun es proxy.

Estado: prometedor, requiere formalizar condiciones experimentales.

### Capa 3. Gobernanza HITL

Parcial. La idea del script Python revisable esta en el diseno, pero el schema Gemini puede impedir que `python_script` exista. Ademas falta que el usuario apruebe, descargue, versione o compare scripts generados.

Estado: incompleto para defender como capa operativa.

### Capa 4. Benchmark y evidencia experimental

Iniciada. Ya existe modulo local vs cloud, pero no produce evidencia persistente ni estadisticas repetibles. Para publicacion, debe convertirse en una suite experimental con exportacion, repeticiones y control de variables.

Estado: prototipo funcional, no todavia instrumento cientifico.

## Redireccion recomendada para la interfaz

La interfaz nueva deberia abandonar el formato de pagina hero y pasar a una consola modular:

1. Barra superior: dataset activo, modo local/cloud, score, estado WebGPU, boton exportar.
2. Sidebar real: Dataset, Capa 1, Capa 2, Benchmark, Evidencia.
3. Vista Dataset: carga, preview, perfil de columnas, hash del archivo.
4. Vista Capa 1: tabla de reglas, severidad, columna, muestras, deduccion y explicabilidad.
5. Vista Capa 2: smart sample, prompt, respuesta, metricas del proveedor.
6. Vista Benchmark: matriz modelo x condicion, repeticiones, latencia, JSON, alucinaciones proxy, exportacion.
7. Vista Evidencia: resultados guardados, tablas listas para TFM, anexos y trazabilidad.

Esto haria que AURA destaque donde debe: no como chatbot ni dashboard bonito, sino como instrumento reproducible de auditoria de calidad de datos con IA controlada.

## Plan de correccion sugerido

1. Seguridad primero:
   - Quitar secrets del bundle.
   - No guardar API keys en `localStorage`.
   - Resolver `npm audit` critico.

2. Redisenio UI:
   - Convertir la app en workspace por modulos.
   - Eliminar hero como pantalla principal.
   - Rehacer benchmark como tabla experimental, no como tarjeta decorativa.

3. Motor determinista:
   - Corregir score breakdown.
   - Endurecer R23.
   - Crear tests para reglas clave.

4. Benchmark:
   - Exportar resultados.
   - Agregar repeticiones y hashes.
   - Distinguir condiciones experimentales con nombres academicos.

5. Documentacion:
   - Separar entrega formal de notas de trabajo.
   - Archivar prototipos antiguos.
   - Reemplazar placeholders por resultados reales o marcarlos como pendientes.

## Conclusion

AURA va por buen camino en concepto, pero la interfaz actual no esta a la altura de la tesis que estas defendiendo. La herramienta debe sentirse menos como presentacion y mas como banco de pruebas. La arquitectura de capas ya existe en parte del codigo, especialmente en Capa 0, Capa 1 y el primer benchmark, pero necesita seguridad, trazabilidad y una interfaz que deje ver claramente la ciencia detras del sistema.

La siguiente decision correcta no es ajustar colores: es redisenar el flujo completo para que cada capa sea visible, operable y medible.
