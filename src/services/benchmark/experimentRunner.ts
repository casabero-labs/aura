import type { AIProvider, ProviderMetrics } from '../../types';
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

type Stage = LlmStageResultV1['stage'];
type StageTerminalType = 'completed' | 'failed' | 'timeout';

export interface ExperimentRunnerStore {
  /** Persists a derived run snapshot. Task 6 supplies durable adapters. */
  saveRun(run: ExperimentRunV1): Promise<void>;
  /** Atomically appends one immutable event and its derived run snapshot. */
  appendAttemptEvent(
    runId: string,
    event: AttemptEventV1,
    nextRun: ExperimentRunV1,
  ): Promise<void>;
}

export interface ExperimentRunnerDependencies {
  provider: Pick<AIProvider, 'generateText'>;
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

export const buildFormalScriptPrompt = (
  run: ExperimentRunV1,
  diagnosis: unknown,
): string => JSON.stringify({
  systemInstruction: [
    'Generate the remediation proposal under the aura.script.v2 response contract.',
    'Return exactly one JSON object and no Markdown.',
    'Use only the diagnosis and evidence references supplied here.',
    'Do not invent columns, findings, actions or evidence.',
  ].join(' '),
  responseContract: 'aura.script.v2',
  evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
  diagnosis,
});

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
  store,
  now = () => new Date().toISOString(),
}: ExperimentRunnerDependencies): ExperimentRunner => {
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
      const providerResult = await provider.generateText(prompt);
      const metrics = toStageMetrics(providerResult.metrics);
      const parsedOutput = parseJsonObject(providerResult.text, stage, metrics);
      const completedAt = now();
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
        status: stage === 'script' ? 'completed' : 'running',
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

    let run: ExperimentRunV1 = {
      ...initialRun,
      status: 'running',
      updatedAt: now(),
    };
    await store.saveRun(run);

    if (run.diagnosis?.status !== 'completed') {
      run = await runStage(run, 'diagnosis', buildFormalDiagnosisPrompt(run));
      if (run.diagnosis?.status !== 'completed') return run;
    }

    if (run.script?.status !== 'completed') {
      run = await runStage(
        run,
        'script',
        buildFormalScriptPrompt(run, run.diagnosis.parsedOutput),
      );
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
