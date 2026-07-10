import type { OE4InputMode, OE4ModelId } from './finalEvaluationProtocol';

export type ExperimentCampaignStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'invalid';

export type ExperimentRunStatus =
  | 'planned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'awaiting_human'
  | 'reviewed'
  | 'awaiting_hitl'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'awaiting_external_output'
  | 'reaudited';

export interface ExperimentCampaignV1 {
  contractId: 'aura.experiment-campaign.v1';
  contractVersion: '1.0.0';
  campaignId: string;
  protocolId: string;
  protocolVersion: string;
  status: ExperimentCampaignStatus;
  createdAt: string;
  updatedAt: string;
  datasetId: string;
  datasetSha256: string;
  modelIds: OE4ModelId[];
  inputModes: OE4InputMode[];
  repetitions: 5;
  plannedRuns: 45;
  configurationHash: string;
  runIds: string[];
}

export interface EnvironmentSnapshotV1 {
  contractId: 'aura.environment-snapshot.v1';
  capturedAt: string;
  appCommit: string;
  dataset: {
    id: string;
    sha256: string;
    schemaSha256: string;
    groundTruthSha256: string;
  };
  hardware: {
    machine: string;
    cpu: string;
    memoryBytes: number;
  };
  runtime: {
    provider: 'ollama';
    ollamaVersion: string;
    clientVersion: string;
  };
  model: {
    id: OE4ModelId;
    quantization: 'UD-Q4_K_XL';
    expectedGgufSha256: string;
    localDigest: string;
  };
  inference: {
    temperature: number;
    topP: number;
    numCtx: number;
    numPredict: number;
    seed: number | null;
    keepAlive: string;
    timeoutSeconds: number;
  };
}

export interface InputContractSnapshotV1 {
  contractId: 'aura.input-snapshot.v1';
  mode: OE4InputMode;
  evidenceEnvelopeRef: string;
  includedSections: string[];
  systemInstruction: string;
  userPayload: string;
  responseSchema: Record<string, unknown>;
  promptVersion: string;
  promptHash: string;
  inputHash: string;
  responseSchemaHash: string;
}

export interface LlmStageMetricsV1 {
  totalDurationMs: number | null;
  loadDurationMs: number | null;
  promptEvalDurationMs: number | null;
  evalDurationMs: number | null;
  promptTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  firstTokenMs: number | null;
  tokensPerSecond: number | null;
}

export interface ExperimentValidationErrorV1 {
  code: string;
  path: string;
  message: string;
}

export interface LlmStageErrorV1 {
  code: string;
  message: string;
  retryable: boolean;
}

export interface LlmStageResultV1 {
  contractId: 'aura.llm-stage-result.v1';
  stage: 'diagnosis' | 'script';
  status: 'completed' | 'failed' | 'timeout';
  attemptId: string;
  startedAt: string;
  completedAt: string;
  rawOutput: string;
  parsedOutput: unknown | null;
  validationErrors: ExperimentValidationErrorV1[];
  metrics: LlmStageMetricsV1 | null;
  error: LlmStageErrorV1 | null;
}

export interface AutomaticEvaluationV1 {
  contractId: 'aura.automatic-evaluation.v1';
  evaluatedAt: string;
  diagnosis: {
    primary: {
      tp: number;
      fp: number;
      fn: number;
      precision: number;
      recall: number;
      f1: number;
    };
    engineCoverage: number;
    evidenceFidelity: number | null;
    extendedDiscoveryKeys: string[];
    contractCompliant: boolean;
    inventedColumns: string[];
    unsupportedClaims: string[];
    anchoringScore: number;
  };
  script: {
    contractValid: boolean;
    syntaxValid: boolean;
    safe: boolean;
    coveredActions: string[];
    missingActions: string[];
    unsupportedActions: string[];
  };
}

export interface HumanReviewV1 {
  contractId: 'aura.human-review.v1';
  reviewerId: string;
  reviewedAt: string;
  clarity: 0 | 1 | 2 | 3 | 4;
  traceability: 0 | 1 | 2 | 3 | 4;
  actionability: 0 | 1 | 2 | 3 | 4;
  mean: number;
  notes: string;
}

export interface HitlDecisionV1 {
  contractId: 'aura.hitl-decision.v1';
  status: 'approved' | 'rejected' | 'blocked';
  reviewerId: string;
  decidedAt: string;
  reason: string;
}

export interface ReauditEvidenceV1 {
  beforeScore: number;
  afterScore: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  beforeRows: number;
  afterRows: number;
  beforeColumns: number;
  afterColumns: number;
  estimatedCellsModified: number | null;
  resolvedRuleIds: string[];
  persistentRuleIds: string[];
  newRuleIds: string[];
  outcome: 'improved' | 'unchanged' | 'worsened' | 'inconclusive';
}

export interface DynamicExecutionEvidenceV1 {
  contractId: 'aura.dynamic-execution-evidence.v1';
  status: 'awaiting_external_output' | 'imported' | 'reaudited' | 'blocked';
  approvedScriptHash: string | null;
  beforeDatasetSha256: string;
  afterDatasetSha256: string | null;
  executionEnvironment: string | null;
  executedAt: string | null;
  reaudit: ReauditEvidenceV1 | null;
}

export interface AttemptEventV1 {
  contractId: 'aura.attempt-event.v1';
  eventId: string;
  attemptId: string;
  sequence: number;
  stage: 'diagnosis' | 'script';
  type: 'started' | 'completed' | 'failed' | 'timeout';
  timestamp: string;
  retryOfAttemptId: string | null;
  error: LlmStageErrorV1 | null;
}

export interface ExperimentRunV1 {
  contractId: 'aura.experiment-run.v1';
  contractVersion: '1.0.0';
  campaignId: string;
  runId: string;
  protocolId: string;
  protocolVersion: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  repetition: 1 | 2 | 3 | 4 | 5;
  sequence: number;
  status: ExperimentRunStatus;
  createdAt: string;
  updatedAt: string;
  environment: EnvironmentSnapshotV1;
  input: InputContractSnapshotV1;
  diagnosis: LlmStageResultV1 | null;
  script: LlmStageResultV1 | null;
  automaticEvaluation: AutomaticEvaluationV1 | null;
  humanReview: HumanReviewV1 | null;
  hitl: HitlDecisionV1 | null;
  execution: DynamicExecutionEvidenceV1 | null;
  attempts: AttemptEventV1[];
}

export interface ExperimentGuardResult {
  valid: boolean;
  errors: string[];
}
