import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from '../../services/benchmark/finalEvaluationProtocol';
import type {
  AutomaticEvaluationV1,
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
  HumanReviewV1,
  LlmStageResultV1,
} from '../../services/benchmark/experimentTypes';
import type { DiagnosisInputPackageV2, ExecutionReceiptV1 } from '../../contracts/llm/types';
import { buildExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { sha256hex } from '../../contracts/llm/hash';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = '2026-07-11T12:00:00.000Z';
const LATER = '2026-07-11T12:05:00.000Z';

export interface ExperimentEvidenceFixtureOptions {
  missingHumanReview?: boolean;
}

const makeEnvironment = (modelId: OE4ModelId): EnvironmentSnapshotV1 => ({
  contractId: 'aura.environment-snapshot.v1',
  capturedAt: NOW,
  appCommit: '4f6b81973ea2bbabcdcfd43b79ad55b0b9bd3a0f',
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
  runtime: { provider: 'ollama', ollamaVersion: '0.20.3', clientVersion: '0.20.3' },
  model: {
    id: modelId,
    quantization: 'UD-Q4_K_XL',
    expectedGgufSha256: HASH_A,
    localDigest: HASH_B,
  },
  inference: { ...FINAL_EVALUATION_PROTOCOL.inference },
});

const makeInput = (mode: OE4InputMode): DiagnosisInputPackageV2 => {
  const systemInstruction = 'Return one aura.diagnosis.v2 JSON object.';
  const userPayload = JSON.stringify({ mode, evidenceEnvelopeRef: `env:${HASH_A}` });
  return {
    contractId: 'aura.input-snapshot.v2',
    contractVersion: '2.0.0',
    inputMode: mode,
    evidenceEnvelopeRef: `env:${HASH_A}`,
    includedSections: mode === 'prompt_libre'
      ? ['dataset_schema']
      : ['dataset_summary', 'dataset_schema', 'rule_activations'],
    systemInstruction,
    userPayload,
    responseSchema: { type: 'object', required: ['contractId'] },
    promptVersion: 'oe4.prompt.v1',
    promptHash: sha256hex(`${systemInstruction}\n\n${userPayload}`),
    responseSchemaHash: HASH_A,
    inputHash: HASH_B,
  };
};

const makeStage = (
  stage: 'diagnosis' | 'script',
  sequence: number,
  repetition: number,
  diagnosisRawOutput?: string,
): LlmStageResultV1 => ({
  contractId: 'aura.llm-stage-result.v1',
  stage,
  status: 'completed',
  attemptId: `attempt:${sequence}:${stage}:1`,
  startedAt: NOW,
  completedAt: LATER,
  rawOutput: stage === 'diagnosis'
    ? (diagnosisRawOutput ?? `raw diagnosis sequence ${sequence}`)
    : `raw script sequence ${sequence}`,
  parsedOutput: { contractId: stage === 'diagnosis' ? 'aura.diagnosis.v2' : 'aura.script.v2' },
  validationErrors: [],
  metrics: {
    totalDurationMs: (stage === 'diagnosis' ? 1000 : 500) + repetition,
    loadDurationMs: 0,
    promptEvalDurationMs: 100,
    evalDurationMs: (stage === 'diagnosis' ? 900 : 400) + repetition,
    promptTokens: stage === 'diagnosis' ? 200 : 100,
    outputTokens: (stage === 'diagnosis' ? 100 : 50) + repetition,
    reasoningTokens: null,
    firstTokenMs: null,
    tokensPerSecond: 100,
  },
  error: null,
});

const makeAutomaticEvaluation = (
  inputMode: OE4InputMode,
  repetition: number,
): AutomaticEvaluationV1 => ({
  contractId: 'aura.automatic-evaluation.v1',
  evaluatedAt: LATER,
  diagnosis: {
    primary: {
      tp: repetition,
      fp: 0,
      fn: 5 - repetition,
      precision: 1,
      recall: repetition / 5,
      f1: repetition / 5,
    },
    engineCoverage: 41 / 55,
    evidenceFidelity: inputMode === 'prompt_libre' ? null : repetition / 5,
    extendedDiscoveryKeys: [],
    contractCompliant: true,
    inventedColumns: [],
    unsupportedClaims: [],
    anchoringScore: repetition / 5,
  },
  script: {
    contractValid: true,
    syntaxValid: true,
    safe: true,
    coveredActions: ['rule:test|name|column=>trim_whitespace'],
    missingActions: [],
    unsupportedActions: [],
  },
});

const makeHumanReview = (): HumanReviewV1 => ({
  contractId: 'aura.human-review.v1',
  reviewerId: 'reviewer:oe4',
  reviewedAt: LATER,
  clarity: 3,
  traceability: 3,
  actionability: 3,
  mean: 3,
  notes: 'Revisión controlada.',
});

const makeReceipt = (input: DiagnosisInputPackageV2, modelId: OE4ModelId, rawResponse: string): ExecutionReceiptV1 => buildExecutionReceiptV1({
  input,
  requestedInputMode: input.inputMode,
  exactPrompt: exactDiagnosisPromptV2(input),
  provider: 'Ollama',
  requestedModel: modelId,
  observedModel: modelId,
  modelDigest: HASH_B,
  inference: FINAL_EVALUATION_PROTOCOL.inference,
  startedAt: NOW,
  completedAt: LATER,
  rawResponse,
  validationStatus: 'valid',
});

const makeRun = (
  sequence: number,
  modelId: OE4ModelId,
  inputMode: OE4InputMode,
  repetition: 1 | 2 | 3 | 4 | 5,
  missingHumanReview: boolean,
): ExperimentRunV1 => {
  const input = makeInput(inputMode);
  const diagnosisRaw = `raw diagnosis sequence ${sequence}`;
  return {
    contractId: 'aura.experiment-run.v1',
    contractVersion: '1.0.0',
    campaignId: 'campaign:oe4:test-evidence',
    runId: `run:${modelId}:${inputMode}:${repetition}`,
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    modelId,
    inputMode,
    repetition,
    sequence,
    status: missingHumanReview && sequence === 1
      ? 'awaiting_human'
      : repetition === 3 ? 'rejected' : 'reviewed',
    createdAt: NOW,
    updatedAt: LATER,
    environment: makeEnvironment(modelId),
    input,
    warmupReceipt: {
      contractId: 'aura.warmup-receipt.v1',
      excludedFromEvaluation: true,
      blockId: `${modelId}::${repetition}`,
      modelId,
      repetition,
      promptHash: HASH_A,
      responseHash: HASH_B,
      completedAt: LATER,
      metrics: {
        totalDurationMs: 50,
        loadDurationMs: 0,
        promptEvalDurationMs: 10,
        evalDurationMs: 40,
        promptTokens: 10,
        outputTokens: 4,
        reasoningTokens: null,
        firstTokenMs: 0,
        tokensPerSecond: 80,
      },
    },
    diagnosis: makeStage('diagnosis', sequence, repetition, diagnosisRaw),
    executionReceipt: makeReceipt(input, modelId, diagnosisRaw),
    script: makeStage('script', sequence, repetition),
    automaticEvaluation: makeAutomaticEvaluation(inputMode, repetition),
    humanReview: missingHumanReview && sequence === 1 ? null : makeHumanReview(),
    hitl: repetition === 3 ? {
      contractId: 'aura.hitl-decision.v1',
      status: 'rejected',
      reviewerId: 'reviewer:oe4',
      decidedAt: LATER,
      reason: 'Resolución controlada para la muestra de evidencia.',
    } : null,
    execution: null,
    attempts: [
      {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${sequence}:diagnosis:started`,
        attemptId: `attempt:${sequence}:diagnosis:1`,
        sequence: 1,
        stage: 'diagnosis',
        type: 'started',
        timestamp: NOW,
        retryOfAttemptId: null,
        error: null,
      },
      {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${sequence}:diagnosis:completed`,
        attemptId: `attempt:${sequence}:diagnosis:1`,
        sequence: 2,
        stage: 'diagnosis',
        type: 'completed',
        timestamp: LATER,
        retryOfAttemptId: null,
        error: null,
      },
      {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${sequence}:script:started`,
        attemptId: `attempt:${sequence}:script:1`,
        sequence: 3,
        stage: 'script',
        type: 'started',
        timestamp: NOW,
        retryOfAttemptId: null,
        error: null,
      },
      {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${sequence}:script:completed`,
        attemptId: `attempt:${sequence}:script:1`,
        sequence: 4,
        stage: 'script',
        type: 'completed',
        timestamp: LATER,
        retryOfAttemptId: null,
        error: null,
      },
    ],
  };
};

export const createExperimentEvidenceFixture = (
  options: ExperimentEvidenceFixtureOptions = {},
): { campaign: ExperimentCampaignV1; runs: ExperimentRunV1[]; generatedAt: string } => {
  let sequence = 0;
  const runs = FINAL_EVALUATION_PROTOCOL.models.flatMap((modelId) =>
    FINAL_EVALUATION_PROTOCOL.inputModes.flatMap((inputMode) =>
      ([1, 2, 3, 4, 5] as const).map((repetition) => {
        sequence += 1;
        return makeRun(sequence, modelId, inputMode, repetition, options.missingHumanReview ?? false);
      })));
  const campaign: ExperimentCampaignV1 = {
    contractId: 'aura.experiment-campaign.v1',
    contractVersion: '1.0.0',
    campaignId: 'campaign:oe4:test-evidence',
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    status: 'completed',
    createdAt: '2026-07-11T12:00:00.000Z',
    updatedAt: '2026-07-11T13:00:00.000Z',
    datasetId: FINAL_EVALUATION_PROTOCOL.dataset.id,
    datasetSha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    modelIds: [...FINAL_EVALUATION_PROTOCOL.models],
    inputModes: [...FINAL_EVALUATION_PROTOCOL.inputModes],
    repetitions: 5,
    plannedRuns: 45,
    configurationHash: HASH_A,
    runIds: runs.map((run) => run.runId),
  };
  return { campaign, runs, generatedAt: '2026-07-11T13:00:00.000Z' };
};
