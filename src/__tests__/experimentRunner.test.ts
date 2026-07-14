import { describe, expect, it, vi } from 'vitest';
import type { AIProvider, ProviderTextResult } from '../types';
import type {
  EnvironmentSnapshotV1,
  ExperimentRunV1,
} from '../services/benchmark/experimentTypes';
import type { DiagnosisInputPackageV2 } from '../contracts/llm/types';
import {
  createExperimentRunner,
  type ExperimentRunnerStore,
} from '../services/benchmark/experimentRunner';
import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODES,
  type OE4InputMode,
  type OE4ModelId,
} from '../services/benchmark/finalEvaluationProtocol';
import { validateExperimentRunV1 } from '../services/benchmark/experimentGuards';
import { sha256hex } from '../contracts/llm/hash';
import { exactDiagnosisPromptV2 } from '../contracts/llm/diagnosisInputPackageV2';
import { buildExperimentSchedule } from '../services/benchmark/experimentSchedule';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = '2026-07-10T20:00:00.000Z';

const makeEnvironment = (modelId: OE4ModelId): EnvironmentSnapshotV1 => ({
  contractId: 'aura.environment-snapshot.v1',
  capturedAt: NOW,
  appCommit: '38a639659e4ad22436241e82bab8cc2699b1eb3c',
  dataset: {
    id: FINAL_EVALUATION_PROTOCOL.dataset.id,
    sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    schemaSha256: FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256,
    groundTruthSha256: FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256,
  },
  hardware: { machine: 'MacBook Air M4', cpu: 'Apple M4 10-core', memoryBytes: 16 * 1024 ** 3 },
  runtime: { provider: 'ollama', ollamaVersion: '0.9.0', clientVersion: '0.9.0' },
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
  const responseSchema = { type: 'object', required: ['contractId'] };
  return {
    contractId: 'aura.input-snapshot.v2',
    contractVersion: '2.0.0',
    inputMode: mode,
    evidenceEnvelopeRef: `env:${HASH_A}`,
    includedSections: ['dataset_summary', 'dataset_schema'],
    systemInstruction,
    userPayload,
    responseSchema,
    promptVersion: '1.2.0',
    promptHash: sha256hex(exactDiagnosisPromptV2({ systemInstruction, userPayload, responseSchema })),
    responseSchemaHash: HASH_A,
    inputHash: HASH_B,
  };
};

const makeRun = (mode: OE4InputMode, sequence = 1): ExperimentRunV1 => {
  const modelId = FINAL_EVALUATION_PROTOCOL.models[0];
  return {
    contractId: 'aura.experiment-run.v1',
    contractVersion: '1.0.0',
    campaignId: 'campaign:oe4-final-v1',
    runId: `run:${sequence}:${mode}`,
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    modelId,
    inputMode: mode,
    repetition: 1,
    sequence,
    status: 'planned',
    createdAt: NOW,
    updatedAt: NOW,
    environment: makeEnvironment(modelId),
    input: makeInput(mode),
    diagnosis: null,
    script: null,
    automaticEvaluation: null,
    humanReview: null,
    hitl: null,
    execution: null,
    attempts: [],
  };
};

const result = (text: string): ProviderTextResult => ({
  text,
  metrics: {
    provider: 'Ollama',
    model: FINAL_EVALUATION_PROTOCOL.models[0],
    latencyMs: 1000,
    firstTokenMs: 100,
    tokensGenerated: 200,
    promptTokens: 300,
    totalDurationMs: 1000,
    loadDurationMs: 50,
    promptEvalDurationMs: 150,
    evalDurationMs: 800,
    reasoningTokens: null,
    isLocal: true,
    timestamp: NOW,
  },
});

const truncatedResult = (text: string): ProviderTextResult => ({
  ...result(text),
  metrics: {
    ...result(text).metrics,
    tokensGenerated: 4096,
    finishReason: 'length',
  },
});

const diagnosisOutput = JSON.stringify({
  contractId: 'aura.diagnosis.v2',
  evidenceEnvelopeRef: `env:${HASH_A}`,
  findings: [],
});
const scriptOutput = JSON.stringify({
  contractId: 'aura.script.v2',
  contractVersion: '2.0.0',
  cleanDatasetFn: 'clean_dataset',
  scriptText: 'def clean_dataset(df):\n    return df.copy()',
});

const makeStore = (): ExperimentRunnerStore => ({
  saveRun: vi.fn<ExperimentRunnerStore['saveRun']>().mockResolvedValue(undefined),
  appendAttemptEvent: vi.fn<ExperimentRunnerStore['appendAttemptEvent']>().mockResolvedValue(undefined),
});

const makeRunner = (outputs: Array<ProviderTextResult | Error>) => {
  const generateText = vi.fn<AIProvider['generateText']>();
  generateText.mockResolvedValueOnce(result('READY'));
  for (const output of outputs) {
    if (output instanceof Error) generateText.mockRejectedValueOnce(output);
    else generateText.mockResolvedValueOnce(output);
  }
  const provider: Pick<AIProvider, 'generateText'> = { generateText };
  const store = makeStore();
  let tick = 0;
  const runner = createExperimentRunner({
    provider,
    validateDiagnosis: (parsed) => (
      typeof parsed === 'object' && parsed !== null
        ? []
        : [{ code: 'INVALID', path: '$', message: 'invalid diagnosis' }]
    ),
    store,
    now: () => new Date(Date.parse(NOW) + tick++ * 1000).toISOString(),
  });
  return { runner, store, generateText };
};

describe('OE4 diagnosis-only and resumable runner — protocol V2', () => {
  it('executes exactly one measured diagnosis call for every formal mode', async () => {
    for (const mode of OE4_INPUT_MODES) {
      const { runner, store, generateText } = makeRunner([result(diagnosisOutput)]);

      const completed = await runner.runUnit(makeRun(mode));

      expect(generateText).toHaveBeenCalledTimes(2);
      expect(generateText.mock.calls[0][0]).toContain('Warm-up OE4');
      expect(store.saveRun).toHaveBeenCalledTimes(1);
      expect(generateText.mock.calls[1][0]).toContain('aura.diagnosis.v2');
      expect(store.appendAttemptEvent).toHaveBeenCalledTimes(2);
      expect(completed.status).toBe('completed');
      expect(completed.diagnosis?.status).toBe('completed');
      expect(completed.warmupReceipt?.excludedFromEvaluation).toBe(true);
      expect(completed.executionReceipt).toEqual(expect.objectContaining({
        requestedInputMode: mode,
        effectiveInputMode: mode,
        requestedModel: completed.modelId,
        observedModel: completed.modelId,
        inputHash: completed.input.inputHash,
        validationStatus: 'valid',
      }));
      expect(completed.script).toBeNull();
      expect(validateExperimentRunV1(completed)).toEqual({ valid: true, errors: [] });
      const tampered = structuredClone(completed);
      tampered.executionReceipt!.requestedModel = 'tampered-model';
      expect(validateExperimentRunV1(tampered).valid).toBe(false);
      expect(completed.attempts.map((event) => `${event.stage}:${event.type}`)).toEqual([
        'diagnosis:started',
        'diagnosis:completed',
      ]);
    }
  });

  it('stops after a diagnosis failure and persists the failed attempt', async () => {
    const { runner, store, generateText } = makeRunner([new Error('Ollama unavailable')]);

    const failed = await runner.runUnit(makeRun('smart_sample'));

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(store.appendAttemptEvent).toHaveBeenCalledTimes(2);
    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.status).toBe('failed');
    expect(failed.script).toBeNull();
    expect(failed.attempts.at(-1)?.type).toBe('failed');
    expect(validateExperimentRunV1(failed)).toEqual({ valid: true, errors: [] });
  });

  it('treats malformed diagnosis output as contract failure and never calls script', async () => {
    const { runner, generateText } = makeRunner([result('not-json')]);

    const failed = await runner.runUnit(makeRun('prompt_libre'));

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.error?.code).toBe('DIAGNOSIS_JSON_INVALID');
    expect(failed.diagnosis?.validationErrors[0].path).toBe('$');
    expect(failed.script).toBeNull();
  });

  it('records provider-reported output truncation before attempting JSON parsing', async () => {
    const rawResponse = '{"contractId":"aura.diagnosis.v2","issues":[';
    const { runner } = makeRunner([truncatedResult(rawResponse)]);

    const failed = await runner.runUnit(makeRun('smart_sample'));

    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.error?.code).toBe('DIAGNOSIS_RESPONSE_TRUNCATED');
    expect(failed.diagnosis?.rawOutput).toBe(rawResponse);
    expect(failed.diagnosis?.validationErrors).toEqual([
      expect.objectContaining({ code: 'DIAGNOSIS_RESPONSE_TRUNCATED', path: '$' }),
    ]);
    expect(failed.executionReceipt?.validationErrorCodes).toEqual(['DIAGNOSIS_RESPONSE_TRUNCATED']);
  });

  it('pauses safely between units and leaves later units untouched', async () => {
    const { runner, generateText } = makeRunner([result(diagnosisOutput)]);
    const first = makeRun('prompt_libre', 1);
    const second = makeRun('smart_sample', 2);

    const outcome = await runner.runUnits([first, second], {
      shouldPause: ({ completedUnits }) => completedUnits === 1,
    });

    expect(outcome.paused).toBe(true);
    expect(outcome.runs[0].status).toBe('completed');
    expect(outcome.runs[1]).toEqual(second);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('fails closed when complete diagnosis validation reports an error', async () => {
    const generateText = vi.fn<AIProvider['generateText']>().mockResolvedValue(result(diagnosisOutput));
    const runner = createExperimentRunner({
      provider: { generateText },
      store: makeStore(),
      validateDiagnosis: () => [{ code: 'DIAGNOSIS_COVERAGE_MISMATCH', path: '$.findings', message: 'missing findings' }],
      now: () => NOW,
    });

    const failed = await runner.runUnit(makeRun('recommended'));

    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.error?.code).toBe('DIAGNOSIS_CONTRACT_INVALID');
    expect(failed.diagnosis?.validationErrors[0].code).toBe('DIAGNOSIS_COVERAGE_MISMATCH');
  });

  it('executes exactly 15 excluded warm-ups plus 45 measured diagnoses', async () => {
    const calls: string[] = [];
    const runs = buildExperimentSchedule().units.map((unit) => ({
      ...makeRun(unit.inputMode, unit.sequence),
      runId: unit.runId,
      modelId: unit.modelId,
      repetition: unit.repetition,
      environment: makeEnvironment(unit.modelId),
    }));
    const runner = createExperimentRunner({
      providerForRun: (run) => ({
        generateText: async (prompt) => {
          calls.push(prompt);
          return {
            ...result(prompt.startsWith('Warm-up OE4') ? 'READY' : diagnosisOutput),
            metrics: { ...result('').metrics, model: run.modelId },
          };
        },
      }),
      store: makeStore(),
      validateDiagnosis: () => [],
      now: () => NOW,
    });

    const outcome = await runner.runUnits(runs);

    expect(outcome.runs.every((run) => run.status === 'completed')).toBe(true);
    expect(calls.filter((prompt) => prompt.startsWith('Warm-up OE4'))).toHaveLength(15);
    expect(calls.filter((prompt) => prompt.includes('aura.diagnosis.v2'))).toHaveLength(45);
    expect(calls).toHaveLength(60);
    expect(outcome.runs.every((run) => validateExperimentRunV1(run).valid)).toBe(true);
    expect(new Set(outcome.runs.map((run) => run.warmupReceipt?.blockId))).toHaveLength(15);
    expect(outcome.runs.every((run) => run.warmupReceipt?.excludedFromEvaluation === true)).toBe(true);
  });

  it('does not repeat a persisted block warm-up after the runner is recreated', async () => {
    const first = makeRun('prompt_libre', 1);
    const second = makeRun('smart_sample', 2);
    let stored = [first, second];
    const store: ExperimentRunnerStore & { listRuns: (campaignId: string) => Promise<ExperimentRunV1[]> } = {
      listRuns: async () => structuredClone(stored),
      saveRun: async (run) => { stored = stored.map((item) => item.runId === run.runId ? structuredClone(run) : item); },
      appendAttemptEvent: async (runId, _event, nextRun) => {
        stored = stored.map((item) => item.runId === runId ? structuredClone(nextRun) : item);
      },
    };
    const prompts: string[] = [];
    const dependencies = {
      providerForRun: (run: ExperimentRunV1) => ({
        generateText: async (prompt: string) => {
          prompts.push(prompt);
          return { ...result(prompt.startsWith('Warm-up OE4') ? 'READY' : diagnosisOutput), metrics: { ...result('').metrics, model: run.modelId } };
        },
      }),
      store,
      validateDiagnosis: () => [],
      now: () => NOW,
    };

    await createExperimentRunner(dependencies).runUnit(first);
    await createExperimentRunner(dependencies).runUnit(second);

    expect(prompts.filter((prompt) => prompt.startsWith('Warm-up OE4'))).toHaveLength(1);
    expect(prompts.filter((prompt) => prompt.includes('aura.diagnosis.v2'))).toHaveLength(2);
  });
});
