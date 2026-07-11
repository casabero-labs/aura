import { describe, expect, it } from 'vitest';
import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from '../services/benchmark/finalEvaluationProtocol';
import {
  isExperimentCampaignV1,
  isExperimentRunV1,
  validateExperimentCampaignV1,
  validateExperimentRunUpdate,
  validateExperimentRunV1,
} from '../services/benchmark/experimentGuards';
import type {
  AttemptEventV1,
  AutomaticEvaluationV1,
  DynamicExecutionEvidenceV1,
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
  HitlDecisionV1,
  HumanReviewV1,
  InputContractSnapshotV1,
  LlmStageResultV1,
} from '../services/benchmark/experimentTypes';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = '2026-07-10T20:00:00.000Z';
const LATER = '2026-07-10T20:01:00.000Z';

const makeEnvironment = (modelId: OE4ModelId): EnvironmentSnapshotV1 => ({
  contractId: 'aura.environment-snapshot.v1',
  capturedAt: NOW,
  appCommit: 'f7b74991d16e3b0d65bac87f97f34bd61aac7788',
  dataset: {
    id: FINAL_EVALUATION_PROTOCOL.dataset.id,
    sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    schemaSha256: FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256,
    groundTruthSha256: FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256,
  },
  hardware: {
    machine: 'MacBook Air M4',
    cpu: 'Apple M4 10-core',
    memoryBytes: 16 * 1024 ** 3,
  },
  runtime: {
    provider: 'ollama',
    ollamaVersion: '0.9.0',
    clientVersion: '0.9.0',
  },
  model: {
    id: modelId,
    quantization: 'UD-Q4_K_XL',
    expectedGgufSha256: HASH_A,
    localDigest: HASH_B,
  },
  inference: { ...FINAL_EVALUATION_PROTOCOL.inference },
});

const makeInput = (mode: OE4InputMode): InputContractSnapshotV1 => ({
  contractId: 'aura.input-snapshot.v1',
  mode,
  evidenceEnvelopeRef: `env:${HASH_A}`,
  includedSections: mode === 'prompt_libre'
    ? ['dataset_schema']
    : ['dataset_summary', 'column_registry', 'rule_activations'],
  systemInstruction: 'Responde bajo aura.diagnosis.v2.',
  userPayload: '{"dataset":"controlled_customers_phase8"}',
  responseSchema: { type: 'object', required: ['contractId'] },
  promptVersion: 'oe4.prompt.v1',
  promptHash: HASH_A,
  inputHash: HASH_B,
  responseSchemaHash: HASH_A,
});

const makeStageMetrics = () => ({
  totalDurationMs: 1000,
  loadDurationMs: 0,
  promptEvalDurationMs: 100,
  evalDurationMs: 900,
  promptTokens: 320,
  outputTokens: 180,
  reasoningTokens: null,
  firstTokenMs: null,
  tokensPerSecond: 200,
});

const makeStage = (stage: 'diagnosis' | 'script'): LlmStageResultV1 => ({
  contractId: 'aura.llm-stage-result.v1',
  stage,
  status: 'completed',
  attemptId: `attempt:${stage}:1`,
  startedAt: NOW,
  completedAt: LATER,
  rawOutput: stage === 'diagnosis' ? '{"contractId":"aura.diagnosis.v2"}' : 'def clean_dataset(df):\n    return df.copy()',
  parsedOutput: stage === 'diagnosis' ? { contractId: 'aura.diagnosis.v2' } : { contractId: 'aura.script.v2' },
  validationErrors: [],
  metrics: makeStageMetrics(),
  error: null,
});

const makeAutomaticEvaluation = (): AutomaticEvaluationV1 => ({
  contractId: 'aura.automatic-evaluation.v1',
  evaluatedAt: LATER,
  diagnosis: {
    primary: { tp: 12, fp: 1, fn: 4, precision: 12 / 13, recall: 0.75, f1: 0.8275862068965517 },
    engineCoverage: 16 / 32,
    evidenceFidelity: 0.9,
    extendedDiscoveryKeys: [],
    contractCompliant: true,
    inventedColumns: [],
    unsupportedClaims: [],
    anchoringScore: 0.9,
  },
  script: {
    contractValid: true,
    syntaxValid: true,
    safe: true,
    coveredActions: ['trim_whitespace'],
    missingActions: [],
    unsupportedActions: [],
  },
});

const makeHumanReview = (): HumanReviewV1 => ({
  contractId: 'aura.human-review.v1',
  reviewerId: 'local-reviewer',
  reviewedAt: LATER,
  clarity: 4,
  traceability: 3,
  actionability: 2,
  mean: 3,
  notes: 'Revisión controlada.',
});

const makeHitlDecision = (status: HitlDecisionV1['status'] = 'approved'): HitlDecisionV1 => ({
  contractId: 'aura.hitl-decision.v1',
  status,
  reviewerId: 'local-reviewer',
  decidedAt: LATER,
  reason: 'Script seguro para ejecución externa controlada.',
});

const makeExecution = (): DynamicExecutionEvidenceV1 => ({
  contractId: 'aura.dynamic-execution-evidence.v1',
  status: 'reaudited',
  approvedScriptHash: HASH_A,
  beforeDatasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
  afterDatasetSha256: HASH_B,
  executionEnvironment: 'Google Colab controlado',
  executedAt: LATER,
  reaudit: {
    beforeScore: 0,
    afterScore: 20,
    beforeIssueCount: 29,
    afterIssueCount: 20,
    beforeRows: 50,
    afterRows: 50,
    beforeColumns: 15,
    afterColumns: 15,
    estimatedCellsModified: 9,
    resolvedRuleIds: ['rule:trim-whitespace'],
    persistentRuleIds: ['rule:unique-id'],
    newRuleIds: [],
    outcome: 'improved',
  },
});

const makeAttemptEvent = (
  overrides: Partial<AttemptEventV1> = {},
): AttemptEventV1 => ({
  contractId: 'aura.attempt-event.v1',
  eventId: 'event:1',
  attemptId: 'attempt:diagnosis:1',
  sequence: 1,
  stage: 'diagnosis',
  type: 'started',
  timestamp: NOW,
  retryOfAttemptId: null,
  error: null,
  ...overrides,
});

const makeValidRun = (overrides: Partial<ExperimentRunV1> = {}): ExperimentRunV1 => {
  const modelId = overrides.modelId ?? FINAL_EVALUATION_PROTOCOL.models[0];
  const inputMode = overrides.inputMode ?? 'recommended';
  return {
    contractId: 'aura.experiment-run.v1',
    contractVersion: '1.0.0',
    campaignId: 'campaign:oe4-final-v1',
    runId: 'run:qwen3:recommended:3',
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    modelId,
    inputMode,
    repetition: 3,
    sequence: 1,
    status: 'planned',
    createdAt: NOW,
    updatedAt: NOW,
    environment: makeEnvironment(modelId),
    input: makeInput(inputMode),
    diagnosis: null,
    script: null,
    automaticEvaluation: null,
    humanReview: null,
    hitl: null,
    execution: null,
    attempts: [],
    ...overrides,
  };
};

const makeValidCampaign = (overrides: Partial<ExperimentCampaignV1> = {}): ExperimentCampaignV1 => ({
  contractId: 'aura.experiment-campaign.v1',
  contractVersion: '1.0.0',
  campaignId: 'campaign:oe4-final-v1',
  protocolId: FINAL_EVALUATION_PROTOCOL.id,
  protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
  status: 'ready',
  createdAt: NOW,
  updatedAt: NOW,
  datasetId: FINAL_EVALUATION_PROTOCOL.dataset.id,
  datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
  modelIds: [...FINAL_EVALUATION_PROTOCOL.models],
  inputModes: [...FINAL_EVALUATION_PROTOCOL.inputModes],
  repetitions: 5,
  plannedRuns: 45,
  configurationHash: HASH_A,
  runIds: Array.from({ length: 45 }, (_, index) => `run:${index + 1}`),
  ...overrides,
});

describe('OE4 experiment contracts — Task 2', () => {
  it('accepts a campaign bound exactly to the frozen protocol', () => {
    const campaign = makeValidCampaign();
    expect(isExperimentCampaignV1(campaign)).toBe(true);
    expect(validateExperimentCampaignV1(campaign)).toEqual({ valid: true, errors: [] });
  });

  it('rejects campaign drift and duplicate run identities', () => {
    const campaign = makeValidCampaign({
      protocolVersion: '1.0.1',
      plannedRuns: 44 as unknown as 45,
      runIds: Array.from({ length: 45 }, () => 'run:duplicated'),
    });
    const result = validateExperimentCampaignV1(campaign);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'protocolVersion must match the frozen protocol',
      'plannedRuns must equal 45',
      'runIds must be unique',
    ]));
  });

  it('accepts a complete planned run with frozen coordinates', () => {
    const run = makeValidRun();
    expect(isExperimentRunV1(run)).toBe(true);
    expect(validateExperimentRunV1(run)).toEqual({ valid: true, errors: [] });
  });

  it('rejects non-formal models, modes, repetitions and missing prompt hashes', () => {
    const invalid = makeValidRun({
      modelId: 'qwen2.5:3b' as OE4ModelId,
      inputMode: 'copy_paste_bad_samples' as OE4InputMode,
      repetition: 6 as ExperimentRunV1['repetition'],
      input: { ...makeInput('recommended'), promptHash: '' },
    });
    const result = validateExperimentRunV1(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'modelId is not part of the frozen protocol',
      'inputMode is not part of the frozen protocol',
      'repetition must be an integer from 1 to 5',
      'input.promptHash must be a SHA-256 hex string',
    ]));
  });

  it('rejects the provisional sha256 prefix in favor of the canonical env reference', () => {
    const invalid = makeValidRun({
      input: {
        ...makeInput('smart_sample'),
        evidenceEnvelopeRef: `sha256:${HASH_A}`,
      },
    });
    expect(validateExperimentRunV1(invalid).errors).toContain(
      'input.evidenceEnvelopeRef must be the canonical env reference',
    );
  });

  it('keeps raw output, parsed output and validation errors as separate fields', () => {
    const run = makeValidRun({
      status: 'completed',
      diagnosis: makeStage('diagnosis'),
      script: makeStage('script'),
      attempts: [
        makeAttemptEvent(),
        makeAttemptEvent({ eventId: 'event:2', sequence: 2, type: 'completed', timestamp: LATER }),
      ],
    });
    expect(isExperimentRunV1(run)).toBe(true);
    expect(run.diagnosis?.rawOutput).not.toBe('');
    expect(run.diagnosis?.parsedOutput).toEqual({ contractId: 'aura.diagnosis.v2' });
    expect(run.diagnosis?.validationErrors).toEqual([]);
  });

  it('rejects fractional or negative token telemetry', () => {
    const diagnosis = makeStage('diagnosis');
    diagnosis.metrics = { ...makeStageMetrics(), outputTokens: -1, promptTokens: 2.5 };
    const run = makeValidRun({
      status: 'completed',
      diagnosis,
      script: makeStage('script'),
    });
    expect(validateExperimentRunV1(run).errors).toEqual(expect.arrayContaining([
      'diagnosis.metrics.promptTokens must be a non-negative integer or null',
      'diagnosis.metrics.outputTokens must be a non-negative integer or null',
    ]));
  });

  it('enforces lifecycle requirements for evaluation, human review, HITL and reauditing', () => {
    const reaudited = makeValidRun({
      status: 'reaudited',
      diagnosis: makeStage('diagnosis'),
      script: makeStage('script'),
      automaticEvaluation: makeAutomaticEvaluation(),
      humanReview: makeHumanReview(),
      hitl: makeHitlDecision('approved'),
      execution: makeExecution(),
    });
    expect(isExperimentRunV1(reaudited)).toBe(true);

    const invalid = { ...reaudited, execution: null };
    expect(validateExperimentRunV1(invalid).errors).toContain(
      'reaudited status requires execution evidence with reaudit',
    );
  });

  it('rejects results in planned runs and lifecycle jumps', () => {
    const plannedWithResults = makeValidRun({ diagnosis: makeStage('diagnosis') });
    expect(validateExperimentRunV1(plannedWithResults).errors).toContain(
      'planned status cannot contain execution results',
    );

    const previous = makeValidRun();
    const jumped = makeValidRun({
      status: 'reaudited',
      updatedAt: LATER,
      diagnosis: makeStage('diagnosis'),
      script: makeStage('script'),
      automaticEvaluation: makeAutomaticEvaluation(),
      humanReview: makeHumanReview(),
      hitl: makeHitlDecision('approved'),
      execution: makeExecution(),
    });
    expect(validateExperimentRunUpdate(previous, jumped).errors).toContain(
      'run status transition is invalid',
    );
  });

  it('rejects human rubric values outside 0–4 and an inconsistent mean', () => {
    const invalidReview = { ...makeHumanReview(), clarity: 5, mean: 4 } as unknown as HumanReviewV1;
    const run = makeValidRun({
      status: 'reviewed',
      diagnosis: makeStage('diagnosis'),
      script: makeStage('script'),
      automaticEvaluation: makeAutomaticEvaluation(),
      humanReview: invalidReview,
    });
    const result = validateExperimentRunV1(run);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'humanReview.clarity must be an integer from 0 to 4',
      'humanReview.mean must equal the mean of the three rubric scores',
    ]));
  });

  it('rejects duplicate attempt events and retry links to future attempts', () => {
    const events = [
      makeAttemptEvent(),
      makeAttemptEvent({
        eventId: 'event:1',
        attemptId: 'attempt:diagnosis:2',
        sequence: 2,
        retryOfAttemptId: 'attempt:diagnosis:3',
      }),
    ];
    const result = validateExperimentRunV1(makeValidRun({ status: 'running', attempts: events }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'attempt eventIds must be unique',
      'retryOfAttemptId must reference an earlier attempt',
    ]));
  });

  it('allows only append-only attempt updates with immutable run coordinates', () => {
    const previous = makeValidRun({
      status: 'running',
      attempts: [makeAttemptEvent()],
    });
    const next = makeValidRun({
      status: 'failed',
      updatedAt: LATER,
      attempts: [
        makeAttemptEvent(),
        makeAttemptEvent({
          eventId: 'event:2',
          sequence: 2,
          type: 'failed',
          timestamp: LATER,
          error: { code: 'OLLAMA_TIMEOUT', message: 'Timeout', retryable: true },
        }),
      ],
    });
    expect(validateExperimentRunUpdate(previous, next)).toEqual({ valid: true, errors: [] });

    const overwritten = structuredClone(next);
    overwritten.attempts[0].timestamp = LATER;
    overwritten.modelId = FINAL_EVALUATION_PROTOCOL.models[1];
    const result = validateExperimentRunUpdate(previous, overwritten);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'run coordinates are immutable',
      'existing attempt events cannot be overwritten or removed',
    ]));
  });

  it('rejects unknown top-level fields to prevent silent contract drift', () => {
    const runWithDrift = { ...makeValidRun(), winner: 'qwen3' };
    expect(validateExperimentRunV1(runWithDrift).errors).toContain(
      'run contains unknown top-level fields',
    );
  });
});
