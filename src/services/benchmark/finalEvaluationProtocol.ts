/**
 * OE4 — Final evaluation protocol (frozen v1).
 *
 * Semantic mirror of experiments/final-evaluation/protocol.v1.json.
 * Formal runs must consume this constant and tests require deep equality
 * with the frozen public artifact.
 */

export const OE4_FINAL_EVALUATION_PROTOCOL_ID = 'aura.oe4.final-evaluation.v1';
export const OE4_FINAL_EVALUATION_PROTOCOL_VERSION = '1.0.0';
export const OE4_FINAL_EVALUATION_DATASET_ID = 'controlled_customers_phase8';

export const OE4_DATASET_FINGERPRINT_SHA256 =
  '7438bbdc96499d04bd7e485d6450f740304a7c878dce7d1a720dc4d9f2025faf';
export const OE4_DATASET_SCHEMA_SHA256 =
  'b1eba3a767a6e9a84398aa10220c73efa2b3db8b31151235f9b63141727a2a98';
export const OE4_GROUND_TRUTH_SOURCE_SHA256 =
  '38c846856860519d248b42e53afe3cacacff714f115af6cec4b3d050fe79040d';

export const OE4_MODELS = [
  'hf.co/unsloth/Qwen3-8B-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/gemma-3-4b-it-qat-GGUF:UD-Q4_K_XL',
  'hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:UD-Q4_K_XL',
] as const;

/**
 * Three distinct, already implemented input compositions:
 * minimal baseline, structured evidence, and full recommended contract.
 */
export const OE4_INPUT_MODES = [
  'prompt_libre',
  'smart_sample',
  'recommended',
] as const;

export type OE4InputMode = (typeof OE4_INPUT_MODES)[number];
export type OE4ModelId = (typeof OE4_MODELS)[number];

export const OE4_REPETITIONS = 5 as const;

export const OE4_INFERENCE = {
  temperature: 0.2,
  topP: 0.9,
  numCtx: 16384,
  numPredict: 1600,
  seed: null as number | null,
  keepAlive: '10m',
  timeoutSeconds: 600,
} as const;

export const OE4_RESPONSE_SCHEMAS = {
  diagnosis: 'aura.diagnosis.v2',
  script: 'aura.script.v2',
} as const;

export const OE4_SCHEDULE = {
  seed: 20260710,
  balancedModelOrders: [
    [OE4_MODELS[0], OE4_MODELS[1], OE4_MODELS[2]],
    [OE4_MODELS[1], OE4_MODELS[2], OE4_MODELS[0]],
    [OE4_MODELS[2], OE4_MODELS[0], OE4_MODELS[1]],
    [OE4_MODELS[0], OE4_MODELS[2], OE4_MODELS[1]],
    [OE4_MODELS[1], OE4_MODELS[0], OE4_MODELS[2]],
  ],
  modeOrderSeed: 4242,
  warmupExcluded: true,
  warmupPerModelBlock: 1,
  expectedModelBlocks: 15,
  expectedWarmupCalls: 15,
} as const;

export const OE4_EVALUATION_SCOPES = [
  'engineCoverage',
  'primaryDiagnosticF1',
  'evidenceFidelity',
  'extendedDiscovery',
] as const;

export const OE4_PRIMARY_F1_DENOMINATOR_NOTE =
  'engine_exposed canonical keys only';

export const OE4_PROTOCOL_RULES = {
  noChangeAfterFirstRun:
    'Any change to contracts v2, prompts, models or inference after the first formal run invalidates the campaign and requires a new protocol version.',
  failuresPreserved:
    'Failed runs are persisted and count toward stability metrics; retries are linked, never overwrite.',
  singleModelAtATime:
    'Only one model is loaded into Ollama at a time. Hardware: MacBook Air M4 10-core / 16 GB.',
  diagnosisBeforeScript:
    'Diagnosis failure aborts script generation. Script failure retains the completed diagnosis.',
} as const;

export const FINAL_EVALUATION_PROTOCOL = {
  id: OE4_FINAL_EVALUATION_PROTOCOL_ID,
  version: OE4_FINAL_EVALUATION_PROTOCOL_VERSION,
  frozenAt: '2026-07-10',
  dataset: {
    id: OE4_FINAL_EVALUATION_DATASET_ID,
    sha256: OE4_DATASET_FINGERPRINT_SHA256,
    schemaSha256: OE4_DATASET_SCHEMA_SHA256,
    rows: 50,
    columns: 15,
    groundTruthSha256: OE4_GROUND_TRUTH_SOURCE_SHA256,
  },
  models: OE4_MODELS,
  inputModes: OE4_INPUT_MODES,
  repetitions: OE4_REPETITIONS,
  matrix: {
    models: OE4_MODELS.length,
    inputModes: OE4_INPUT_MODES.length,
    repetitions: OE4_REPETITIONS,
    units: OE4_MODELS.length * OE4_INPUT_MODES.length * OE4_REPETITIONS,
    stagesPerUnit: 2,
    maxLlmCalls: OE4_MODELS.length * OE4_INPUT_MODES.length * OE4_REPETITIONS * 2,
  },
  inference: OE4_INFERENCE,
  responseSchemas: OE4_RESPONSE_SCHEMAS,
  schedule: OE4_SCHEDULE,
  evaluationScopes: OE4_EVALUATION_SCOPES,
  primaryF1Denominator: OE4_PRIMARY_F1_DENOMINATOR_NOTE,
  primaryF1DenominatorByMode: {
    prompt_libre: 16,
    smart_sample: 16,
    recommended: 16,
  },
  evidenceFidelityDenominatorByMode: {
    prompt_libre: 0,
    smart_sample: 16,
    recommended: 16,
  },
  rules: OE4_PROTOCOL_RULES,
} as const;

export type FinalEvaluationProtocol = typeof FINAL_EVALUATION_PROTOCOL;
