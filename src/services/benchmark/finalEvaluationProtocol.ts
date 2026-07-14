/**
 * OE4 — Final evaluation protocol.
 *
 * V1 remains exported as an immutable historical record. Formal runs consume
 * V2, whose only measured LLM stage is diagnosis. Remediation scripts are
 * generated deterministically for the nine selected representatives.
 */

import { FINAL_EVALUATION_OLLAMA_MODEL_IDS } from '../modelRegistry';

export const OE4_FINAL_EVALUATION_PROTOCOL_ID = 'aura.oe4.final-evaluation.v2';
export const OE4_FINAL_EVALUATION_PROTOCOL_VERSION = '2.5.0';
export const OE4_FINAL_EVALUATION_DATASET_ID = 'synthetic_ground_truth';

export const OE4_DATASET_FINGERPRINT_SHA256 =
  '4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49';
export const OE4_DATASET_SCHEMA_SHA256 =
  '5baab1a6f8c62e10e757386b808d7e52fd36b81402d4842f15e859c201b2d63b';
export const OE4_GROUND_TRUTH_SOURCE_SHA256 =
  'c80563cf62c0e0f83039d3161d9e8799876b31a32c015ed940b2ecceaca78f0b';

export const OE4_MODELS = FINAL_EVALUATION_OLLAMA_MODEL_IDS;

/**
 * Three distinct, already implemented input compositions:
 * minimal baseline, structured evidence, and full recommended contract.
 */
export const OE4_INPUT_MODES = [
  'prompt_libre',
  'smart_sample',
  'recommended',
] as const;

export const OE4_INPUT_MODE_LABELS: Record<(typeof OE4_INPUT_MODES)[number], string> = {
  prompt_libre: 'Contexto mínimo',
  smart_sample: 'Evidencia equilibrada',
  recommended: 'Evidencia completa',
};

export type OE4InputMode = (typeof OE4_INPUT_MODES)[number];
export type OE4ModelId = (typeof OE4_MODELS)[number];

export const OE4_REPETITIONS = 3 as const;

export const OE4_INFERENCE = {
  temperature: 0.1,
  topP: 0.9,
  think: false,
  numCtx: 16384,
  // The 15-issue controlled diagnosis needs room for both diagnosisBlocks and
  // issues. The first v2.3.0 pilot proved that 1,600 tokens truncates Qwen and
  // Gemma responses before the JSON object closes.
  numPredict: 4096,
  seed: null as number | null,
  keepAlive: '10m',
  timeoutSeconds: 600,
} as const;

export const OE4_RESPONSE_SCHEMAS = {
  diagnosis: 'aura.diagnosis.v2',
} as const;

export const OE4_SCHEDULE = {
  seed: 20260710,
  balancedModelOrders: [
    [OE4_MODELS[0], OE4_MODELS[1], OE4_MODELS[2]],
    [OE4_MODELS[1], OE4_MODELS[2], OE4_MODELS[0]],
    [OE4_MODELS[2], OE4_MODELS[0], OE4_MODELS[1]],
  ],
  modeOrderSeed: 4242,
  warmupExcluded: true,
  warmupPerModelBlock: 1,
  expectedModelBlocks: 9,
  expectedWarmupCalls: 9,
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
    'Only one model is loaded into Ollama at a time. Hardware and inference limits are captured for the active campaign.',
  inferenceFrozenAtCreation:
    'Context window, output limit and sampling parameters are selected before the campaign and frozen in every run receipt.',
  diagnosisOnly:
    'Each matrix unit performs one measured LLM call for diagnosis only.',
  deterministicRepresentativeScripts:
    'Remediation scripts are generated deterministically only for the nine selected representatives and do not count as LLM calls.',
} as const;

export const FINAL_EVALUATION_PROTOCOL_V1 = {
  id: 'aura.oe4.final-evaluation.v1',
  version: '1.0.0',
  frozenAt: '2026-07-10',
  matrix: { units: 45, stagesPerUnit: 2, maxLlmCalls: 90 },
  responseSchemas: { diagnosis: 'aura.diagnosis.v2', script: 'aura.script.v2' },
} as const;

export const FINAL_EVALUATION_PROTOCOL = {
  id: OE4_FINAL_EVALUATION_PROTOCOL_ID,
  version: OE4_FINAL_EVALUATION_PROTOCOL_VERSION,
  frozenAt: '2026-07-14',
  supersedes: FINAL_EVALUATION_PROTOCOL_V1.id,
  dataset: {
    id: OE4_FINAL_EVALUATION_DATASET_ID,
    sha256: OE4_DATASET_FINGERPRINT_SHA256,
    schemaSha256: OE4_DATASET_SCHEMA_SHA256,
    rows: 15,
    columns: 9,
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
    stagesPerUnit: 1,
    evaluatedLlmCalls: OE4_MODELS.length * OE4_INPUT_MODES.length * OE4_REPETITIONS,
    warmupCalls: OE4_SCHEDULE.expectedWarmupCalls,
    totalRealCalls: OE4_MODELS.length * OE4_INPUT_MODES.length * OE4_REPETITIONS
      + OE4_SCHEDULE.expectedWarmupCalls,
    maxLlmCalls: OE4_MODELS.length * OE4_INPUT_MODES.length * OE4_REPETITIONS,
  },
  inference: OE4_INFERENCE,
  responseSchemas: OE4_RESPONSE_SCHEMAS,
  schedule: OE4_SCHEDULE,
  evaluationScopes: OE4_EVALUATION_SCOPES,
  primaryF1Denominator: OE4_PRIMARY_F1_DENOMINATOR_NOTE,
  primaryF1DenominatorByMode: {
    prompt_libre: 15,
    smart_sample: 15,
    recommended: 15,
  },
  evidenceFidelityDenominatorByMode: {
    prompt_libre: 0,
    smart_sample: 10,
    recommended: 10,
  },
  rules: OE4_PROTOCOL_RULES,
} as const;

export type FinalEvaluationProtocol = typeof FINAL_EVALUATION_PROTOCOL;
