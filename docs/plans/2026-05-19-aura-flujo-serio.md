# AURA Flujo Serio Implementation Plan
> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Convertir AURA en un flujo serio, claro y defendible para TFM, empezando por una pestaña Perfilar que demuestre OE2 sin ruido, y continuando con Diagnostico, Script, Revision y Benchmark.
**Architecture:** Separar UI por etapas con contratos explicitos: upload local -> perfil determinista -> diagnostico asistido -> script validado -> revision humana -> evidencia experimental/exportable.
**Tech Stack:** React, TypeScript, Vite, Vitest, CSS existente en `src/index.css`, servicios actuales de AURA.
---

## Principio rector

La interfaz no debe asumir que el usuario sabe que ocurre por dentro. Cada etapa debe contestar:

- que esta haciendo AURA;
- que evidencia usa;
- que produce;
- que puede hacer el usuario;
- que pasa a la siguiente etapa;
- que parte corresponde a cada OE del TFM.

## Diagnostico inicial

### Upload

Problema actual:

- `src/components/FileUpload.tsx` es demasiado generico.
- La zona de drop no explica limite de filas, privacidad, formato esperado ni que se ejecutara despues.
- No hay estado visual de arrastre, archivo seleccionado, error de tipo o guia de dataset.

Pregunta de producto:

> Si alguien abre AURA por primera vez, entiende que el CSV se procesa localmente y que el primer resultado sera un perfil determinista?

Respuesta actual: parcialmente.

### Perfilar

Problema actual:

- Ya se limpio bastante el lenguaje de IA, pero la etapa sigue siendo visualmente pesada.
- Hay demasiadas piezas una debajo de otra sin jerarquia de decision.
- El usuario ve score, reglas, columnas, hallazgos y JSON, pero falta una lectura guiada: "que se valido", "que se encontro", "que evidencia se pasa".

Pregunta de producto:

> La pestaña demuestra OE2: reglas explicitas, regex, heuristica de tipos y estadistica descriptiva?

Respuesta actual: si en contenido, no suficientemente en narrativa visual.

### Diagnostico

Problema actual:

- Mezcla configuracion de modelo, evidencia, prompt y salida.
- Puede parecer una consola de IA en lugar de una etapa de interpretacion sobre evidencia determinista.
- Debe explicar claramente que el LLM recibe hallazgos estructurados, no el dataset completo.

Pregunta de producto:

> El usuario entiende que diagnostico es interpretacion asistida y no evidencia factual primaria?

Respuesta actual: parcialmente.

### Script y revision

Problema actual:

- Generacion de script y revision humana estan separadas correctamente, pero falta una progresion mas formal.
- La validacion del script debe ser una matriz clara: columnas existentes, operaciones destructivas, cobertura de issues, requiere revision.
- El usuario necesita saber cuando un script esta listo para aprobarse y cuando no.

Pregunta de producto:

> El usuario entiende por que no debe ejecutar ciegamente el script?

Respuesta actual: necesita mejorar.

### Benchmark

Problema actual:

- El titulo del TFM da importancia al benchmarking, pero el laboratorio aun se siente separado y poco protocolizado.
- Necesita registrar dataset, modelo, proveedor, temperatura, input mode, estado de evidencia y export.

Pregunta de producto:

> El benchmark produce evidencia formal para sostener el documento?

Respuesta actual: la arquitectura existe, pero falta protocolo UI y corridas exportables.

## Fase 1 - Upload serio

### Task 1: Redisenar FileUpload como entrada local-first

**Files:**

- Modify: `src/components/FileUpload.tsx`
- Modify: `src/index.css`
- Test: `src/__tests__/datasetFlow.test.ts` o nuevo `src/__tests__/uiCopy.test.ts`

**Step 1: Write failing test**

Agregar un test simple de constantes/copy si se extraen textos a un helper:

```ts
import { uploadCopy } from '../components/FileUpload';

it('explains local-first upload before profiling', () => {
  expect(uploadCopy.title).toContain('Cargar CSV local');
  expect(uploadCopy.privacy).toContain('navegador');
  expect(uploadCopy.nextStep).toContain('perfil determinista');
});
```

**Step 2: Verify Failure**

Command: `npm test -- --run src/__tests__/uiCopy.test.ts`

Expected: falla porque `uploadCopy` no existe.

**Step 3: Implementation**

- Exportar `uploadCopy` desde `FileUpload.tsx`.
- Agregar estados:
  - `isDragging`;
  - `selectedName`;
  - `error`.
- Validar extension `.csv`.
- Cambiar estructura visual:
  - encabezado: "Cargar CSV local";
  - subtitulo: "El archivo se lee en el navegador antes de cualquier diagnostico";
  - checklist lateral: `CSV`, `max 5.000 filas preview`, `perfil determinista`, `sin envio del archivo crudo`;
  - CTA: `Seleccionar archivo`.

**Step 4: Verify Success**

Command: `npm test`

Expected: PASS.

## Fase 2 - Perfilar como evidencia OE2

### Task 2: Crear resumen ejecutivo de perfil determinista

**Files:**

- Create: `src/components/ProfileStageHeader.tsx`
- Modify: `src/components/ProfileStep.tsx`
- Modify: `src/index.css`
- Test: `src/__tests__/profileEvidence.test.ts`

**Step 1: Write failing test**

```ts
import { buildProfileStageModel } from '../components/ProfileStageHeader';
import { makeAuditReportFixture } from './testFixtures';

it('describes profiling without AI language', () => {
  const model = buildProfileStageModel(makeAuditReportFixture());
  expect(model.stage).toBe('Perfil del dataset');
  expect(model.output).toContain('hallazgos reproducibles');
  expect(JSON.stringify(model).toLowerCase()).not.toContain('ia');
  expect(JSON.stringify(model).toLowerCase()).not.toContain('llm');
});
```

**Step 2: Verify Failure**

Command: `npm test -- --run src/__tests__/profileEvidence.test.ts`

Expected: falla por componente/helper inexistente.

**Step 3: Implementation**

- Crear helper `buildProfileStageModel(report)`.
- Mostrar arriba de Perfilar:
  - `Entrada`: CSV parseado localmente.
  - `Motor`: reglas explicitas, regex, tipos, estadistica.
  - `Salida`: hallazgos reproducibles + paquete estructurado.
  - `Siguiente`: diagnostico asistido.
- Mantener cero referencias a IA/LLM en esta etapa.

**Step 4: Verify Success**

Command: `npm test`

Expected: PASS.

### Task 3: Reordenar Perfilar en tres bloques

**Files:**

- Modify: `src/components/ProfileStep.tsx`
- Modify: `src/components/DeterministicEngineSummary.tsx`
- Modify: `src/components/FindingsTable.tsx`
- Modify: `src/index.css`

**Implementation order:**

1. Bloque `1. Caracterizacion del dataset`
   - `DatasetProfile`
   - columnas, filas, delimiter, fingerprint, tiempos.
2. Bloque `2. Validacion determinista`
   - `DeterministicEngineSummary`
   - score y breakdown
   - `RuleActivationMatrix`
3. Bloque `3. Hallazgos y paquete estructurado`
   - `FindingsTable`
   - `ColumnStatsPanel`
   - `BoxPlot` solo si aplica
   - `ProfileEvidencePackage`

**Acceptance criteria:**

- La etapa contesta "que se valido" antes de mostrar detalles.
- El paquete estructurado aparece al final.
- CTA final dice `Abrir diagnostico`.
- No aparece "analizar con IA", "capa 1", "smart sample" ni "JSON exacto enviado a LLM".

**Verification command:**

`rg -n "analizar con IA|JSON exacto|capa 1|LLM|IA" src/components/ProfileStep.tsx src/components/ProfileEvidencePackage.tsx src/components/DeterministicEngineSummary.tsx`

Expected: no resultados visibles en UI de Perfilar.

### Task 4: Mejorar tabla de hallazgos para lectura humana

**Files:**

- Modify: `src/components/FindingsTable.tsx`
- Modify: `src/index.css`

**Implementation:**

- Agregar barra de filtros:
  - severidad;
  - familia;
  - columna.
- Agregar columna `Accion sugerida` con texto determinista, no LLM:
  - critical: "revisar antes de usar";
  - warning: "validar impacto";
  - info: "documentar o normalizar si aplica".
- Agregar resumen previo:
  - total hallazgos;
  - criticos;
  - columnas afectadas;
  - top regla.

**Acceptance criteria:**

- Un usuario puede ubicar problemas criticos sin leer toda la tabla.
- La tabla no ocupa todo el protagonismo si no hay hallazgos.

## Fase 3 - Diagnostico serio

## Progreso aplicado - limpieza fuerte del flujo visible

Fecha: 2026-05-19.

Decision tomada: la interfaz principal no debe mostrar artefactos tecnicos repetidos ni nombres internos de capas. La pantalla debe guiar el flujo TFM; los detalles exhaustivos deben quedar para PDF, JSON o CSV exportables.

Cambios aplicados:

- Se elimino `PipelineChecklist.tsx` porque mantenia el lenguaje de "carta abierta", capas tecnicas y Smart Sample en pantalla. No estaba conectado al flujo actual y representaba deuda de interfaz.
- Se elimino `DiagnosticTerminal.tsx` porque repetia una bitacora rule-by-rule que compite con hallazgos y reporte detallado.
- Se eliminaron componentes antiguos no conectados al flujo actual: `AnalysisStep.tsx`, `AcademicFooter.tsx`, `DataProfile.tsx`, `IssueList.tsx`, `ScoreBreakdown.tsx`, `ScoreGauge.tsx`, `SmartSampleViewer.tsx`, `ExecutionEvidencePanel.tsx` y `EvidenceCyclePanel.tsx`.
- En `ProfileEvidencePackage.tsx`, el paquete tecnico queda como cierre colapsado: se muestra resumen y boton de copia; el JSON completo solo aparece si el usuario pide "Ver estructura tecnica".
- En `App.tsx`, la exportacion deja de decir "Informe y evidencia listos para llevar", "JSON audit" y "CSV issues"; ahora se presenta como reporte principal con anexos tecnicos.
- En navegacion, se cambiaron textos visibles como "CAPA 0" y "CAPA 2" por estados comprensibles: `LOCAL-FIRST ACTIVO` y `MODO CLOUD ACTIVO`.

Validacion:

- `rg` no encuentra en componentes visibles las frases rechazadas: `carta abierta`, `SMART SAMPLE`, `JSON EXACTO`, `Informe y evidencia`, `JSON audit`, `CSV issues`, `CAPA 0`, `NUBE HIBRIDA`, `analisis IA`.
- `npm test` pasa con 20 tests.
- `npx tsc --noEmit --pretty false` pasa sin errores.

Pendiente inmediato:

- Revisar visualmente en navegador la nueva etapa Perfilar con un dataset real.
- Aplicar el mismo criterio de simplificacion a Diagnostico: reducir configuracion/prompts visibles, explicar problema de calidad en lenguaje natural y mover prompts/detalle tecnico a anexos.
- Aplicar el mismo criterio a Script y Revision: presentar decision, validacion y aprobacion humana sin ruido de implementacion.

### Task 5: Separar configuracion, evidencia y salida en Diagnostico

**Files:**

- Modify: `src/components/DiagnosisStep.tsx`
- Modify: `src/index.css`
- Test: `src/__tests__/diagnosisContract.test.ts`

**Step 1: Write failing test**

```ts
import { buildDiagnosisInputSummary } from '../components/DiagnosisStep';
import { makeAuditReportFixture } from './testFixtures';

it('states that diagnosis receives structured findings only', () => {
  const summary = buildDiagnosisInputSummary(makeAuditReportFixture());
  expect(summary.input).toContain('hallazgos estructurados');
  expect(summary.rawDatasetAccess).toBe(false);
});
```

**Step 2: Implementation**

- Exportar helper `buildDiagnosisInputSummary`.
- Estructura:
  - `Entrada recibida`: resumen del paquete.
  - `Modelo seleccionado`: local/cloud y advertencia.
  - `Diagnostico`: salida textual.
  - `Trazabilidad`: hash, latencia, tokens.
- Mover prompt completo a modal secundario, no visible por defecto.
- Cambiar CTA:
  - `Generar diagnostico`;
  - luego `Continuar a script`.

**Acceptance criteria:**

- La pantalla no parece "chat libre".
- Queda claro que el LLM no ve el dataset crudo.

## Progreso aplicado - etapa Diagnostico

Fecha: 2026-05-19.

Decision tomada: Diagnostico debe presentarse como interpretacion asistida sobre hallazgos estructurados, no como una pantalla de prompt o una consola de modelo.

Cambios aplicados:

- `DiagnosisStep.tsx` exporta `buildDiagnosisInputSummary(report)` para dejar un contrato testeable de entrada/salida.
- La pantalla inicia con un bloque de contrato:
  - entrada: hallazgos estructurados del perfil determinista;
  - acceso al archivo crudo: no;
  - salida esperada: causas probables, prioridades de limpieza y criterios para generar script.
- Se agrego un bloque "problema observado" antes de ejecutar el diagnostico, con:
  - principal senal de calidad;
  - riesgo agregado;
  - paquete usado.
- La seleccion local/cloud se mantiene, pero se presenta como modo de ejecucion y no como centro conceptual de la etapa.
- El paquete estructurado queda oculto bajo "Ver estructura tecnica".
- El prompt completo deja de llamarse "Prompt enviado al LLM" y pasa a "Contrato tecnico de interpretacion".
- `GeminiAdvisor.tsx` deja de mostrar "Analisis LLM observado" y ahora muestra "Diagnostico generado".
- Se agregaron estilos en `src/index.css` para el contrato, problema observado y tarjetas de diagnostico.
- El test `uiFlowContracts.test.ts` ahora comprueba que Diagnostico recibe hallazgos estructurados y no accede al archivo crudo.

Validacion:

- `npm test` pasa con 21 tests.
- `npx tsc --noEmit --pretty false` pasa sin errores.
- `npm run build` pasa.
- `rg` no encuentra las frases antiguas de Diagnostico: `Analisis LLM`, `analisis IA`, `Prompt enviado al LLM`, `Ver prompt enviado`, `paquete enviado al modelo`, `JSON que se inyecta`.

## Fase 4 - Script y revision humana

### Task 6: Convertir validacion de script en matriz de aprobacion

**Files:**

- Modify: `src/components/ScriptGenerationStep.tsx`
- Modify: `src/components/ReviewStep.tsx`
- Modify: `src/services/scriptValidationService.ts`
- Test: `src/__tests__/improvementLoop.test.ts`

**Implementation:**

- Mostrar matriz:
  - `Columnas existentes`;
  - `Cobertura de hallazgos`;
  - `Operaciones destructivas`;
  - `Uso de Pandas`;
  - `Requiere revision humana`.
- Agregar estado claro:
  - `No generado`;
  - `Generado con advertencias`;
  - `Listo para revision`;
  - `Aprobado`.

**Acceptance criteria:**

- El usuario sabe por que puede o no aprobar.
- La etapa de revision no duplica la generacion.

## Progreso aplicado - Script, Revision y evidencia para Capitulo 5

Fecha: 2026-05-19.

Decision tomada: la generacion de script no puede depender exclusivamente de una respuesta JSON perfecta del proveedor. Si el proveedor falla, AURA debe conservar el flujo usando hallazgos deterministas y marcando el resultado para revision humana.

Cambios aplicados:

- Se agrego `src/services/deterministicScriptBuilder.ts` para generar un script Pandas base desde acciones deterministas cuando el proveedor no entrega `python_script` valido.
- `ScriptGenerationStep.tsx` ahora:
  - intenta usar el proveedor configurado;
  - si falla o no entrega script, genera respaldo determinista;
  - muestra origen del script (`modelo` o `determinista`);
  - presenta una matriz de validacion: columnas existentes, cobertura de hallazgos, operaciones destructivas, uso de Pandas y revision humana.
- `ReviewStep.tsx` ahora muestra una decision de revision separada de la generacion, con checks de script disponible, columnas, cobertura, riesgo y simulacion.
- `scriptValidationService.ts` elimina lenguaje interno de capas y reporta trazabilidad contra hallazgos del perfil determinista.
- Se agregaron datasets sinteticos en `docs/evidence/datasets/`:
  - `clientes_sucio.csv`;
  - `inventario_sucio.csv`;
  - `operaciones_sucio.csv`.
- Se generaron capturas en `docs/evidence/screenshots/` para Perfilar, Diagnostico, Script y Revision.
- Se genero el diagrama `docs/evidence/screenshots/aura-arquitectura-flujo.png`.
- Se actualizo `docs/memoria/entregas/segunda_entrega/Segunda_Entrega_TFM_Joseph_Gari_Borrador_Estructurado.docx` con:
  - requisitos funcionales y no funcionales;
  - arquitectura funcional local-first;
  - tabla de resultados de los tres datasets;
  - capturas del funcionamiento;
  - evaluacion preliminar de aplicabilidad, usabilidad y benchmark.

Validacion:

- `npm test` pasa con 22 tests.
- `npx tsc --noEmit --pretty false` pasa sin errores.
- `npm run build` pasa.
- Se verifico estructuralmente el `.docx`: 46 encabezados, 2 tablas y 8 imagenes embebidas.
- No se pudo renderizar el Word con `render_docx.py` porque falta `soffice`/LibreOffice en el entorno local.

### Task 7: Mejorar ScriptReview para experiencia de auditor

**Files:**

- Modify: `src/components/ScriptReview.tsx`
- Modify: `src/index.css`

**Implementation:**

- Separar en dos paneles:
  - izquierda: script editable;
  - derecha: checklist de validacion y hallazgos cubiertos.
- Agregar boton `Restaurar script generado`.
- Agregar confirmacion antes de aprobar si hay advertencias destructivas.

**Acceptance criteria:**

- El usuario entiende que aprobar no ejecuta sobre el CSV original, sino que registra una simulacion segura.

## Fase 5 - Benchmark que sostenga el titulo

### Task 8: Protocolizar BenchmarkLab

**Files:**

- Modify: `src/components/BenchmarkLab.tsx`
- Modify: `src/components/ExperimentDesigner.tsx`
- Modify: `src/services/benchmark/evaluationService.ts`
- Test: `src/__tests__/benchmarkProtocol.test.ts`

**Implementation:**

- Mostrar bloque `Protocolo experimental`:
  - dataset fingerprint;
  - filas/columnas;
  - modelo;
  - proveedor;
  - temperatura;
  - input mode;
  - estado de evidencia.
- Boton `Exportar benchmark JSON` directo desde `BenchmarkLab`.
- Persistir resultados en `localStorage` por fingerprint.
- Comparacion rapida obligatoria:
  - `smart_sample`;
  - `prompt_libre`.

**Acceptance criteria:**

- El benchmark genera evidencia usable para el documento.
- No se confunden intentos fallidos con resultados validos.

## Fase 6 - QA visual y limpieza

### Task 9: Crear checklist de textos prohibidos por etapa

**Files:**

- Create: `src/__tests__/uiLanguageBoundaries.test.ts`

**Test cases:**

- Perfilar no contiene `IA`, `LLM`, `smart sample`, `diagnostico`.
- Diagnostico no dice que los resultados son evidencia factual.
- Script no permite aprobacion sin script generado.
- Benchmark muestra `preliminary_valid` o `attempted_failed`.

**Verification command:**

`npm test`

### Task 10: Verificar en navegador

**Files:**

- No code changes.

**Steps:**

1. `npm run dev -- --host 127.0.0.1 --port 5173`
2. Abrir `http://127.0.0.1:5173`.
3. Capturar:
   - upload;
   - perfilar;
   - diagnostico;
   - script;
   - revision;
   - benchmark.
4. Revisar mobile y desktop.

**Acceptance criteria:**

- Sin solapamientos.
- Textos legibles.
- CTA unico y claro por etapa.
- Perfilar queda defendible como OE2.

## Orden de ejecucion recomendado

1. Fase 1: Upload serio.
2. Fase 2: Perfilar completo.
3. Verificacion visual de Perfilar.
4. Fase 3: Diagnostico.
5. Fase 4: Script y Revision.
6. Fase 5: Benchmark.
7. Fase 6: QA, capturas y exportables.

## Decision de alcance inmediata

Empezar por Fase 1 y Fase 2. No tocar benchmark todavia hasta que Perfilar quede serio, porque Perfilar es la evidencia base que alimenta Diagnostico, Script y Benchmark.

## Progreso adicional - 2026-05-19

### Correccion de continuidad de flujo

- Se detecto que `BenchmarkLab` desmontaba `MainPipeline`; al volver desde Laboratorio se reiniciaba el estado interno y el usuario tenia que cargar el dataset otra vez.
- Se cambio `App.tsx` para mantener `MainPipeline` montado y ocultarlo visualmente mientras el laboratorio esta abierto.
- Resultado esperado: al volver desde `Laboratorio de Modelos`, el dataset, el perfil, el diagnostico y el script permanecen disponibles.

### Reagrupacion de Perfilar

- Se movio `PERFIL ESTADISTICO COMPLETO` dentro del primer bloque de caracterizacion.
- Se movio `DISTRIBUCION IQR POR COLUMNA NUMERICA` junto al perfil estadistico porque forma parte de la estadistica descriptiva del OE2.
- El bloque de hallazgos queda reservado para problemas observados y paquete estructurado hacia la siguiente etapa.

### Configuracion de modelos

- Se reemplazo el patron visual de modal por un `Sheet/Drawer` lateral en `SettingsPanel.tsx`.
- Se mejoro la persistencia del modelo local descargado: al terminar la descarga se guarda el modelo activo y se marca como listo.
- Se amplio la deteccion de modelos descargados revisando tambien Cache API, no solo IndexedDB.
- En Diagnostico ya no se bloquea la seleccion de modelos locales cuando la deteccion de cache no devuelve resultados; los modelos aparecen seleccionables y se distinguen como descargados o descargables.

### Diagnostico mas legible

- Se ensancho el area principal de `Diagnostico de causas probables`.
- Las tablas generadas por Markdown dentro del diagnostico ahora usan ancho minimo completo y overflow horizontal para evitar columnas cortadas.

### Pendiente inmediato

- Verificar visualmente en navegador con dataset real.
- Validar descarga local WebLLM en navegador compatible con WebGPU.
- Si la descarga falla, registrar el error exacto del navegador para separar problema de UI, soporte WebGPU o disponibilidad del modelo en WebLLM.

## Progreso adicional - contrato cognitivo y script - 2026-05-19

### Reordenamiento de Diagnostico

- `Entrada controlada / Que se interpreta` queda inmediatamente despues de `Problema observado`.
- `Seleccionar modo de diagnostico` y `Diagnostico de causas probables` quedan unificados en un solo bloque: primero se elige proveedor/modelo y luego se genera/exporta el resultado.
- El diagnostico puede exportarse como JSON o PDF sin obligar al usuario a continuar hacia script.

### Contrato tecnico editable

- `SettingsPanel` incorpora un editor guiado del contrato tecnico del diagnostico.
- El usuario no edita un prompt libre sin control: puede ajustar objetivo operativo, politica de evidencia, preparacion para script, copy-paste evidence, etiquetas HITL e instrucciones adicionales.
- El prompt final sigue protegido por reglas anti-alucinacion y por el paquete estructurado del motor determinista.

### Script anclado al diagnostico

- `ScriptGenerationStep` ya no solicita un reporte ejecutivo nuevo para generar script.
- El script usa `buildScriptPrompt(report, diagnosisText)`, combinando:
  - paquete estructurado del motor determinista;
  - diagnostico previo;
  - contrato de Capa 2 con anclaje semantico;
  - M4 copy-paste;
  - comentarios de trazabilidad por regla y columna.
- Si no existe diagnostico previo, la generacion del script queda bloqueada con mensaje claro.
- Se agrega visualizacion del contrato usado para generar el script.

### Benchmark y contrato

- En modo `smart_sample`, el benchmark empieza a evaluar el contrato editable: primero genera diagnostico con `buildAnalysisPrompt(report, config.promptContract)` y luego genera script con `buildScriptPrompt`.
- Esto permite estudiar si mejorar la estructura del prompt mejora latencia, cumplimiento de formato, alucinaciones y validez del script.

## Progreso adicional - reporte consolidado y gobernanza - 2026-05-19

### Reporte de diagnostico reubicado

- Se retiraron los botones PDF/JSON del panel lateral del diagnostico.
- Se agrego un bloque posterior llamado reporte consolidado, dejando claro que el artefacto incluye perfil determinista, hallazgos, paquete estructurado y diagnostico LLM.
- El JSON exportado contiene `profile`, `columnStats`, `issues`, `auditEvidence`, `smartSample`, contrato/modelo y diagnostico.
- El PDF exportado inicia con perfil del dataset, hallazgos deterministas y luego diagnostico LLM.

### Lectura del diagnostico

- Se elimino el doble contenedor `advisor-shell` que reducia el espacio real del diagnostico generado.
- El panel de diagnostico ahora usa una grilla especifica con mayor altura de lectura.

### Contrato de script con diagnostico visible

- El contrato de script ahora incluye un `Resumen operativo del diagnostico para script` y el diagnostico completo.
- Antes de generar script, AURA intenta pedir al mismo LLM un resumen operativo del diagnostico. Si falla, usa un resumen local determinista para no bloquear el flujo.

### Etiquetas de gobernanza en reporte final

- El PDF final de AURA ahora etiqueta lineas de script como `destructiva`, `transformacion` o `lectura`, usando la misma logica visual de gobernanza del revisor HITL.
