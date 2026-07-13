import type { AIProvider, ProviderMetrics } from '../../types';
import { buildExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import { exactDiagnosisPromptV2 } from '../../contracts/llm/diagnosisInputPackageV2';
import type { DiagnosisInputPackageV2, ExecutionReceiptV1, InferenceSnapshotV1 } from '../../contracts/llm/types';
import { parseDiagnosisResponseV2, type DiagnosisParseOutcome } from '../../contracts/llm/diagnosisParserV2';
import { sha256hex } from '../../contracts/llm/hash';
import type {
  AttemptEventV1,
  ExperimentRunV1,
  ExperimentValidationErrorV1,
  LlmStageErrorV1,
  LlmStageMetricsV1,
  LlmStageResultV1,
} from './experimentTypes';
import { validateExperimentRunV1 } from './experimentGuards';
import { FINAL_EVALUATION_PROTOCOL } from './finalEvaluationProtocol';
import type { ExperimentRunnerStore } from './experimentStore';

export type { ExperimentRunnerStore } from './experimentStore';

type Stage = LlmStageResultV1['stage'];
type StageTerminalType = 'completed' | 'failed' | 'timeout';

export interface ExperimentRunnerDependencies {
  provider?: Pick<AIProvider, 'generateText'>;
  providerForRun?: (run: ExperimentRunV1) => Pick<AIProvider, 'generateText'>;
  validateDiagnosis: (
    parsed: unknown,
    run: ExperimentRunV1,
  ) => ExperimentValidationErrorV1[];
  store: ExperimentRunnerStore;
  now?: () => string;
  providerName?: string;
}

export interface RunUnitsOptions {
  shouldPause?: (progress: {
    completedUnits: number;
    totalUnits: number;
    nextRun: ExperimentRunV1;
  }) => boolean;
}

export interface RunUnitsOutcome {
  runs: ExperimentRunV1[];
  completedUnits: number;
  paused: boolean;
}

export interface ExperimentRunner {
  runUnit(run: ExperimentRunV1): Promise<ExperimentRunV1>;
  runUnits(runs: readonly ExperimentRunV1[], options?: RunUnitsOptions): Promise<RunUnitsOutcome>;
}

class StageOutputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly rawOutput: string,
    readonly parsedOutput: unknown | null,
    readonly metrics: LlmStageMetricsV1 | null,
    readonly validationErrors: ExperimentValidationErrorV1[],
  ) {
    super(message);
    this.name = 'StageOutputError';
  }
}

const toStageMetrics = (metrics: ProviderMetrics | null | undefined): LlmStageMetricsV1 | null => {
  if (!metrics) return null;
  const outputTokens = metrics.tokensGenerated ?? null;
  const duration = metrics.evalDurationMs ?? metrics.latencyMs ?? 0;
  return {
    totalDurationMs: metrics.totalDurationMs ?? metrics.latencyMs ?? null,
    loadDurationMs: metrics.loadDurationMs ?? null,
    promptEvalDurationMs: metrics.promptEvalDurationMs ?? null,
    evalDurationMs: metrics.evalDurationMs ?? null,
    promptTokens: metrics.promptTokens ?? null,
    outputTokens,
    reasoningTokens: metrics.reasoningTokens ?? null,
    firstTokenMs: metrics.firstTokenMs ?? null,
    tokensPerSecond: outputTokens !== null && duration > 0
      ? Number((outputTokens / (duration / 1000)).toFixed(2))
      : null,
  };
};

const parseDiagnosisStrict = (
  rawOutput: string,
  metrics: LlmStageMetricsV1,
): { parsed: unknown; parseErrors: ExperimentValidationErrorV1[] } => {
  const outcome: DiagnosisParseOutcome = parseDiagnosisResponseV2(rawOutput);
  if (outcome.success) {
    return { parsed: outcome.response, parseErrors: [] };
  }
  const failure = outcome as { success: false; error: { code: string; message: string; path: string; details: unknown } };
  return {
    parsed: null,
    parseErrors: [{
      code: failure.error.code,
      path: failure.error.path || '$',
      message: failure.error.message,
    }],
  };
};

export const buildFormalDiagnosisPrompt = (run: ExperimentRunV1): string =>
  exactDiagnosisPromptV2(run.input);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const classifyFailure = (error: unknown, stage: Stage): {
  status: 'failed' | 'timeout';
  type: 'failed' | 'timeout';
  error: LlmStageErrorV1;
} => {
  if (error instanceof StageOutputError) {
    return {
      status: 'failed',
      type: 'failed',
      error: { code: error.code, message: error.message, retryable: false },
    };
  }
  const message = errorMessage(error);
  const timeout = /timeout|timed out/i.test(message);
  return {
    status: timeout ? 'timeout' : 'failed',
    type: timeout ? 'timeout' : 'failed',
    error: {
      code: timeout ? `${stage.toUpperCase()}_TIMEOUT` : `${stage.toUpperCase()}_PROVIDER_ERROR`,
      message,
      retryable: true,
    },
  };
};

const lastFailedAttemptId = (run: ExperimentRunV1, stage: Stage): string | null => {
  for (let index = run.attempts.length - 1; index >= 0; index -= 1) {
    const event = run.attempts[index];
    if (event.stage === stage && (event.type === 'failed' || event.type === 'timeout')) {
      return event.attemptId;
    }
  }
  return null;
};

const nextAttemptId = (run: ExperimentRunV1, stage: Stage): string => {
  const priorAttempts = new Set(
    run.attempts.filter((event) => event.stage === stage).map((event) => event.attemptId),
  );
  return `attempt:${run.runId}:${stage}:${priorAttempts.size + 1}`;
};

const cloneInputSnapshot = (input: DiagnosisInputPackageV2): DiagnosisInputPackageV2 => ({
  ...input,
  includedSections: [...input.includedSections],
});

const buildReceipt = (params: {
  input: DiagnosisInputPackageV2;
  prompt: string;
  provider: string;
  requestedModel: string;
  observedModel: string | null;
  modelDigest: string;
  inference: InferenceSnapshotV1;
  startedAt: string;
  completedAt: string;
  rawResponse: string;
  validationStatus: ExecutionReceiptV1['validationStatus'];
  validationErrorCodes: string[];
}): ExecutionReceiptV1 => buildExecutionReceiptV1({
  input: params.input,
  requestedInputMode: params.input.inputMode,
  exactPrompt: params.prompt,
  provider: params.provider,
  requestedModel: params.requestedModel,
  observedModel: params.observedModel,
  modelDigest: params.modelDigest,
  inference: params.inference,
  startedAt: params.startedAt,
  completedAt: params.completedAt,
  rawResponse: params.rawResponse,
  validationStatus: params.validationStatus,
  validationErrorCodes: params.validationErrorCodes,
});

export const createExperimentRunner = ({
  provider,
  providerForRun,
  validateDiagnosis,
  store,
  now = () => new Date().toISOString(),
  providerName: injectedProviderName,
}: ExperimentRunnerDependencies): ExperimentRunner => {
  const warmedReceipts = new Map<string, import('./experimentTypes').WarmupReceiptV1>();
  const providerFor = (run: ExperimentRunV1) => providerForRun?.(run) ?? provider;

  const ensureWarmup = async (run: ExperimentRunV1): Promise<ExperimentRunV1> => {
    const blockKey = `${run.modelId}::${run.repetition}`;

    if (run.warmupReceipt) {
      warmedReceipts.set(blockKey, run.warmupReceipt);
      return run;
    }

    const existing = warmedReceipts.get(blockKey);
    if (existing) return { ...run, warmupReceipt: existing };

    const persisted = store.listRuns
      ? (await store.listRuns(run.campaignId)).find((candidate) => (
          candidate.modelId === run.modelId
          && candidate.repetition === run.repetition
          && candidate.warmupReceipt?.contractId === 'aura.warmup-receipt.v1'
        ))
      : undefined;
    if (persisted?.warmupReceipt) {
      warmedReceipts.set(blockKey, persisted.warmupReceipt);
      return { ...run, warmupReceipt: persisted.warmupReceipt };
    }

    const effectiveProvider = providerFor(run);
    if (!effectiveProvider) throw new Error('No formal provider was configured for warm-up.');
    const prompt = 'Warm-up OE4 excluded from evaluation. Reply with exactly: READY';
    const warmup = await effectiveProvider.generateText(prompt);
    const warmupObserved = warmup.metrics?.model ?? null;
    if (!warmupObserved) {
      throw new Error('WARMUP_MODEL_NOT_OBSERVED: Ollama did not report data.model in the warm-up response.');
    }
    if (warmupObserved !== run.modelId) {
      throw new Error(`WARMUP_MODEL_MISMATCH: requested ${run.modelId}, observed ${warmupObserved}.`);
    }
    const completedAt = now();
    const receipt: import('./experimentTypes').WarmupReceiptV1 = {
      contractId: 'aura.warmup-receipt.v1',
      excludedFromEvaluation: true,
      blockId: blockKey,
      modelId: run.modelId,
      repetition: run.repetition,
      promptHash: sha256hex(prompt),
      responseHash: sha256hex(warmup.text),
      completedAt,
      metrics: toStageMetrics(warmup.metrics) ?? {
        totalDurationMs: 0, loadDurationMs: 0,
        promptEvalDurationMs: 0, evalDurationMs: 0,
        promptTokens: 0, outputTokens: 0, reasoningTokens: null,
        firstTokenMs: 0, tokensPerSecond: 0,
      },
    };
    warmedReceipts.set(blockKey, receipt);
    const nextRun: ExperimentRunV1 = {
      ...run,
      updatedAt: completedAt,
      warmupReceipt: receipt,
    };
    try {
      await store.saveRun(nextRun);
    } catch (error) {
      throw new Error(`WARMUP_SAVE_FAILED for ${run.runId} (${run.modelId}::${run.repetition}): ${(error as Error).message}`);
    }
    return nextRun;
  };
  const appendEvent = async (
    run: ExperimentRunV1,
    event: AttemptEventV1,
    changes: Partial<ExperimentRunV1> = {},
  ): Promise<ExperimentRunV1> => {
    const nextRun: ExperimentRunV1 = {
      ...run,
      ...changes,
      updatedAt: event.timestamp,
      attempts: [...run.attempts, event],
    };
    await store.appendAttemptEvent(run.runId, event, nextRun);
    return nextRun;
  };

  const runStage = async (
    initialRun: ExperimentRunV1,
    stage: Stage,
    prompt: string,
  ): Promise<ExperimentRunV1> => {
    const attemptId = nextAttemptId(initialRun, stage);
    const retryOfAttemptId = lastFailedAttemptId(initialRun, stage);
    const startedAt = now();
    const startedEvent: AttemptEventV1 = {
      contractId: 'aura.attempt-event.v1',
      eventId: `event:${attemptId}:started`,
      attemptId,
      sequence: initialRun.attempts.length + 1,
      stage,
      type: 'started',
      timestamp: startedAt,
      retryOfAttemptId,
      error: null,
    };
    let run = await appendEvent(initialRun, startedEvent, { status: 'running' });

    const snapshot = cloneInputSnapshot(initialRun.input);
  let observedModel: string | null = null;
  let providerName = '';
  let rawResponse = '';
  let providerMetrics: ProviderMetrics | null = null;
  let parsedOutput: unknown = null;
  let parseErrorCodes: string[] = [];
  let parseErrorMessages: string[] = [];
  let diagnosisValidation: ExperimentValidationErrorV1[] = [];

    try {
      const effectiveProvider = providerFor(initialRun);
      if (!effectiveProvider) throw new Error('No formal provider was configured for this run.');
      const providerResult = await effectiveProvider.generateText(
        prompt,
        stage === 'diagnosis' ? { responseSchema: snapshot.responseSchema } : undefined,
      );
      providerName = providerResult.metrics.provider;
      providerMetrics = providerResult.metrics;
      rawResponse = providerResult.text;
      observedModel = providerResult.metrics.model ?? null;
      if (stage === 'diagnosis') {
        if (!observedModel) {
          throw new StageOutputError(
            'DIAGNOSIS_MODEL_NOT_OBSERVED',
            'Ollama did not report data.model in the response.',
            rawResponse,
            null,
            toStageMetrics(providerMetrics),
            [{
              code: 'DIAGNOSIS_MODEL_NOT_OBSERVED',
              path: '$.model',
              message: 'Observed model missing from provider response.',
            }],
          );
        }
        if (observedModel !== initialRun.modelId) {
          throw new StageOutputError(
            'DIAGNOSIS_MODEL_MISMATCH',
            `Requested ${initialRun.modelId}, observed ${observedModel}.`,
            rawResponse,
            null,
            toStageMetrics(providerMetrics),
            [{
              code: 'DIAGNOSIS_MODEL_MISMATCH',
              path: '$.model',
              message: 'Provider did not serve the requested model.',
            }],
          );
        }
        const parseOutcome = parseDiagnosisStrict(rawResponse, toStageMetrics(providerMetrics) as LlmStageMetricsV1);
        parsedOutput = parseOutcome.parsed;
        parseErrorCodes = parseOutcome.parseErrors.map((err) => err.code);
        parseErrorMessages = parseOutcome.parseErrors.map((err) => err.message);
        if (!parseOutcome.parsed) {
          throw new StageOutputError(
            parseOutcome.parseErrors[0]?.code ?? 'DIAGNOSIS_JSON_INVALID',
            parseOutcome.parseErrors[0]?.message ?? 'The provider output is not a valid diagnosis v2 object.',
            rawResponse,
            null,
            toStageMetrics(providerMetrics),
            parseOutcome.parseErrors,
          );
        }
        diagnosisValidation = validateDiagnosis(parsedOutput, initialRun);
        if (diagnosisValidation.length > 0) {
          throw new StageOutputError(
            'DIAGNOSIS_CONTRACT_INVALID',
            'The diagnosis failed the complete aura.diagnosis.v2 validation.',
            rawResponse,
            parsedOutput,
            toStageMetrics(providerMetrics),
            diagnosisValidation,
          );
        }
      } else {
        throw new StageOutputError(
          'SCRIPT_STAGE_NOT_SUPPORTED',
          'OE4 V2 protocol does not run an LLM script stage.',
          rawResponse,
          null,
          toStageMetrics(providerMetrics),
          [{
            code: 'SCRIPT_STAGE_NOT_SUPPORTED',
            path: '$',
            message: 'OE4 V2 protocol does not run an LLM script stage.',
          }],
        );
      }
      const completedAt = now();
      const metrics = toStageMetrics(providerMetrics) as LlmStageMetricsV1;
      const executionReceipt = buildReceipt({
        input: snapshot,
        prompt,
        provider: providerName,
        requestedModel: initialRun.modelId,
        observedModel,
        modelDigest: initialRun.environment.model.localDigest,
        inference: initialRun.environment.inference,
        startedAt,
        completedAt,
        rawResponse,
        validationStatus: 'valid',
        validationErrorCodes: [],
      });
      const result: LlmStageResultV1 = {
        contractId: 'aura.llm-stage-result.v1',
        stage,
        status: 'completed',
        attemptId,
        startedAt,
        completedAt,
        rawOutput: rawResponse,
        parsedOutput,
        validationErrors: [],
        metrics,
        error: null,
      };
      const completedEvent: AttemptEventV1 = {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${attemptId}:completed`,
        attemptId,
        sequence: run.attempts.length + 1,
        stage,
        type: 'completed',
        timestamp: completedAt,
        retryOfAttemptId,
        error: null,
      };
      run = await appendEvent(run, completedEvent, {
        [stage]: result,
        executionReceipt,
        status: stage === 'diagnosis' ? 'completed' : 'running',
      });
      return run;
    } catch (error: unknown) {
      const failure = classifyFailure(error, stage);
      const completedAt = now();
      const stageMetrics = error instanceof StageOutputError
        ? error.metrics
        : toStageMetrics(providerMetrics);
      const stageRawOutput = error instanceof StageOutputError ? error.rawOutput : rawResponse;
      const stageParsedOutput = error instanceof StageOutputError ? error.parsedOutput : parsedOutput;
      const stageValidation = error instanceof StageOutputError
        ? error.validationErrors
        : ([
            ...parseErrorMessages.map((message, index) => ({
              code: parseErrorCodes[index] ?? 'DIAGNOSIS_JSON_INVALID',
              path: '$',
              message,
            })),
            ...diagnosisValidation,
          ]);
      const receiptErrorCodes: string[] = stageValidation.map((entry) => entry.code);
      if (receiptErrorCodes.length === 0 && failure.error) {
        receiptErrorCodes.push(failure.error.code);
      }
      const result: LlmStageResultV1 = {
        contractId: 'aura.llm-stage-result.v1',
        stage,
        status: failure.status,
        attemptId,
        startedAt,
        completedAt,
        rawOutput: stageRawOutput,
        parsedOutput: stageParsedOutput,
        validationErrors: stageValidation,
        metrics: stageMetrics,
        error: failure.error,
      };
      const failedEvent: AttemptEventV1 = {
        contractId: 'aura.attempt-event.v1',
        eventId: `event:${attemptId}:${failure.type}`,
        attemptId,
        sequence: run.attempts.length + 1,
        stage,
        type: failure.type,
        timestamp: completedAt,
        retryOfAttemptId,
        error: failure.error,
      };
      const invalidReceipt = stage === 'diagnosis'
        ? buildReceipt({
            input: snapshot,
            prompt,
            provider: providerName || injectedProviderName || 'Ollama',
            requestedModel: initialRun.modelId,
            observedModel: observedModel,
            modelDigest: initialRun.environment.model.localDigest,
            inference: initialRun.environment.inference,
            startedAt,
            completedAt,
            rawResponse: stageRawOutput,
            validationStatus: 'invalid',
            validationErrorCodes: receiptErrorCodes,
          })
        : null;
      return appendEvent(run, failedEvent, {
        [stage]: result,
        executionReceipt: invalidReceipt,
        status: 'failed',
      });
    }
  };

  const runUnit = async (initialRun: ExperimentRunV1): Promise<ExperimentRunV1> => {
    const validation = validateExperimentRunV1(initialRun);
    if (!validation.valid) {
      throw new Error(`Invalid formal experiment run: ${validation.errors.join('; ')}`);
    }
    if (initialRun.status === 'completed') return initialRun;
    if (
      initialRun.protocolId !== FINAL_EVALUATION_PROTOCOL.id
      || initialRun.protocolVersion !== FINAL_EVALUATION_PROTOCOL.version
    ) {
      throw new Error('Only formal OE4 runs may enter experimentRunner.');
    }

    let run = initialRun;

    if (run.diagnosis?.status !== 'completed') {
      run = await ensureWarmup(run);
      run = await runStage(run, 'diagnosis', buildFormalDiagnosisPrompt(run));
      if (run.diagnosis?.status !== 'completed') return run;
    }

    return run;
  };

  const runUnits = async (
    inputRuns: readonly ExperimentRunV1[],
    options: RunUnitsOptions = {},
  ): Promise<RunUnitsOutcome> => {
    const runs = [...inputRuns];
    let completedUnits = 0;
    let paused = false;

    for (let index = 0; index < runs.length; index += 1) {
      if (options.shouldPause?.({ completedUnits, totalUnits: runs.length, nextRun: runs[index] })) {
        paused = true;
        break;
      }
      runs[index] = await runUnit(runs[index]);
      completedUnits += 1;
    }
    return { runs, completedUnits, paused };
  };

  return { runUnit, runUnits };
};
