# Laboratorio OE4 y evaluación final de LLM — Implementation Plan

> **For Execution:** Use `executing-plans` or `subagent-driven-development`.

**Goal:** Convertir el Laboratorio de AURA en el consolidador reproducible de la campaña final de 45 corridas LLM y generar el expediente verificable que cierre OE4.

**Architecture:** Mantener el frontend local-first y los contratos v2. El Laboratorio crea campañas versionadas, ejecuta simétricamente diagnóstico y script mediante Ollama, persiste eventos y respuestas en IndexedDB, evalúa contra oráculos congelados, selecciona 9 scripts representativos para HITL y ejecución externa, y deriva JSON, CSV, Markdown y PDF desde una fuente canónica.

**Tech Stack:** React 19, TypeScript, Vitest, Playwright, IndexedDB, Ollama, contratos `aura.evidence.v2`/`aura.diagnosis.v2`/`aura.script.v2`, PapaParse y jsPDF.

---

## Reglas de ejecución

- Trabajar desde `/Users/casabero/Documents/GitHub/aura`; los comandos npm se ejecutan en `/Users/casabero/Documents/GitHub/aura/src`.
- Aplicar TDD: prueba roja, implementación mínima, prueba verde y commit pequeño.
- No iniciar corridas formales hasta congelar dataset, oráculos, modelos, runtime y prompts.
- No cambiar contracts v2 ni prompts después de la primera corrida formal; cualquier cambio crea protocolo/campaña nueva.
- No sobrescribir fallos ni reintentos.
- No ejecutar Python dentro de AURA. La ejecución dinámica permanece externa y su salida se importa.
- No hacer push si typecheck, build, pruebas focales y greps de claims no pasan.

## Task 1: Congelar dataset, oráculos y protocolo v1

**Estado:** cerrado el 10 de julio de 2026. Los artefactos están en `experiments/final-evaluation/`; la prueba focal valida 23 invariantes del protocolo y los oráculos.

**Files:**

- Add: `experiments/final-evaluation/README.md`
- Add: `experiments/final-evaluation/datasets/controlled_customers_phase8.csv`
- Add: `experiments/final-evaluation/datasets/controlled_customers_phase8.schema.json`
- Add: `experiments/final-evaluation/oracles/controlled_customers_phase8_ground_truth.source.json`
- Add: `experiments/final-evaluation/oracles/diagnostic-oracle.v1.json`
- Add: `experiments/final-evaluation/oracles/remediation-oracle.v1.json`
- Add: `experiments/final-evaluation/protocol.v1.json`
- Add: `experiments/final-evaluation/model-manifest.v1.json`
- Add: `src/services/benchmark/finalEvaluationProtocol.ts`
- Test: `src/__tests__/finalEvaluationProtocol.test.ts`

### Step 1: Write the failing hash and matrix test

```ts
import { describe, expect, it } from 'vitest';
import { FINAL_EVALUATION_PROTOCOL } from '../services/benchmark/finalEvaluationProtocol';

describe('final evaluation protocol', () => {
  it('freezes the controlled dataset and exactly 45 run units', () => {
    expect(FINAL_EVALUATION_PROTOCOL.dataset.sha256).toBe(
      '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf',
    );
    expect(FINAL_EVALUATION_PROTOCOL.models).toHaveLength(3);
    expect(FINAL_EVALUATION_PROTOCOL.inputModes).toHaveLength(3);
    expect(FINAL_EVALUATION_PROTOCOL.repetitions).toBe(5);
    expect(
      FINAL_EVALUATION_PROTOCOL.models.length *
      FINAL_EVALUATION_PROTOCOL.inputModes.length *
      FINAL_EVALUATION_PROTOCOL.repetitions,
    ).toBe(45);
  });
});
```

### Step 2: Run the test and confirm red

Run:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/finalEvaluationProtocol.test.ts
```

Expected: FAIL because `finalEvaluationProtocol.ts` does not exist.

### Step 3: Add the frozen protocol

Implement one typed constant with:

```ts
export const FINAL_EVALUATION_PROTOCOL = {
  id: 'aura.oe4.final-evaluation.v1',
  dataset: {
    id: 'controlled_customers_phase8',
    sha256: '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf',
    rows: 50,
    columns: 15,
  },
  models: [
    'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL',
    'hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL',
    'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL',
  ],
  inputModes: [
    'prompt_libre',
    'smart_sample',
    'recommended',
  ],
  repetitions: 5,
  inference: { temperature: 0.2, topP: 0.9, numCtx: 16384, numPredict: 1600 },
} as const;
```

Normalize the 55 historical ground-truth rows to canonical keys `ruleId|columnId|scope`. Document every merge in `diagnostic-oracle.v1.json`; do not infer the mapping at runtime. Define expected, allowed, forbidden and review-only actions in `remediation-oracle.v1.json`.

Preserve the historical ground-truth source byte-for-byte. Its declared summary is 50/3/2 but its array is 51/2/2; record both values and `sourceMetadataMismatch: true`. Derived counts always come from `issues`.

The diagnostic oracle must separate:

```ts
evaluation: {
  engineCoverage: 'all_55_source_issues',
  primaryDiagnosticF1: 'engine_exposed_canonical_keys',
  evidenceFidelity: 'findings_visible_in_run_input_snapshot',
  extendedDiscovery: 'supported_outside_engine_evidence_reported_separately',
}
```

Every source issue must keep `sourceIssueIds`, `reachability`, `primaryEligible` and `visibleEvidenceModes`. `reachability` is one of `engine_exposed`, `engine_supported_not_exposed` or `out_of_engine_scope`. Only `engine_exposed` enters primary LLM F1. The other categories remain in engine coverage and do not become LLM false negatives.

### Step 4: Verify hashes and oracle coverage

Add tests that read the frozen public artifacts through fixtures or generated imports and assert:

- exact source hashes;
- the historical source remains byte-identical and the 50/3/2 versus 51/2/2 mismatch is detected;
- unique canonical finding keys;
- every remediation entry points to a diagnostic-oracle key;
- all 55 source issues have a mapping or an explicit exclusion reason;
- the primary F1 denominator contains only `engine_exposed` canonical keys and is identical for all three modes;
- out-of-engine findings remain in engine coverage and are excluded from primary LLM FN counts;
- protocol JSON and TypeScript protocol serialize to the same values.

Run:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/finalEvaluationProtocol.test.ts
```

Expected: PASS.

### Step 5: Commit

```bash
git add experiments/final-evaluation src/services/benchmark/finalEvaluationProtocol.ts src/__tests__/finalEvaluationProtocol.test.ts
git commit -m "test: freeze OE4 evaluation protocol"
```

## Task 2: Definir contratos de campaña y corrida

**Estado:** cerrado el 10 de julio de 2026.

**Resultado:** `ExperimentCampaignV1` queda ligado exactamente al protocolo 3×3×5; `ExperimentRunV1` conserva snapshots de entorno y entrada, salida cruda/parseada, errores de validación, telemetría, evaluación automática, rúbrica humana, HITL, ejecución y reauditoría. `AttemptEventV1` forma un log append-only y `validateExperimentRunUpdate` impide modificar coordenadas, snapshots o eventos previos.

**Validación:** 12/12 pruebas focales; typecheck, build y suite completa verdes con 1612 pruebas aprobadas y 6 omitidas.

**Files:**

- Add: `src/services/benchmark/experimentTypes.ts`
- Add: `src/services/benchmark/experimentGuards.ts`
- Test: `src/__tests__/experimentTypes.test.ts`

### Step 1: Write failing type-guard tests

Cover campaign identity, immutable run coordinates, two LLM stages, metrics, human rubric, HITL and reauditing.

```ts
const run = makeValidExperimentRun({
  runId: 'run:qwen3:recommended:3',
  campaignId: 'campaign:oe4-final-v1',
  modelId: FINAL_EVALUATION_PROTOCOL.models[0],
  inputMode: 'recommended',
  repetition: 3,
  status: 'planned',
});
expect(isExperimentRunV1(run)).toBe(true);
```

`makeValidExperimentRun` supplies the remaining required environment, input snapshot, nullable stage results and attempt list so the guard is tested against a complete contract.

Also assert rejection of missing prompt hashes, out-of-range repetitions and overwritten attempts.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentTypes.test.ts
```

### Step 3: Implement the minimal contracts

Required types:

```ts
type ExperimentRunStatus =
  | 'planned' | 'running' | 'completed' | 'failed'
  | 'awaiting_human' | 'reviewed'
  | 'awaiting_hitl' | 'approved' | 'rejected' | 'blocked'
  | 'awaiting_external_output' | 'reaudited';

interface ExperimentRunV1 {
  contractId: 'aura.experiment-run.v1';
  campaignId: string;
  runId: string;
  modelId: string;
  inputMode: InputMode;
  repetition: 1 | 2 | 3 | 4 | 5;
  sequence: number;
  status: ExperimentRunStatus;
  environment: EnvironmentSnapshotV1;
  input: InputContractSnapshotV1;
  diagnosis: LlmStageResultV1 | null;
  script: LlmStageResultV1 | null;
  automaticEvaluation: AutomaticEvaluationV1 | null;
  humanReview: HumanReviewV1 | null;
  execution: DynamicExecutionEvidenceV1 | null;
  attempts: AttemptEventV1[];
}
```

Keep raw output, parsed output and validation errors separate. Keep nulls explicit for non-applicable dynamic metrics.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentTypes.test.ts
git add services/benchmark/experimentTypes.ts services/benchmark/experimentGuards.ts __tests__/experimentTypes.test.ts
git commit -m "feat: define OE4 campaign contracts"
```

## Task 3: Actualizar el registro de modelos y la telemetría real de Ollama

**Estado:** cerrada en implementación el 10 de julio de 2026.

**Resultado:** el registro distingue los tres modelos formales Unsloth
`UD-Q4_K_XL` de las alternativas operativas y conserva `qwen2.5:3b`. Ollama
ahora entrega `thinking` separado de la respuesta final y mapea los conteos y
duraciones nativos (`prompt_eval_count`, `eval_count` y tiempos en nanosegundos)
a métricas en milisegundos sin estimarlos cuando la API los informa. El
preflight formal valida los tres identificadores, versiones cliente/servidor,
espacio libre, digest local y respuesta smoke, y escribe un recibo JSON al pasar.

**Validación:** 23/23 pruebas focales, 1620 pruebas completas aprobadas, 6
omitidas, typecheck y build correctos. La prueba contra el
entorno real se detiene correctamente antes de la campaña: cliente Ollama
`0.31.1` y servidor `0.20.3` no coinciden. Además, los tres modelos formales aún
no están instalados; esto es preparación ambiental de Task 12, no una razón para
falsear el cierre de implementación de Task 3.

**Files:**

- Modify: `src/services/modelRegistry.ts`
- Modify: `src/services/providers/ollamaProvider.ts`
- Modify: `src/types.ts`
- Modify: `src/scripts/validate-ollama.mjs`
- Test: `src/__tests__/ollamaProvider.test.ts`
- Test: `src/__tests__/finalEvaluationModels.test.ts`

### Step 1: Add failing registry and telemetry tests

Assert the exact three model IDs and parse true Ollama response fields:

```ts
expect(metrics.promptTokens).toBe(320);
expect(metrics.tokensGenerated).toBe(180);
expect(metrics.loadDurationMs).toBe(1250);
expect(metrics.promptEvalDurationMs).toBe(840);
expect(metrics.evalDurationMs).toBe(4200);
```

The mocked response must contain `prompt_eval_count`, `eval_count`, `load_duration`, `prompt_eval_duration`, `eval_duration` and `total_duration`.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/ollamaProvider.test.ts __tests__/finalEvaluationModels.test.ts
```

### Step 3: Implement exact metrics and preflight

- Replace estimated `text.length / 4` output tokens when Ollama returns `eval_count`.
- Convert nanoseconds to milliseconds once.
- Preserve `message.thinking` separately from `message.content`.
- Add `top_p` to the common options.
- Record Ollama model digest from `/api/tags` or `/api/show`.
- Extend `validate-ollama.mjs` to validate all three models, the expected identifiers, client/server version agreement, free disk and a non-empty smoke response.

Do not make `qwen2.5:3b` disappear from general settings; mark the three formal models explicitly and keep legacy choices as operational alternatives.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/ollamaProvider.test.ts __tests__/finalEvaluationModels.test.ts
npm run typecheck
git add services/modelRegistry.ts services/providers/ollamaProvider.ts types.ts scripts/validate-ollama.mjs __tests__/ollamaProvider.test.ts __tests__/finalEvaluationModels.test.ts
git commit -m "feat: pin modern Ollama evaluation models"
```

Para el preflight formal se usa el comando sin `--model`; así se verifican los
tres modelos congelados y, al pasar, se genera
`experiments/final-evaluation/preflight/ollama-preflight.latest.json`.

## Task 4: Construir los tres contratos formales de entrada con una salida común

**Estado:** cerrada el 10 de julio de 2026.

**Resultado:** `buildExperimentInputPackage` produce snapshots profundos,
inmutables y deterministas para `prompt_libre`, `smart_sample` y `recommended`.
Los tres modos comparten la misma instrucción `1.2.0`, el mismo schema de salida
`aura.diagnosis.v2` y el mismo hash de schema; solo varían las secciones visibles
y el payload. `prompt_libre` queda limitado a resumen y esquema, `smart_sample`
añade estadísticas, reglas y muestras bajo la política de privacidad, y
`recommended` añade registro, gobernanza, manifiestos y anclajes explícitos.

**Corrección de integración:** el snapshot usa el `env:<sha256>` canónico que
exige `validateDiagnosisResponseV2`; el guard experimental ya no acepta el
prefijo incompatible `sha256:` definido provisionalmente en Task 2.

**Validación:** 21/21 pruebas focales, 75/75 dependientes, suite completa con
1629 pruebas aprobadas y 6 omitidas, typecheck y build correctos.

**Files:**

- Add: `src/services/benchmark/experimentInputModes.ts`
- Modify: `src/contracts/llm/diagnosisPromptV2.ts`
- Test: `src/__tests__/experimentInputModes.test.ts`
- Test: `src/__tests__/inputModes.test.ts`

### Step 1: Write the failing symmetry test

```ts
const packages = MODES.map(mode => buildExperimentInputPackage(report, envelope, mode));

expect(new Set(packages.map(pkg => pkg.responseSchemaHash))).toHaveLength(1);
expect(new Set(packages.map(pkg => pkg.inputHash))).toHaveLength(3);
expect(packages.every(pkg => pkg.contractId === 'aura.diagnosis.v2')).toBe(true);
```

Add explicit assertions for which evidence sections each mode includes. `prompt_libre` must remain a controlled minimal baseline, not arbitrary user text.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentInputModes.test.ts __tests__/inputModes.test.ts
```

### Step 3: Implement the three formal adapters

Return a frozen `InputContractSnapshotV1` containing:

```ts
{
  mode,
  evidenceEnvelopeRef,
  includedSections,
  systemInstruction,
  userPayload,
  responseSchema,
  promptVersion,
  inputHash,
  responseSchemaHash,
}
```

The response schema and instruction prohibiting unsupported claims are identical in all modes. Only `includedSections` and `userPayload` vary.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentInputModes.test.ts __tests__/inputModes.test.ts
git add services/benchmark/experimentInputModes.ts contracts/llm/diagnosisPromptV2.ts __tests__/experimentInputModes.test.ts __tests__/inputModes.test.ts
git commit -m "feat: normalize OE4 input modes"
```

## Task 5: Implementar el corredor simétrico y reanudable

**Estado: cerrada el 10 de julio de 2026.** Implementación y evidencia:
`experiments/final-evaluation/TASK5_RUNNER_CLOSEOUT.md`.

**Files:**

- Add: `src/services/benchmark/experimentSchedule.ts`
- Add: `src/services/benchmark/experimentRunner.ts`
- Modify: `src/services/benchmarkService.ts`
- Test: `src/__tests__/experimentSchedule.test.ts`
- Test: `src/__tests__/experimentRunner.test.ts`

### Step 1: Test the 45-unit schedule

Assert:

- exactly 45 unique run IDs;
- every model–mode pair appears five times;
- model order follows the predeclared rotation;
- each model block has one excluded warm-up;
- sequence is deterministic for the protocol seed.

### Step 2: Test two calls for every input mode

```ts
for (const mode of MODES) {
  provider.generateText.mockClear();
  await runner.runUnit(makeRun(mode));
  expect(provider.generateText).toHaveBeenCalledTimes(2);
  expect(store.appendAttemptEvent).toHaveBeenCalled();
}
```

Failures in diagnosis must stop script generation and persist the failure. Failures in script generation must retain the completed diagnosis.

### Step 3: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentSchedule.test.ts __tests__/experimentRunner.test.ts
```

### Step 4: Implement the runner

Core sequence:

```ts
await store.append(runStarted);
const diagnosis = await runDiagnosis(provider, run.input, signal);
await store.append(diagnosisCompleted(diagnosis));
const script = await runScript(provider, diagnosis.parsed, commonScriptContract, signal);
await store.append(scriptCompleted(script));
await store.append(runCompleted());
```

Every formal mode must execute the same diagnosis + script sequence. Keep the existing operational modes compatible, but route formal campaigns only through `experimentRunner.ts`.

### Step 5: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentSchedule.test.ts __tests__/experimentRunner.test.ts __tests__/benchmarkContract.test.ts
git add services/benchmark/experimentSchedule.ts services/benchmark/experimentRunner.ts services/benchmarkService.ts __tests__/experimentSchedule.test.ts __tests__/experimentRunner.test.ts
git commit -m "feat: add symmetric OE4 campaign runner"
```

## Task 6: Persistir campañas en IndexedDB sin sobrescritura

**Estado: cerrada el 10 de julio de 2026.** Implementación y evidencia:
`experiments/final-evaluation/TASK6_STORE_CLOSEOUT.md`.

**Files:**

- Add: `src/services/benchmark/experimentStore.ts`
- Add: `src/services/benchmark/indexedDbExperimentStore.ts`
- Add: `src/services/benchmark/inMemoryExperimentStore.ts`
- Test: `src/__tests__/experimentStore.test.ts`

### Step 1: Write failing repository contract tests

Run the same test suite against the in-memory adapter and IndexedDB adapter. Cover:

- create/list/load campaign;
- append event atomically;
- resume after reconstructing the store;
- reject duplicate event IDs;
- preserve a failed first attempt when a retry is appended;
- return the next planned unit without changing prior units.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentStore.test.ts
```

### Step 3: Implement native IndexedDB

Use database `aura-experiment-lab-v1` with stores:

```text
campaigns     key=campaignId
runs          key=runId, index=campaignId
events        key=eventId, index=runId
artifacts     key=artifactId, index=campaignId
```

Use one read-write transaction for each append and derived run snapshot. Do not add a dependency solely for IndexedDB.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentStore.test.ts
git add services/benchmark/experimentStore.ts services/benchmark/indexedDbExperimentStore.ts services/benchmark/inMemoryExperimentStore.ts __tests__/experimentStore.test.ts
git commit -m "feat: persist OE4 campaigns in IndexedDB"
```

## Task 7: Calcular métricas automáticas y rúbrica humana

**Estado: siguiente tarea única.** Debe puntuar las salidas ya persistidas sin
cambiar el dataset, los oráculos, la matriz ni los resultados crudos del modelo.

**Files:**

- Add: `src/services/benchmark/diagnosticOracleEvaluator.ts`
- Add: `src/services/benchmark/scriptOracleEvaluator.ts`
- Add: `src/services/benchmark/humanRubric.ts`
- Modify: `src/services/benchmark/evaluationService.ts`
- Test: `src/__tests__/diagnosticOracleEvaluator.test.ts`
- Test: `src/__tests__/scriptOracleEvaluator.test.ts`
- Test: `src/__tests__/humanRubric.test.ts`

### Step 1: Write failing metric tests

Use small explicit sets:

```ts
const result = evaluateFindings(
  ['rule:null-values|email|column', 'rule:email-format|email|column'],
  ['rule:null-values|email|column', 'rule:ghost|name|column'],
);
expect(result).toMatchObject({ tp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5, f1: 0.5 });
```

Add edge cases for empty predictions, invalid columns, invented rule IDs, unsupported claims and zero denominators.

For scripts, test valid syntax/contract, invalid columns, dangerous imports, unsupported actions and remediation coverage.

For human ratings, reject values outside 0–4 and require reviewer/date/note for scores 0 or 4.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/diagnosticOracleEvaluator.test.ts __tests__/scriptOracleEvaluator.test.ts __tests__/humanRubric.test.ts
```

### Step 3: Implement independent dimensions

Do not collapse all metrics into a mandatory winner score. Return:

```ts
{
  diagnosis: {
    engineCoverage,
    primary: { tp, fp, fn, precision, recall, f1 },
    evidenceFidelity,
    extendedDiscovery,
    contract,
    anchoring,
    hallucinations,
  },
  operation: { latency, tokens, errors, stability },
  script: { valid, safe, coveredActions, missingActions, unsupportedActions },
  human: { clarity, traceability, actionability, mean },
}
```

Keep the existing composite score only as `exploratoryCompositeScore` in formal exports.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/diagnosticOracleEvaluator.test.ts __tests__/scriptOracleEvaluator.test.ts __tests__/humanRubric.test.ts __tests__/benchmarkContract.test.ts
git add services/benchmark/diagnosticOracleEvaluator.ts services/benchmark/scriptOracleEvaluator.ts services/benchmark/humanRubric.ts services/benchmark/evaluationService.ts __tests__
git commit -m "feat: score OE4 diagnosis and scripts"
```

## Task 8: Seleccionar 9 representantes e integrar HITL, ejecución y reauditoría

**Files:**

- Add: `src/services/benchmark/representativeSelector.ts`
- Add: `src/services/benchmark/experimentExecutionBridge.ts`
- Modify: `src/services/executionService.ts`
- Modify: `src/services/reauditService.ts`
- Test: `src/__tests__/representativeSelector.test.ts`
- Test: `src/__tests__/experimentExecutionBridge.test.ts`

### Step 1: Write the failing deterministic-selection test

```ts
const selected = selectCellRepresentative(fiveRunsWithF1([0.2, 0.8, 0.5, 0.5, 0.9]));
expect(selected.repetition).toBe(3); // median F1; lower repetition wins tie
```

Assert exactly 9 representatives for a complete campaign and `blocked` when no representative is execution-eligible.

### Step 2: Write the failing execution-bridge test

Cover:

- no execution before explicit approval;
- preflight/sandbox failure persists `blocked`;
- approved script generates the external notebook;
- imported after-CSV fingerprint is stored;
- reauditing records score/issues/shape before and after;
- original dataset fingerprint remains unchanged.

### Step 3: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/representativeSelector.test.ts __tests__/experimentExecutionBridge.test.ts
```

### Step 4: Implement without changing the runtime boundary

`experimentExecutionBridge.ts` orchestrates existing services:

```ts
assertHumanApproved(run);
const prepared = executeControlledRun(contract, plan, context, sourceFingerprint, options);
const reaudit = runReaudit(beforeCsv, importedAfterCsv, beforeEvidenceRef);
const delta = computeHealthDelta(reaudit);
return buildDynamicExecutionEvidence(run, prepared, reaudit, delta);
```

AURA prepares and valida; Python runs externally. Do not add `child_process` or Pyodide to the browser path.

### Step 5: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/representativeSelector.test.ts __tests__/experimentExecutionBridge.test.ts __tests__/executionService.test.ts __tests__/reauditService.test.ts
git add services/benchmark/representativeSelector.ts services/benchmark/experimentExecutionBridge.ts services/executionService.ts services/reauditService.ts __tests__
git commit -m "feat: connect OE4 runs to HITL evidence"
```

## Task 9: Generar el expediente TFM desde una fuente canónica

**Files:**

- Add: `src/services/benchmark/experimentAggregation.ts`
- Add: `src/services/benchmark/experimentReport.ts`
- Add: `src/services/benchmark/experimentPdfReport.ts`
- Add: `src/services/benchmark/experimentArtifactExporter.ts`
- Test: `src/__tests__/experimentAggregation.test.ts`
- Test: `src/__tests__/experimentReport.test.ts`
- Test: `src/__tests__/experimentArtifactExporter.test.ts`

### Step 1: Write failing aggregation tests

Assert a 3 × 3 matrix, five attempts per cell, per-dimension best results, descriptive statistics and no universal `winner` field.

### Step 2: Write failing artifact consistency tests

Build a fixture campaign and assert:

- JSON contains raw run data;
- CSV contains one row per initial experimental unit;
- Markdown and PDF state the same campaign ID and counts;
- manifest hashes every generated artifact;
- formal validity is false when ratings or representative resolutions are missing.

### Step 3: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentAggregation.test.ts __tests__/experimentReport.test.ts __tests__/experimentArtifactExporter.test.ts
```

### Step 4: Implement pure derivation

All artifacts derive from `campaign.json`; no manual values enter templates. Required sections:

```text
Método
Entorno y modelos
Matriz de corridas y fallos
Calidad diagnóstica
Contrato y alucinaciones
Validez y seguridad del script
Latencia, tokens y estabilidad
Rúbrica humana
Ejecución representativa y antes/después
Amenazas a la validez
Conclusiones acotadas
```

### Step 5: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/experimentAggregation.test.ts __tests__/experimentReport.test.ts __tests__/experimentArtifactExporter.test.ts
git add services/benchmark/experimentAggregation.ts services/benchmark/experimentReport.ts services/benchmark/experimentPdfReport.ts services/benchmark/experimentArtifactExporter.ts __tests__
git commit -m "feat: export OE4 TFM evidence package"
```

## Task 10: Convertir BenchmarkLab en consola de campaña

**Files:**

- Modify: `src/components/BenchmarkLab.tsx`
- Add: `src/components/benchmark/CampaignSetupPanel.tsx`
- Add: `src/components/benchmark/CampaignMatrix.tsx`
- Add: `src/components/benchmark/ExperimentRunDetail.tsx`
- Add: `src/components/benchmark/HumanRubricPanel.tsx`
- Add: `src/components/benchmark/ExecutionEvidencePanel.tsx`
- Add: `src/components/benchmark/CampaignReportPanel.tsx`
- Modify: `src/index.css`
- Test: `src/__tests__/BenchmarkCampaignLab.test.tsx`

### Step 1: Write the failing human-flow test

Using the in-memory store and fake provider, prove that a person can:

1. create the frozen campaign;
2. see 45 planned units;
3. start, pause and resume;
4. inspect raw diagnosis/script and metrics;
5. rate clarity, traceability and actionability;
6. approve/reject a representative;
7. import an after-CSV for an approved representative;
8. export the report when gates are satisfied.

### Step 2: Run and confirm red

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/BenchmarkCampaignLab.test.tsx
```

### Step 3: Implement the campaign UI

The main view shows:

- protocol and preflight;
- progress `attempted / 45`, completed, failed and pending review;
- matrix 3 × 3 with five repetitions per cell;
- current stage and safe pause;
- run detail with raw/parsed outputs and evidence anchors;
- rubric and representative status;
- report readiness and blockers.

Remove “aplicar ganador” from formal mode. Replace it with “mejor por dimensión”. Keep one-off operational tests available but visually separated from the formal campaign.

### Step 4: Run and commit

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm test -- --run __tests__/BenchmarkCampaignLab.test.tsx __tests__/benchmarkContract.test.ts __tests__/inputModes.test.ts
npm run typecheck
npm run build
git add components/BenchmarkLab.tsx components/benchmark index.css __tests__/BenchmarkCampaignLab.test.tsx
git commit -m "feat: make lab the OE4 campaign console"
```

## Task 11: Validar el recorrido humano y la recuperación E2E

**Files:**

- Add: `src/tests/e2e/oe4-final-evaluation.spec.ts`
- Add: `src/tests/e2e/oe4-final-evaluation-real.optin.spec.ts`
- Add: `src/tests/e2e/fixtures/oe4-after-approved.csv`

### Step 1: Add deterministic browser acceptance tests

The non-opt-in spec uses a controlled provider only to verify UI behavior, IndexedDB recovery and downloads. It must not be cited as model evidence.

Required acceptance:

```text
open lab → create campaign → run test unit → reload browser → campaign resumes
→ add human rubric → resolve HITL → import output → reaudited visible
→ JSON/CSV/Markdown/PDF actions available
```

### Step 2: Add the real opt-in smoke

The opt-in spec uses `AURA_OE4_REAL=1`, Ollama and one frozen model. It checks exact model ID, two real calls, true token fields and persistence. It remains a smoke test, not the 45-run campaign.

### Step 3: Run

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npx playwright test tests/e2e/oe4-final-evaluation.spec.ts
AURA_OE4_REAL=1 npx playwright test tests/e2e/oe4-final-evaluation-real.optin.spec.ts
```

Expected: both pass on the prepared local environment; the opt-in test may only be skipped when its absence is documented before campaign execution.

### Step 4: Commit

```bash
git add tests/e2e/oe4-final-evaluation.spec.ts tests/e2e/oe4-final-evaluation-real.optin.spec.ts tests/e2e/fixtures/oe4-after-approved.csv
git commit -m "test: validate OE4 laboratory journey"
```

## Task 12: Ejecutar y congelar la campaña formal

**Files:**

- Add: `experiments/final-evaluation/results/<campaign-id>/campaign.json`
- Add: `experiments/final-evaluation/results/<campaign-id>/runs.csv`
- Add: `experiments/final-evaluation/results/<campaign-id>/report.md`
- Add: `experiments/final-evaluation/results/<campaign-id>/report.pdf`
- Add: `experiments/final-evaluation/results/<campaign-id>/manifest.json`
- Modify: `docs/plans/2026-07-09-cierre-definitivo-aura.md`
- Modify: `README.md`

### Step 1: Preflight the environment

Synchronize Ollama client/server, then install the exact models one at a time:

```bash
ollama pull hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL
ollama pull hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL
ollama pull hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL
cd /Users/casabero/Documents/GitHub/aura/src
npm run ollama:validate -- --protocol=../experiments/final-evaluation/protocol.v1.json
```

Record versions, local digests, commit, hardware and free memory. Do not proceed on any mismatch.

### Step 2: Execute the 45-run campaign from the Laboratory

- Run all five repetition blocks.
- Pause only between units.
- Do not edit prompts/configuration.
- Preserve failures and linked retries.
- Complete human rubric for every completed run.
- Select the 9 representatives by code, not by manual preference.

### Step 3: Resolve the 9 dynamic representatives

- Review every representative through HITL.
- Reject or block unsafe scripts explicitly.
- Execute approved scripts externally on fresh copies.
- Import every produced CSV and reaudit.
- Do not replace a blocked median with a better script.

### Step 4: Export and verify artifacts

Verify:

```bash
cd /Users/casabero/Documents/GitHub/aura/src
npm run typecheck
npm run build
npm test -- --run
npx playwright test tests/e2e/oe4-final-evaluation.spec.ts
cd /Users/casabero/Documents/GitHub/aura
shasum -a 256 experiments/final-evaluation/results/<campaign-id>/*
```

Required greps:

```bash
rg -n "mejor modelo universal|AURA ejecuta Python|production-ready" experiments/final-evaluation/results/<campaign-id> docs/plans README.md
rg -n '"formalValidity": "formal_valid"|45|9' experiments/final-evaluation/results/<campaign-id>/campaign.json experiments/final-evaluation/results/<campaign-id>/manifest.json
```

The first grep must return no prohibited claim outside an explicitly negated limitation. The second must prove the expected counts and formal gate.

### Step 5: Close OE4 only with evidence

Update the master roadmap from `Parcial` to `Cerrado` only when the manifest is `formal_valid`. Link the exact campaign and summarize limitations without copying values by hand.

### Step 6: Update graph, commit and push

```bash
cd /Users/casabero/Documents/GitHub/aura
graphify update .
git status --short
git add experiments/final-evaluation docs/plans/2026-07-09-cierre-definitivo-aura.md README.md graphify-out
git commit -m "evidence: close OE4 LLM evaluation"
git push origin main
git status --short
```

Expected: `main` pushed, worktree clean, and the final TFM can cite the frozen campaign.

## Definition of done

- The Laboratory owns a resumable 45-run campaign and preserves every initial failure.
- The exact three Unsloth models and quantizations are verified locally.
- All input modes produce diagnosis and script under common output contracts.
- Every completed run has automatic metrics and a 0–4 human rubric.
- Exactly 9 predetermined representatives have an explicit HITL/execution resolution.
- The canonical JSON derives consistent CSV, Markdown, PDF and manifest artifacts.
- The UI journey is proven through a browser and the real Ollama path has a passing smoke.
- Typecheck, build, Vitest, focal Playwright, claim greps, Graphify update, commit and push all succeed.
- Only then OE4 changes from partial to closed and the memoria final may use the results.
