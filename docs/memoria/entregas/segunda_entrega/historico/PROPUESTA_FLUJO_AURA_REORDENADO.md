# Propuesta de flujo AURA reordenado

> Proposito: analizar el flujo actual del codigo y proponer una estructura tecnica que satisfaga los objetivos reordenados para la segunda entrega.

## 1. Diagnostico del flujo actual

El flujo visible de AURA ya tiene una base correcta:

1. `MainPipeline` inicia en carga de CSV.
2. `csvService.ts` parsea el archivo.
3. `auditEngine.ts` genera el `AuditReport`.
4. `AnalysisStep` ejecuta diagnostico IA y generacion de script.
5. `ReviewStep` permite revision humana y simulacion.
6. `BenchmarkLab` permite ejecutar comparaciones multi-modelo desde un modal.
7. `App.tsx` exporta reporte, JSON, issues y script aprobado.

El problema no es ausencia de piezas. El problema es integracion narrativa y tecnica: benchmark, scripts, mejora simulada y exportacion no estan aun gobernados por un unico objeto de ejecucion.

## 2. Enredos detectados en codigo

### 2.1 Estado duplicado entre `App.tsx` y `MainPipeline`

`MainPipeline` sube `PipelineData` a `App.tsx`, pero `App.tsx` mantiene estados paralelos para `aiAnalysis`, `cleaningScript`, `approvedCleaningScript`, `benchmarkResults` e `improvementRun`.

Riesgo:

- los exports pueden no incluir el analisis o script reales generados dentro del pipeline;
- el PDF puede no recibir el script aprobado;
- el JSON puede salir incompleto aunque la UI haya mostrado resultados.

### 2.2 `AnalysisStep` puede devolver analisis incompleto

`AnalysisStep` acumula texto con `setAnalysisText`, pero al llamar `onAnalysisComplete` usa el valor de estado previo. Como React actualiza estado de forma asincrona, el callback puede recibir texto vacio o parcial.

Riesgo:

- la evidencia exportada del diagnostico LLM puede quedar desfasada;
- el checklist puede evaluar alucinaciones sobre una respuesta incompleta.

### 2.3 La revision HITL no recibe resultados reales de benchmark

`ReviewStep` llama `createImprovementRun`, pero construye `benchmarkResults` como arreglo vacio.

Riesgo:

- la simulacion de mejora no queda vinculada al modelo que genero el script;
- OE4 queda desconectado de OE3;
- el sistema no puede recomendar un modelo de remediacion con evidencia real.

### 2.4 Hay dos experiencias de benchmark

Existen `BenchmarkLab` y `BenchmarkPanel`. `BenchmarkPanel` es mas rico para decision de estrategia, mejora y trazabilidad, pero no aparece conectado al pipeline principal. `BenchmarkLab` funciona como modal de laboratorio, pero conserva resultados localmente y no los devuelve al ciclo de mejora.

Riesgo:

- el benchmark parece una herramienta aparte;
- la tesis habla de comparacion integrada, pero la app la muestra como laboratorio externo;
- los resultados no alimentan exportacion ni HITL.

### 2.5 La validacion de scripts esta disponible pero no gobierna el paso de revision

`scriptValidationService.ts` valida columnas inexistentes, operaciones destructivas y cobertura de issues. Sin embargo, `MainPipeline` deja un `TODO` y `ReviewStep` no muestra esa validacion como requisito antes de aprobar.

Riesgo:

- un script con columnas invalidas podria llegar a revision sin alerta fuerte;
- la evidencia de OE3/OE4 queda menos defendible.

## 3. Estructura tecnica propuesta

Crear un flujo unico llamado `AuraRun` o `ExecutionRun`, que represente una ejecucion completa:

```ts
interface AuraRun {
  id: string;
  fileName?: string;
  source: {
    rows: number;
    columns: string[];
    delimiter: string;
    datasetFingerprint: string;
  };
  localFirst: {
    parseDurationMs: number;
    auditDurationMs: number;
    webGpuAvailable?: boolean;
    providerMode: 'local' | 'cloud' | 'chrome';
  };
  deterministic: {
    report: AuditReport;
    evidence: AuditExecutionEvidence;
  };
  cognitive?: {
    provider: string;
    model: string;
    analysisText: string;
    generatedScript?: string;
    metrics: ProviderMetrics;
    scriptValidation?: ScriptValidationResult;
  };
  comparison: {
    results: BenchmarkResult[];
    recommendedResult?: BenchmarkResult;
  };
  governance?: {
    approvedScript?: string;
    approvedAt?: string;
    editedByHuman: boolean;
    healthDelta?: HealthDelta;
    improvementRun?: ImprovementRun;
  };
}
```

Este objeto debe sustituir el estado disperso. La UI puede seguir dividida por componentes, pero todos deben leer y escribir sobre la misma ejecucion.

## 4. Flujo de pantalla recomendado

### Paso 1. Preparar dataset

Responsabilidad:

- cargar CSV;
- parsear localmente;
- calcular fingerprint;
- mostrar limite de privacidad segun proveedor seleccionado.

Objetivo relacionado:

- OE1.

Codigo actual:

- `src/components/FileUpload.tsx`
- `src/services/csvService.ts`
- `src/services/executionEvidence.ts`

### Paso 2. Auditar con motor determinista

Responsabilidad:

- ejecutar `runAudit`;
- mostrar `AuditReport`, reglas activadas, score, perfil de columnas y evidencia.

Objetivo relacionado:

- OE2.

Codigo actual:

- `src/services/auditEngine.ts`
- `src/components/DatasetProfile.tsx`
- `src/components/RuleActivationMatrix.tsx`
- `src/components/ColumnStatsPanel.tsx`

### Paso 3. Diagnosticar y generar script

Responsabilidad:

- enviar smart sample al LLM;
- producir diagnostico textual;
- generar script Python/Pandas;
- validar el script contra columnas, acciones destructivas y cobertura de issues.

Objetivo relacionado:

- OE3.

Codigo actual:

- `src/components/AnalysisStep.tsx`
- `src/services/providers/prompts.ts`
- `src/services/aiProvider.ts`
- `src/services/scriptValidationService.ts`

Mejora necesaria:

- unificar diagnostico y script como una misma corrida cognitiva;
- guardar `ProviderMetrics`, `analysisText`, `generatedScript` y `scriptValidation` en `AuraRun.cognitive`.

### Paso 4. Comparar modelos dentro del mismo ciclo

Responsabilidad:

- ejecutar local/cloud/chrome sobre el mismo `AuditReport`;
- medir formato, alucinaciones, latencia, tokens, script valido y cobertura;
- elegir recomendacion o registrar que no hay evidencia suficiente.

Objetivo relacionado:

- OE4.

Codigo actual:

- `src/services/benchmarkService.ts`
- `src/services/benchmark/hallucinationDetector.ts`
- `src/services/benchmark/evaluationService.ts`
- `src/components/BenchmarkLab.tsx`
- `src/components/BenchmarkPanel.tsx`

Mejora necesaria:

- convertir el benchmark en paso integrado o panel acoplado al pipeline;
- devolver resultados al `AuraRun`;
- alimentar `createImprovementRun` con resultados reales.

### Paso 5. Revision humana y simulacion

Responsabilidad:

- mostrar script editable;
- exigir revision completa;
- advertir operaciones destructivas;
- simular remediacion segura;
- recalcular score y delta de salud.

Objetivos relacionados:

- OE3 y OE4.

Codigo actual:

- `src/components/ReviewStep.tsx`
- `src/components/ScriptReview.tsx`
- `src/services/improvementService.ts`
- `src/services/remediationSimulator.ts`

Mejora necesaria:

- bloquear o marcar aprobacion cuando `scriptValidation.valid === false`;
- registrar ediciones humanas;
- guardar `healthDelta` en el objeto unico de ejecucion.

### Paso 6. Exportar evidencia

Responsabilidad:

- exportar PDF, JSON, CSV de issues, script aprobado y resultados benchmark;
- incluir estado de evidencia: `planned`, `attempted_failed`, `preliminary_valid` o `formal_valid`.

Objetivos relacionados:

- todos.

Codigo actual:

- `src/App.tsx`
- `src/services/pdfGenerator.ts`

Mejora necesaria:

- exportar desde `AuraRun`, no desde estados duplicados.

## 5. Orden de implementacion recomendado

1. Crear tipo `AuraRun` y reducer de pipeline.
2. Eliminar estado duplicado en `App.tsx`; usar `PipelineData` o `AuraRun` como fuente unica.
3. Corregir acumulacion de texto en `AnalysisStep` para que el analisis final no salga vacio.
4. Integrar `validateCleaningScript` al terminar generacion de script.
5. Conectar resultados de `BenchmarkLab` o reemplazarlo por `BenchmarkPanel` integrado.
6. Pasar `benchmarkResults` reales a `ReviewStep` y `createImprovementRun`.
7. Actualizar exports para incluir corrida completa.
8. Ajustar etiquetas UI al nuevo orden OE1-OE4.

## 6. Forma academica de defender el rediseño

La mejora no consiste en agregar mas pantallas. Consiste en convertir AURA en un ciclo experimental completo:

> dataset local -> evidencia determinista -> diagnostico LLM -> script validado -> comparacion multi-modelo -> revision humana -> delta de salud -> exportacion trazable.

Con esta estructura, cada accion visible de la app produce evidencia para un objetivo especifico. Eso ordena la memoria y tambien ordena el producto.

