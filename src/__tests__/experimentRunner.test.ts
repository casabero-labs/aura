import { describe, expect, it, vi } from 'vitest';
import type { AIProvider, ProviderTextResult } from '../types';
import type {
  EnvironmentSnapshotV1,
  ExperimentRunV1,
  InputContractSnapshotV1,
} from '../services/benchmark/experimentTypes';
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

const makeInput = (mode: OE4InputMode): InputContractSnapshotV1 => ({
  contractId: 'aura.input-snapshot.v1',
  mode,
  evidenceEnvelopeRef: `env:${HASH_A}`,
  includedSections: ['dataset_summary', 'dataset_schema'],
  systemInstruction: 'Return one aura.diagnosis.v2 JSON object.',
  userPayload: JSON.stringify({ mode, evidenceEnvelopeRef: `env:${HASH_A}` }),
  responseSchema: { type: 'object', required: ['contractId'] },
  promptVersion: '1.2.0',
  promptHash: HASH_A,
  inputHash: HASH_B,
  responseSchemaHash: HASH_A,
});

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
  for (const output of outputs) {
    if (output instanceof Error) generateText.mockRejectedValueOnce(output);
    else generateText.mockResolvedValueOnce(output);
  }
  const provider: Pick<AIProvider, 'generateText'> = { generateText };
  const store = makeStore();
  let tick = 0;
  const runner = createExperimentRunner({
    provider,
    store,
    now: () => new Date(Date.parse(NOW) + tick++ * 1000).toISOString(),
  });
  return { runner, store, generateText };
};

describe('OE4 symmetric and resumable runner — Task 5', () => {
  it('executes the same diagnosis then script sequence twice for every formal mode', async () => {
    for (const mode of OE4_INPUT_MODES) {
      const { runner, store, generateText } = makeRunner([
        result(diagnosisOutput),
        result(scriptOutput),
      ]);

      const completed = await runner.runUnit(makeRun(mode));

      expect(generateText).toHaveBeenCalledTimes(2);
      expect(generateText.mock.calls[0][0]).toContain('aura.diagnosis.v2');
      expect(generateText.mock.calls[1][0]).toContain('aura.script.v2');
      expect(store.appendAttemptEvent).toHaveBeenCalledTimes(4);
      expect(completed.status).toBe('completed');
      expect(completed.diagnosis?.status).toBe('completed');
      expect(completed.script?.status).toBe('completed');
      expect(validateExperimentRunV1(completed)).toEqual({ valid: true, errors: [] });
      expect(completed.attempts.map((event) => `${event.stage}:${event.type}`)).toEqual([
        'diagnosis:started',
        'diagnosis:completed',
        'script:started',
        'script:completed',
      ]);
    }
  });

  it('stops after a diagnosis failure and persists the failed attempt', async () => {
    const { runner, store, generateText } = makeRunner([new Error('Ollama unavailable')]);

    const failed = await runner.runUnit(makeRun('smart_sample'));

    expect(generateText).toHaveBeenCalledTimes(1);
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

    expect(generateText).toHaveBeenCalledTimes(1);
    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.error?.code).toBe('DIAGNOSIS_JSON_INVALID');
    expect(failed.diagnosis?.validationErrors[0].path).toBe('$');
    expect(failed.script).toBeNull();
  });

  it('retains a completed diagnosis when script generation fails', async () => {
    const { runner, generateText } = makeRunner([
      result(diagnosisOutput),
      new Error('script timeout'),
    ]);

    const failed = await runner.runUnit(makeRun('recommended'));

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(failed.status).toBe('failed');
    expect(failed.diagnosis?.status).toBe('completed');
    expect(failed.script?.status).toBe('timeout');
  });

  it('resumes a failed script without repeating the completed diagnosis', async () => {
    const first = makeRunner([result(diagnosisOutput), new Error('script timeout')]);
    const failed = await first.runner.runUnit(makeRun('recommended'));
    const previousAttempts = failed.attempts;
    const resumed = makeRunner([result(scriptOutput)]);

    const completed = await resumed.runner.runUnit(failed);

    expect(resumed.generateText).toHaveBeenCalledTimes(1);
    expect(resumed.generateText.mock.calls[0][0]).toContain('aura.script.v2');
    expect(completed.status).toBe('completed');
    expect(completed.diagnosis).toEqual(failed.diagnosis);
    expect(completed.attempts.slice(0, previousAttempts.length)).toEqual(previousAttempts);
    expect(completed.attempts[previousAttempts.length].retryOfAttemptId).toBe(
      failed.script?.attemptId,
    );
  });

  it('pauses safely between units and leaves later units untouched', async () => {
    const { runner, generateText } = makeRunner([result(diagnosisOutput), result(scriptOutput)]);
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
});
