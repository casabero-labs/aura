import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODES,
  OE4_MODELS,
} from './finalEvaluationProtocol';
import type {
  AttemptEventV1,
  AutomaticEvaluationV1,
  DynamicExecutionEvidenceV1,
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentGuardResult,
  ExperimentRunStatus,
  ExperimentRunV1,
  HitlDecisionV1,
  HumanReviewV1,
  InputContractSnapshotV1,
  LlmStageMetricsV1,
  LlmStageResultV1,
  ReauditEvidenceV1,
} from './experimentTypes';
import { validateExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import { sha256hex } from '../../contracts/llm/hash';
import type { DiagnosisInputPackageV2, ExecutionReceiptV1, InferenceSnapshotV1 } from '../../contracts/llm/types';

type UnknownRecord = Record<string, unknown>;

const CAMPAIGN_KEYS = [
  'contractId', 'contractVersion', 'campaignId', 'protocolId', 'protocolVersion',
  'status', 'createdAt', 'updatedAt', 'datasetId', 'datasetSha256', 'modelIds',
  'inputModes', 'repetitions', 'plannedRuns', 'configurationHash', 'runIds',
] as const;

const RUN_KEYS = [
  'contractId', 'contractVersion', 'campaignId', 'runId', 'protocolId',
  'protocolVersion', 'modelId', 'inputMode', 'repetition', 'sequence', 'status',
  'createdAt', 'updatedAt', 'environment', 'input', 'warmupReceipt', 'diagnosis', 'script',
  'executionReceipt', 'automaticEvaluation', 'humanReview', 'hitl', 'execution', 'attempts',
] as const;

const CAMPAIGN_STATUSES = new Set(['draft', 'ready', 'running', 'paused', 'completed', 'invalid']);
const RUN_STATUSES = new Set<ExperimentRunStatus>([
  'planned', 'running', 'completed', 'failed', 'awaiting_human', 'reviewed',
  'awaiting_hitl', 'approved', 'rejected', 'blocked', 'awaiting_external_output',
  'reaudited',
]);

const RUN_TRANSITIONS: Record<ExperimentRunStatus, ExperimentRunStatus[]> = {
  planned: ['planned', 'running', 'failed'],
  running: ['running', 'completed', 'failed'],
  completed: ['completed', 'awaiting_human'],
  failed: ['failed', 'running'],
  awaiting_human: ['awaiting_human', 'reviewed'],
  reviewed: ['reviewed', 'awaiting_hitl'],
  awaiting_hitl: ['awaiting_hitl', 'approved', 'rejected', 'blocked'],
  approved: ['approved', 'awaiting_external_output', 'blocked'],
  rejected: ['rejected'],
  blocked: ['blocked'],
  awaiting_external_output: ['awaiting_external_output', 'reaudited', 'blocked'],
  reaudited: ['reaudited'],
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isIsoTimestamp = (value: unknown): value is string =>
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value));

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

const isSha256Digest = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(value);

const isGitCommit = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{7,40}$/.test(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNonNegativeNumber = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && isNonNegativeNumber(value);

const isUnitInterval = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

const isNullableNonNegativeNumber = (value: unknown): value is number | null =>
  value === null || isNonNegativeNumber(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

const hasOnlyKeys = (value: UnknownRecord, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
};

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const result = (errors: string[]): ExperimentGuardResult => ({
  valid: errors.length === 0,
  errors: [...new Set(errors)],
});

const validateEnvironment = (value: unknown, errors: string[]): value is EnvironmentSnapshotV1 => {
  if (!isRecord(value)) {
    errors.push('environment must be an object');
    return false;
  }
  if (value.contractId !== 'aura.environment-snapshot.v1') errors.push('environment.contractId is invalid');
  if (!isIsoTimestamp(value.capturedAt)) errors.push('environment.capturedAt must be an ISO timestamp');
  if (!isGitCommit(value.appCommit)) errors.push('environment.appCommit must be a Git commit hash');

  const dataset = value.dataset;
  if (!isRecord(dataset)) {
    errors.push('environment.dataset must be an object');
  } else {
    if (dataset.id !== FINAL_EVALUATION_PROTOCOL.dataset.id) errors.push('environment.dataset.id must match the frozen protocol');
    if (dataset.sha256 !== FINAL_EVALUATION_PROTOCOL.dataset.sha256) errors.push('environment.dataset.sha256 must match the frozen protocol');
    if (dataset.schemaSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256) errors.push('environment.dataset.schemaSha256 must match the frozen protocol');
    if (dataset.groundTruthSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256) errors.push('environment.dataset.groundTruthSha256 must match the frozen protocol');
  }

  const hardware = value.hardware;
  if (!isRecord(hardware)) {
    errors.push('environment.hardware must be an object');
  } else {
    if (!isNonEmptyString(hardware.machine)) errors.push('environment.hardware.machine is required');
    if (!isNonEmptyString(hardware.cpu)) errors.push('environment.hardware.cpu is required');
    if (!isNonNegativeInteger(hardware.memoryBytes) || hardware.memoryBytes === 0) errors.push('environment.hardware.memoryBytes must be positive');
  }

  const runtime = value.runtime;
  if (!isRecord(runtime)) {
    errors.push('environment.runtime must be an object');
  } else {
    if (runtime.provider !== 'ollama') errors.push('environment.runtime.provider must be ollama');
    if (!isNonEmptyString(runtime.ollamaVersion)) errors.push('environment.runtime.ollamaVersion is required');
    if (!isNonEmptyString(runtime.clientVersion)) errors.push('environment.runtime.clientVersion is required');
  }

  const model = value.model;
  if (!isRecord(model)) {
    errors.push('environment.model must be an object');
  } else {
    if (!OE4_MODELS.includes(model.id as (typeof OE4_MODELS)[number])) errors.push('environment.model.id is not formal');
    if (model.quantization !== 'UD-Q4_K_XL') errors.push('environment.model.quantization must be UD-Q4_K_XL');
    if (!isSha256(model.expectedGgufSha256)) errors.push('environment.model.expectedGgufSha256 must be SHA-256');
    if (!isSha256Digest(model.localDigest)) errors.push('environment.model.localDigest must be a SHA-256 digest');
  }

  const inference = value.inference;
  if (!isRecord(inference) || !sameJson(inference, FINAL_EVALUATION_PROTOCOL.inference)) {
    errors.push('environment.inference must match the frozen protocol');
  }
  return true;
};

const validateInput = (value: unknown, errors: string[]): value is InputContractSnapshotV1 => {
  if (!isRecord(value)) {
    errors.push('input must be an object');
    return false;
  }
  if (value.contractId !== 'aura.input-snapshot.v1') errors.push('input.contractId is invalid');
  if (!OE4_INPUT_MODES.includes(value.mode as (typeof OE4_INPUT_MODES)[number])) errors.push('input.mode is not formal');
  if (typeof value.evidenceEnvelopeRef !== 'string' || !/^env:[a-f0-9]{64}$/.test(value.evidenceEnvelopeRef)) {
    errors.push('input.evidenceEnvelopeRef must be the canonical env reference');
  }
  if (!isStringArray(value.includedSections) || value.includedSections.length === 0) errors.push('input.includedSections must be non-empty');
  if (!isNonEmptyString(value.systemInstruction)) errors.push('input.systemInstruction is required');
  if (!isNonEmptyString(value.userPayload)) errors.push('input.userPayload is required');
  if (!isRecord(value.responseSchema)) errors.push('input.responseSchema must be an object');
  if (!isNonEmptyString(value.promptVersion)) errors.push('input.promptVersion is required');
  if (!isSha256(value.promptHash)) errors.push('input.promptHash must be a SHA-256 hex string');
  if (!isSha256(value.inputHash)) errors.push('input.inputHash must be a SHA-256 hex string');
  if (!isSha256(value.responseSchemaHash)) errors.push('input.responseSchemaHash must be a SHA-256 hex string');
  return true;
};

const validateStageMetrics = (value: unknown, path: string, errors: string[]): value is LlmStageMetricsV1 => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object or null`);
    return false;
  }
  const durationKeys: Array<keyof LlmStageMetricsV1> = [
    'totalDurationMs', 'loadDurationMs', 'promptEvalDurationMs', 'evalDurationMs',
    'firstTokenMs', 'tokensPerSecond',
  ];
  for (const key of durationKeys) {
    if (!isNullableNonNegativeNumber(value[key])) errors.push(`${path}.${key} must be non-negative or null`);
  }
  for (const key of ['promptTokens', 'outputTokens', 'reasoningTokens'] as const) {
    const tokenValue = value[key];
    if (!(tokenValue === null || isNonNegativeInteger(tokenValue))) {
      errors.push(`${path}.${key} must be a non-negative integer or null`);
    }
  }
  return true;
};

const validateStage = (
  value: unknown,
  expectedStage: 'diagnosis' | 'script',
  path: string,
  errors: string[],
): value is LlmStageResultV1 => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object or null`);
    return false;
  }
  if (value.contractId !== 'aura.llm-stage-result.v1') errors.push(`${path}.contractId is invalid`);
  if (value.stage !== expectedStage) errors.push(`${path}.stage must be ${expectedStage}`);
  if (!['completed', 'failed', 'timeout'].includes(String(value.status))) errors.push(`${path}.status is invalid`);
  if (!isNonEmptyString(value.attemptId)) errors.push(`${path}.attemptId is required`);
  if (!isIsoTimestamp(value.startedAt)) errors.push(`${path}.startedAt must be an ISO timestamp`);
  if (!isIsoTimestamp(value.completedAt)) errors.push(`${path}.completedAt must be an ISO timestamp`);
  if (typeof value.rawOutput !== 'string') errors.push(`${path}.rawOutput must be a string`);
  if (!Object.prototype.hasOwnProperty.call(value, 'parsedOutput')) errors.push(`${path}.parsedOutput must be explicit`);
  if (!Array.isArray(value.validationErrors) || !value.validationErrors.every((entry) => (
    isRecord(entry)
    && isNonEmptyString(entry.code)
    && typeof entry.path === 'string'
    && isNonEmptyString(entry.message)
  ))) errors.push(`${path}.validationErrors is invalid`);
  if (value.metrics !== null) validateStageMetrics(value.metrics, `${path}.metrics`, errors);
  if (value.error !== null && !(
    isRecord(value.error)
    && isNonEmptyString(value.error.code)
    && isNonEmptyString(value.error.message)
    && typeof value.error.retryable === 'boolean'
  )) errors.push(`${path}.error is invalid`);
  if (value.status === 'completed' && value.error !== null) errors.push(`${path}.completed result cannot carry an error`);
  if ((value.status === 'failed' || value.status === 'timeout') && value.error === null) errors.push(`${path}.${value.status} result requires an error`);
  return true;
};

const validateAutomaticEvaluation = (value: unknown, errors: string[]): value is AutomaticEvaluationV1 => {
  if (!isRecord(value)) {
    errors.push('automaticEvaluation must be an object or null');
    return false;
  }
  if (value.contractId !== 'aura.automatic-evaluation.v1') errors.push('automaticEvaluation.contractId is invalid');
  if (!isIsoTimestamp(value.evaluatedAt)) errors.push('automaticEvaluation.evaluatedAt must be an ISO timestamp');
  const diagnosis = value.diagnosis;
  if (!isRecord(diagnosis)) {
    errors.push('automaticEvaluation.diagnosis must be an object');
  } else {
    const primary = diagnosis.primary;
    if (!isRecord(primary)) {
      errors.push('automaticEvaluation.diagnosis.primary must be an object');
    } else {
      for (const key of ['tp', 'fp', 'fn'] as const) {
        if (!isNonNegativeInteger(primary[key])) errors.push(`automaticEvaluation.diagnosis.primary.${key} must be a non-negative integer`);
      }
      for (const key of ['precision', 'recall', 'f1'] as const) {
        if (!isUnitInterval(primary[key])) errors.push(`automaticEvaluation.diagnosis.primary.${key} must be within 0–1`);
      }
    }
    if (!isUnitInterval(diagnosis.engineCoverage)) errors.push('automaticEvaluation.diagnosis.engineCoverage must be within 0–1');
    if (!(diagnosis.evidenceFidelity === null || isUnitInterval(diagnosis.evidenceFidelity))) errors.push('automaticEvaluation.diagnosis.evidenceFidelity must be within 0–1 or null');
    if (!isStringArray(diagnosis.extendedDiscoveryKeys)) errors.push('automaticEvaluation.diagnosis.extendedDiscoveryKeys is invalid');
    if (typeof diagnosis.contractCompliant !== 'boolean') errors.push('automaticEvaluation.diagnosis.contractCompliant must be boolean');
    if (!isStringArray(diagnosis.inventedColumns)) errors.push('automaticEvaluation.diagnosis.inventedColumns is invalid');
    if (!isStringArray(diagnosis.unsupportedClaims)) errors.push('automaticEvaluation.diagnosis.unsupportedClaims is invalid');
    if (!isUnitInterval(diagnosis.anchoringScore)) errors.push('automaticEvaluation.diagnosis.anchoringScore must be within 0–1');
  }
  const script = value.script;
  if (!isRecord(script)) {
    errors.push('automaticEvaluation.script must be an object');
  } else {
    for (const key of ['contractValid', 'syntaxValid', 'safe'] as const) {
      if (typeof script[key] !== 'boolean') errors.push(`automaticEvaluation.script.${key} must be boolean`);
    }
    for (const key of ['coveredActions', 'missingActions', 'unsupportedActions'] as const) {
      if (!isStringArray(script[key])) errors.push(`automaticEvaluation.script.${key} is invalid`);
    }
  }
  return true;
};

const validateHumanReview = (value: unknown, errors: string[]): value is HumanReviewV1 => {
  if (!isRecord(value)) {
    errors.push('humanReview must be an object or null');
    return false;
  }
  if (value.contractId !== 'aura.human-review.v1') errors.push('humanReview.contractId is invalid');
  if (!isNonEmptyString(value.reviewerId)) errors.push('humanReview.reviewerId is required');
  if (!isIsoTimestamp(value.reviewedAt)) errors.push('humanReview.reviewedAt must be an ISO timestamp');
  for (const key of ['clarity', 'traceability', 'actionability'] as const) {
    if (!Number.isInteger(value[key]) || !isFiniteNumber(value[key]) || value[key] < 0 || value[key] > 4) {
      errors.push(`humanReview.${key} must be an integer from 0 to 4`);
    }
  }
  if (isFiniteNumber(value.clarity) && isFiniteNumber(value.traceability) && isFiniteNumber(value.actionability)) {
    const expectedMean = (value.clarity + value.traceability + value.actionability) / 3;
    if (!isFiniteNumber(value.mean) || Math.abs(value.mean - expectedMean) > 1e-12) {
      errors.push('humanReview.mean must equal the mean of the three rubric scores');
    }
  }
  if (typeof value.notes !== 'string') errors.push('humanReview.notes must be a string');
  const hasExtremeScore = [value.clarity, value.traceability, value.actionability]
    .some((score) => score === 0 || score === 4);
  if (hasExtremeScore && (!isNonEmptyString(value.notes))) {
    errors.push('humanReview.notes is required when any score is 0 or 4');
  }
  return true;
};

const validateHitl = (value: unknown, errors: string[]): value is HitlDecisionV1 => {
  if (!isRecord(value)) {
    errors.push('hitl must be an object or null');
    return false;
  }
  if (value.contractId !== 'aura.hitl-decision.v1') errors.push('hitl.contractId is invalid');
  if (!['approved', 'rejected', 'blocked'].includes(String(value.status))) errors.push('hitl.status is invalid');
  if (!isNonEmptyString(value.reviewerId)) errors.push('hitl.reviewerId is required');
  if (!isIsoTimestamp(value.decidedAt)) errors.push('hitl.decidedAt must be an ISO timestamp');
  if (!isNonEmptyString(value.reason)) errors.push('hitl.reason is required');
  return true;
};

const validateReaudit = (value: unknown, errors: string[]): value is ReauditEvidenceV1 => {
  if (!isRecord(value)) {
    errors.push('execution.reaudit must be an object or null');
    return false;
  }
  for (const key of [
    'beforeScore', 'afterScore', 'beforeIssueCount', 'afterIssueCount', 'beforeRows',
    'afterRows', 'beforeColumns', 'afterColumns',
  ] as const) {
    if (!isNonNegativeNumber(value[key])) errors.push(`execution.reaudit.${key} must be non-negative`);
  }
  if (!isNullableNonNegativeNumber(value.estimatedCellsModified)) errors.push('execution.reaudit.estimatedCellsModified must be non-negative or null');
  for (const key of ['resolvedRuleIds', 'persistentRuleIds', 'newRuleIds'] as const) {
    if (!isStringArray(value[key])) errors.push(`execution.reaudit.${key} is invalid`);
  }
  if (!['improved', 'unchanged', 'worsened', 'inconclusive'].includes(String(value.outcome))) errors.push('execution.reaudit.outcome is invalid');
  return true;
};

const validateExecution = (value: unknown, errors: string[]): value is DynamicExecutionEvidenceV1 => {
  if (!isRecord(value)) {
    errors.push('execution must be an object or null');
    return false;
  }
  if (value.contractId !== 'aura.dynamic-execution-evidence.v1') errors.push('execution.contractId is invalid');
  if (!['awaiting_external_output', 'imported', 'reaudited', 'blocked'].includes(String(value.status))) errors.push('execution.status is invalid');
  if (!(value.approvedScriptHash === null || isSha256(value.approvedScriptHash))) errors.push('execution.approvedScriptHash must be SHA-256 or null');
  if (!isSha256(value.beforeDatasetSha256)) errors.push('execution.beforeDatasetSha256 must be SHA-256');
  if (!(value.afterDatasetSha256 === null || isSha256(value.afterDatasetSha256))) errors.push('execution.afterDatasetSha256 must be SHA-256 or null');
  if (!(value.executionEnvironment === null || isNonEmptyString(value.executionEnvironment))) errors.push('execution.executionEnvironment must be non-empty or null');
  if (!(value.executedAt === null || isIsoTimestamp(value.executedAt))) errors.push('execution.executedAt must be ISO or null');
  if (value.reaudit !== null) validateReaudit(value.reaudit, errors);
  if (value.status === 'reaudited' && (
    value.reaudit === null
    || !isSha256(value.afterDatasetSha256)
    || !isIsoTimestamp(value.executedAt)
    || !isNonEmptyString(value.executionEnvironment)
  )) errors.push('reaudited execution must include output hash, environment, time and reaudit');
  return true;
};

const validateAttemptEvents = (value: unknown, errors: string[]): value is AttemptEventV1[] => {
  if (!Array.isArray(value)) {
    errors.push('attempts must be an array');
    return false;
  }
  const eventIds = new Set<string>();
  const earlierAttempts = new Set<string>();
  let hasDuplicateEventId = false;
  let hasForwardRetry = false;

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`attempts[${index}] must be an object`);
      return;
    }
    if (entry.contractId !== 'aura.attempt-event.v1') errors.push(`attempts[${index}].contractId is invalid`);
    if (!isNonEmptyString(entry.eventId)) errors.push(`attempts[${index}].eventId is required`);
    if (!isNonEmptyString(entry.attemptId)) errors.push(`attempts[${index}].attemptId is required`);
    if (entry.sequence !== index + 1) errors.push('attempt sequences must be contiguous and ordered');
    if (!['diagnosis', 'script'].includes(String(entry.stage))) errors.push(`attempts[${index}].stage is invalid`);
    if (!['started', 'completed', 'failed', 'timeout'].includes(String(entry.type))) errors.push(`attempts[${index}].type is invalid`);
    if (!isIsoTimestamp(entry.timestamp)) errors.push(`attempts[${index}].timestamp must be ISO`);
    if (!(entry.retryOfAttemptId === null || isNonEmptyString(entry.retryOfAttemptId))) errors.push(`attempts[${index}].retryOfAttemptId is invalid`);
    if (isNonEmptyString(entry.eventId)) {
      if (eventIds.has(entry.eventId)) hasDuplicateEventId = true;
      eventIds.add(entry.eventId);
    }
    if (isNonEmptyString(entry.retryOfAttemptId) && !earlierAttempts.has(entry.retryOfAttemptId)) hasForwardRetry = true;
    if (isNonEmptyString(entry.attemptId)) earlierAttempts.add(entry.attemptId);
    if (entry.error !== null && !(
      isRecord(entry.error)
      && isNonEmptyString(entry.error.code)
      && isNonEmptyString(entry.error.message)
      && typeof entry.error.retryable === 'boolean'
    )) errors.push(`attempts[${index}].error is invalid`);
    if ((entry.type === 'failed' || entry.type === 'timeout') && entry.error === null) errors.push(`attempts[${index}] failure requires error`);
    if ((entry.type === 'started' || entry.type === 'completed') && entry.error !== null) errors.push(`attempts[${index}] non-failure cannot carry error`);
  });
  if (hasDuplicateEventId) errors.push('attempt eventIds must be unique');
  if (hasForwardRetry) errors.push('retryOfAttemptId must reference an earlier attempt');
  return true;
};

const validateLifecycle = (run: UnknownRecord, errors: string[]): void => {
  const diagnosisCompleted = isRecord(run.diagnosis) && run.diagnosis.status === 'completed';
  const scriptCompleted = isRecord(run.script) && run.script.status === 'completed';
  const stagesCompleted = FINAL_EVALUATION_PROTOCOL.matrix.stagesPerUnit === 1
    ? diagnosisCompleted
    : diagnosisCompleted && scriptCompleted;
  const automaticPresent = isRecord(run.automaticEvaluation);
  const humanPresent = isRecord(run.humanReview);
  const hitlStatus = isRecord(run.hitl) ? run.hitl.status : null;
  const executionStatus = isRecord(run.execution) ? run.execution.status : null;
  const executionHasReaudit = isRecord(run.execution) && isRecord(run.execution.reaudit);

  switch (run.status) {
    case 'planned':
      if (run.diagnosis !== null || run.script !== null || run.automaticEvaluation !== null
        || run.humanReview !== null || run.hitl !== null || run.execution !== null
        || (Array.isArray(run.attempts) && run.attempts.length > 0)) {
        errors.push('planned status cannot contain execution results');
      }
      break;
    case 'completed':
      if (!stagesCompleted) errors.push('completed status requires every measured protocol stage');
      break;
    case 'failed': {
      const failedStage = (isRecord(run.diagnosis) && ['failed', 'timeout'].includes(String(run.diagnosis.status)))
        || (isRecord(run.script) && ['failed', 'timeout'].includes(String(run.script.status)));
      const failedEvent = Array.isArray(run.attempts) && run.attempts.some(
        (entry) => isRecord(entry) && (entry.type === 'failed' || entry.type === 'timeout'),
      );
      if (!failedStage && !failedEvent) errors.push('failed status requires preserved failure evidence');
      break;
    }
    case 'awaiting_human':
      if (!stagesCompleted || !automaticPresent || run.humanReview !== null) errors.push('awaiting_human status requires completed stages and automatic evaluation only');
      break;
    case 'reviewed':
      if (!stagesCompleted || !automaticPresent || !humanPresent) errors.push('reviewed status requires stages, automatic evaluation and human review');
      break;
    case 'awaiting_hitl':
      if (!stagesCompleted || !automaticPresent || !humanPresent || run.hitl !== null) errors.push('awaiting_hitl status requires reviewed evidence and no decision yet');
      break;
    case 'approved':
    case 'rejected':
      if (!stagesCompleted || !automaticPresent || !humanPresent || hitlStatus !== run.status) {
        errors.push(`${String(run.status)} status requires reviewed evidence and matching HITL decision`);
      }
      break;
    case 'blocked':
      if (!stagesCompleted || !automaticPresent || !humanPresent || !(
        hitlStatus === 'blocked'
        || (hitlStatus === 'approved' && executionStatus === 'blocked')
      )) errors.push('blocked status requires reviewed evidence and an explicit HITL or execution block');
      break;
    case 'awaiting_external_output':
      if (!stagesCompleted || !automaticPresent || !humanPresent
        || hitlStatus !== 'approved' || executionStatus !== 'awaiting_external_output') {
        errors.push('awaiting_external_output status requires reviewed approval and matching execution evidence');
      }
      break;
    case 'reaudited':
      if (!stagesCompleted || !automaticPresent || !humanPresent
        || hitlStatus !== 'approved' || executionStatus !== 'reaudited' || !executionHasReaudit) {
        errors.push('reaudited status requires execution evidence with reaudit');
      }
      break;
    default:
      break;
  }
};

export const validateExperimentCampaignV1 = (value: unknown): ExperimentGuardResult => {
  const errors: string[] = [];
  if (!isRecord(value)) return result(['campaign must be an object']);
  if (!hasOnlyKeys(value, CAMPAIGN_KEYS)) errors.push('campaign contains unknown top-level fields');
  if (value.contractId !== 'aura.experiment-campaign.v1') errors.push('campaign contractId is invalid');
  if (value.contractVersion !== '1.0.0') errors.push('campaign contractVersion is invalid');
  if (!isNonEmptyString(value.campaignId)) errors.push('campaignId is required');
  if (value.protocolId !== FINAL_EVALUATION_PROTOCOL.id) errors.push('protocolId must match the frozen protocol');
  if (value.protocolVersion !== FINAL_EVALUATION_PROTOCOL.version) errors.push('protocolVersion must match the frozen protocol');
  if (!CAMPAIGN_STATUSES.has(String(value.status))) errors.push('campaign status is invalid');
  if (!isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) errors.push('campaign timestamps must be ISO');
  if (value.datasetId !== FINAL_EVALUATION_PROTOCOL.dataset.id) errors.push('datasetId must match the frozen protocol');
  if (value.datasetSha256 !== FINAL_EVALUATION_PROTOCOL.dataset.sha256) errors.push('datasetSha256 must match the frozen protocol');
  if (!sameJson(value.modelIds, FINAL_EVALUATION_PROTOCOL.models)) errors.push('modelIds must match the frozen protocol in order');
  if (!sameJson(value.inputModes, FINAL_EVALUATION_PROTOCOL.inputModes)) errors.push('inputModes must match the frozen protocol in order');
  if (value.repetitions !== 5) errors.push('repetitions must equal 5');
  if (value.plannedRuns !== 45) errors.push('plannedRuns must equal 45');
  if (!isSha256(value.configurationHash)) errors.push('configurationHash must be SHA-256');
  if (!isStringArray(value.runIds) || value.runIds.length !== 45) errors.push('runIds must contain exactly 45 identities');
  if (Array.isArray(value.runIds) && new Set(value.runIds).size !== value.runIds.length) errors.push('runIds must be unique');
  return result(errors);
};

export const isExperimentCampaignV1 = (value: unknown): value is ExperimentCampaignV1 =>
  validateExperimentCampaignV1(value).valid;

export const validateExperimentRunV1 = (value: unknown): ExperimentGuardResult => {
  const errors: string[] = [];
  if (!isRecord(value)) return result(['run must be an object']);
  if (!hasOnlyKeys(value, RUN_KEYS)) errors.push('run contains unknown top-level fields');
  if (value.contractId !== 'aura.experiment-run.v1') errors.push('run contractId is invalid');
  if (value.contractVersion !== '1.0.0') errors.push('run contractVersion is invalid');
  if (!isNonEmptyString(value.campaignId)) errors.push('campaignId is required');
  if (!isNonEmptyString(value.runId)) errors.push('runId is required');
  if (value.protocolId !== FINAL_EVALUATION_PROTOCOL.id) errors.push('protocolId must match the frozen protocol');
  if (value.protocolVersion !== FINAL_EVALUATION_PROTOCOL.version) errors.push('protocolVersion must match the frozen protocol');
  if (!OE4_MODELS.includes(value.modelId as (typeof OE4_MODELS)[number])) errors.push('modelId is not part of the frozen protocol');
  if (!OE4_INPUT_MODES.includes(value.inputMode as (typeof OE4_INPUT_MODES)[number])) errors.push('inputMode is not part of the frozen protocol');
  if (!Number.isInteger(value.repetition) || !isFiniteNumber(value.repetition) || value.repetition < 1 || value.repetition > 5) {
    errors.push('repetition must be an integer from 1 to 5');
  }
  if (!Number.isInteger(value.sequence) || !isFiniteNumber(value.sequence) || value.sequence < 1) errors.push('sequence must be a positive integer');
  if (!RUN_STATUSES.has(value.status as ExperimentRunStatus)) errors.push('run status is invalid');
  if (!isIsoTimestamp(value.createdAt) || !isIsoTimestamp(value.updatedAt)) errors.push('run timestamps must be ISO');

  validateEnvironment(value.environment, errors);
  validateInput(value.input, errors);
  if (isRecord(value.environment) && isRecord(value.environment.model) && value.environment.model.id !== value.modelId) {
    errors.push('environment.model.id must equal modelId');
  }
  if (isRecord(value.input) && value.input.mode !== value.inputMode) errors.push('input.mode must equal inputMode');
  if (!(value.warmupReceipt === undefined || value.warmupReceipt === null || (
    isRecord(value.warmupReceipt)
    && value.warmupReceipt.contractId === 'aura.warmup-receipt.v1'
    && value.warmupReceipt.modelId === value.modelId
    && value.warmupReceipt.repetition === value.repetition
    && isSha256(value.warmupReceipt.promptHash)
    && isSha256(value.warmupReceipt.responseHash)
    && isIsoTimestamp(value.warmupReceipt.completedAt)
  ))) errors.push('warmupReceipt is invalid or does not match the run block');

  if (value.diagnosis !== null) validateStage(value.diagnosis, 'diagnosis', 'diagnosis', errors);
  if (!(value.executionReceipt === undefined || value.executionReceipt === null || (
    isRecord(value.executionReceipt)
    && value.executionReceipt.contractId === 'aura.execution-receipt.v1'
    && isSha256(value.executionReceipt.receiptHash)
    && value.executionReceipt.inputHash === (isRecord(value.input) ? value.input.inputHash : undefined)
  ))) errors.push('executionReceipt is invalid or does not match input');
  if (isRecord(value.executionReceipt) && isRecord(value.input) && isRecord(value.environment)) {
    const snapshot: DiagnosisInputPackageV2 = {
      contractId: 'aura.input-snapshot.v2', contractVersion: '2.0.0',
      inputMode: value.inputMode as DiagnosisInputPackageV2['inputMode'],
      includedSections: value.input.includedSections as string[],
      systemInstruction: value.input.systemInstruction as string,
      userPayload: value.input.userPayload as string,
      responseSchema: value.input.responseSchema as Record<string, unknown>,
      evidenceEnvelopeRef: value.input.evidenceEnvelopeRef as string,
      promptVersion: value.input.promptVersion as string,
      promptHash: value.input.promptHash as string,
      inputHash: value.input.inputHash as string,
      responseSchemaHash: value.input.responseSchemaHash as string,
    };
    const receipt = value.executionReceipt as unknown as ExecutionReceiptV1;
    const inference = value.environment.inference as InferenceSnapshotV1;
    const receiptValidation = validateExecutionReceiptV1(receipt, snapshot, exactDiagnosisPromptV2(snapshot), inference);
    if (!receiptValidation.valid) errors.push(`executionReceipt verification failed: ${receiptValidation.errors.join(', ')}`);
    if (receipt.requestedModel !== value.modelId || receipt.observedModel !== value.modelId) {
      errors.push('executionReceipt model identity does not match run.modelId');
    }
    if (isRecord(value.environment.model) && receipt.modelDigest !== value.environment.model.localDigest) {
      errors.push('executionReceipt model digest does not match environment');
    }
    if (isRecord(value.diagnosis) && typeof value.diagnosis.rawOutput === 'string'
      && receipt.rawResponseHash !== sha256hex(value.diagnosis.rawOutput)) {
      errors.push('executionReceipt raw response hash does not match diagnosis output');
    }
  }
  if (value.script !== null) validateStage(value.script, 'script', 'script', errors);
  if (value.automaticEvaluation !== null) validateAutomaticEvaluation(value.automaticEvaluation, errors);
  if (value.humanReview !== null) validateHumanReview(value.humanReview, errors);
  if (value.hitl !== null) validateHitl(value.hitl, errors);
  if (value.execution !== null) validateExecution(value.execution, errors);
  validateAttemptEvents(value.attempts, errors);
  validateLifecycle(value, errors);
  return result(errors);
};

export const isExperimentRunV1 = (value: unknown): value is ExperimentRunV1 =>
  validateExperimentRunV1(value).valid;

const RUN_COORDINATE_KEYS: Array<keyof ExperimentRunV1> = [
  'campaignId', 'runId', 'protocolId', 'protocolVersion', 'modelId', 'inputMode',
  'repetition', 'sequence', 'createdAt',
];

export const validateExperimentRunUpdate = (
  previous: ExperimentRunV1,
  next: ExperimentRunV1,
): ExperimentGuardResult => {
  const errors = [...validateExperimentRunV1(next).errors];
  if (RUN_COORDINATE_KEYS.some((key) => previous[key] !== next[key])) {
    errors.push('run coordinates are immutable');
  }
  if (!sameJson(previous.environment, next.environment) || !sameJson(previous.input, next.input)) {
    errors.push('environment and input snapshots are immutable');
  }
  if (previous.executionReceipt && !sameJson(previous.executionReceipt, next.executionReceipt)) {
    errors.push('execution receipt cannot be overwritten');
  }
  if (previous.warmupReceipt && !sameJson(previous.warmupReceipt, next.warmupReceipt)) {
    errors.push('warm-up receipt cannot be overwritten');
  }
  const existingEventsPreserved = previous.attempts.length <= next.attempts.length
    && previous.attempts.every((event, index) => sameJson(event, next.attempts[index]));
  if (!existingEventsPreserved) errors.push('existing attempt events cannot be overwritten or removed');
  if (!RUN_TRANSITIONS[previous.status].includes(next.status)) errors.push('run status transition is invalid');
  if (Date.parse(next.updatedAt) < Date.parse(previous.updatedAt)) errors.push('updatedAt cannot move backwards');
  return result(errors);
};
