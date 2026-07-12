import type { AIProvider, ProviderMetrics } from '../../types';
import { buildExecutionReceiptV1 } from '../../contracts/llm/executionReceiptV1';
import type { DiagnosisInputPackageV2 } from '../../contracts/llm/types';
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
    readonly metrics: LlmStageMetricsV1,
    readonly validationErrors: ExperimentValidationErrorV1[],
  ) {
    super(message);
    this.name = 'StageOutputError';
  }
}

const toStageMetrics = (metrics: ProviderMetrics): LlmStageMetricsV1 => {
  const outputTokens = metrics.tokensGenerated ?? null;
  const duration = metrics.evalDurationMs ?? metrics.latencyMs;
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

const parseJsonObject = (
  rawOutput: string,
  stage: Stage,
  metrics: LlmStageMetricsV1,
): unknown => {
  const trimmed = rawOutput.trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped);
  } catch {
    const validationErrors = [{
      code: `${stage.toUpperCase()}_JSON_INVALID`,
      path: '$',
      message: 'The provider output is not one valid JSON object.',
    }];
    throw new StageOutputError(
      `${stage.toUpperCase()}_JSON_INVALID`,
      validationErrors[0].message,
      rawOutput,
      null,
      metrics,
      validationErrors,
    );
  }

  const expectedContractId = stage === 'diagnosis' ? 'aura.diagnosis.v2' : 'aura.script.v2';
  if (
    parsed === null
    || Array.isArray(parsed)
    || typeof parsed !== 'object'
    || (parsed as Record<string, unknown>).contractId !== expectedContractId
  ) {
    const validationErrors = [{
      code: `${stage.toUpperCase()}_CONTRACT_INVALID`,
      path: '$.contractId',
      message: `Expected contractId ${expectedContractId}.`,
    }];
    throw new StageOutputError(
      `${stage.toUpperCase()}_CONTRACT_INVALID`,
      validationErrors[0].message,
      rawOutput,
      parsed,
      metrics,
      validationErrors,
    );
  }
  return parsed;
};

export const buildFormalDiagnosisPrompt = (run: ExperimentRunV1): string => [
  run.input.systemInstruction,
  run.input.userPayload,
].join('\n\n');

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

export const createExperimentRunner = ({
  provider,
  providerForRun,
  validateDiagnosis,
  store,
  now = () => new Date().toISOString(),
}: ExperimentRunnerDependencies): ExperimentRunner => {
  const warmedBlocks = new Set<string>();
  const providerFor = (run: ExperimentRunV1) => providerForRun?.(run) ?? provider;

  const ensureWarmup = async (run: ExperimentRunV1): Promise<ExperimentRunV1> => {
    const blockKey = `${run.modelId}::${run.repetition}`;
    if (warmedBlocks.has(blockKey)) return run;
    const persisted = store.listRuns
      ? (await store.listRuns(run.campaignId)).find((candidate) => (
          candidate.modelId === run.modelId
          && candidate.repetition === run.repetition
          && candidate.warmupReceipt?.contractId === 'aura.warmup-receipt.v1'
        ))
      : undefined;
    if (persisted) {
      warmedBlocks.add(blockKey);
      return run;
    }
    const effectiveProvider = providerFor(run);
    if (!effectiveProvider) throw new Error('No formal provider was configured for warm-up.');
    const prompt = 'Warm-up OE4 excluded from evaluation. Reply with exactly: READY';
    const warmup = await effectiveProvider.generateText(prompt);
    if (warmup.metrics.model !== run.modelId) {
      throw new Error(`WARMUP_MODEL_MISMATCH: requested ${run.modelId}, observed ${warmup.metrics.model}.`);
    }
    warmedBlocks.add(blockKey);
    const completedAt = now();
    const nextRun: ExperimentRunV1 = {
      ...run,
      updatedAt: completedAt,
      warmupReceipt: {
        contractId: 'aura.warmup-receipt.v1',
        blockId: blockKey,
        modelId: run.modelId,
        repetition: run.repetition,
        promptHash: sha256hex(prompt),
        responseHash: sha256hex(warmup.text),
        completedAt,
        metrics: toStageMetrics(warmup.metrics),
      },
    };
    await store.saveRun(nextRun);
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

    try {
      const effectiveProvider = providerFor(initialRun);
      if (!effectiveProvider) throw new Error('No formal provider was configured for this run.');
      const providerResult = await effectiveProvider.generateText(prompt);
      if (stage === 'diagnosis' && providerResult.metrics.model !== initialRun.modelId) {
        throw new Error(
          `MODEL_MISMATCH: requested ${initialRun.modelId}, observed ${providerResult.metrics.model}.`,
        );
      }
      const metrics = toStageMetrics(providerResult.metrics);
      const parsedOutput = parseJsonObject(providerResult.text, stage, metrics);
      if (stage === 'diagnosis') {
        const validationErrors = validateDiagnosis(parsedOutput, initialRun);
        if (validationErrors.length > 0) {
          throw new StageOutputError(
            'DIAGNOSIS_CONTRACT_INVALID',
            'The diagnosis failed the complete aura.diagnosis.v2 validation.',
            providerResult.text,
            parsedOutput,
            metrics,
            validationErrors,
          );
        }
      }
      const completedAt = now();
      const executionReceipt = stage === 'diagnosis' ? buildExecutionReceiptV1({
        input: {
          contractId: 'aura.input-snapshot.v2', contractVersion: '2.0.0',
          inputMode: initialRun.inputMode,
          includedSections: [...initialRun.input.includedSections],
          systemInstruction: initialRun.input.systemInstruction,
          userPayload: initialRun.input.userPayload,
          responseSchema: initialRun.input.responseSchema,
          evidenceEnvelopeRef: initialRun.input.evidenceEnvelopeRef,
          promptVersion: initialRun.input.promptVersion,
          promptHash: initialRun.input.promptHash,
          inputHash: initialRun.input.inputHash,
          responseSchemaHash: initialRun.input.responseSchemaHash,
        } satisfies DiagnosisInputPackageV2,
        requestedInputMode: initialRun.inputMode,
        exactPrompt: prompt,
        provider: providerResult.metrics.provider,
        requestedModel: initialRun.modelId,
        observedModel: providerResult.metrics.model,
        modelDigest: initialRun.environment.model.localDigest,
        inference: initialRun.environment.inference,
        startedAt,
        completedAt,
        rawResponse: providerResult.text,
        validationStatus: 'valid',
      }) : null;
      const result: LlmStageResultV1 = {
        contractId: 'aura.llm-stage-result.v1',
        stage,
        status: 'completed',
        attemptId,
        startedAt,
        completedAt,
        rawOutput: providerResult.text,
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
        ...(stage === 'diagnosis' ? { executionReceipt } : {}),
        status: stage === 'diagnosis' ? 'completed' : 'running',
      });
      return run;
    } catch (error: unknown) {
      const failure = classifyFailure(error, stage);
      const completedAt = now();
      const result: LlmStageResultV1 = {
        contractId: 'aura.llm-stage-result.v1',
        stage,
        status: failure.status,
        attemptId,
        startedAt,
        completedAt,
        rawOutput: error instanceof StageOutputError ? error.rawOutput : '',
        parsedOutput: error instanceof StageOutputError ? error.parsedOutput : null,
        validationErrors: error instanceof StageOutputError ? error.validationErrors : [],
        metrics: error instanceof StageOutputError ? error.metrics : null,
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
      return appendEvent(run, failedEvent, { [stage]: result, status: 'failed' });
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

    // The first status transition is persisted together with the started event.
    // This avoids a crash window with a running run but no corresponding event.
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
