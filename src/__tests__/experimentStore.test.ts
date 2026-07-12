import { beforeEach, describe, expect, it } from 'vitest';
import type { AIProvider, ProviderTextResult } from '../types';
import { buildExperimentSchedule } from '../services/benchmark/experimentSchedule';
import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from '../services/benchmark/finalEvaluationProtocol';
import type {
  AttemptEventV1,
  EnvironmentSnapshotV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
  InputContractSnapshotV1,
  LlmStageErrorV1,
  LlmStageResultV1,
} from '../services/benchmark/experimentTypes';
import { sha256hex } from '../contracts/llm/hash';
import type { ExperimentStore } from '../services/benchmark/experimentStore';
import {
  createInMemoryExperimentState,
  createInMemoryExperimentStore,
} from '../services/benchmark/inMemoryExperimentStore';
import { createIndexedDbExperimentStore } from '../services/benchmark/indexedDbExperimentStore';
import { createExperimentRunner } from '../services/benchmark/experimentRunner';
import { createTestIndexedDbFactory } from './helpers/testIndexedDb';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = '2026-07-10T20:00:00.000Z';
const LATER = '2026-07-10T20:01:00.000Z';
const LATEST = '2026-07-10T20:02:00.000Z';

const makeEnvironment = (modelId: OE4ModelId): EnvironmentSnapshotV1 => ({
  contractId: 'aura.environment-snapshot.v1',
  capturedAt: NOW,
  appCommit: '62d16c8c917d954457702888f50fc87b0b13d5ab',
  dataset: {
    id: FINAL_EVALUATION_PROTOCOL.dataset.id,
    sha256: FINAL_EVALUATION_PROTOCOL.dataset.sha256,
    schemaSha256: FINAL_EVALUATION_PROTOCOL.dataset.schemaSha256,
    groundTruthSha256: FINAL_EVALUATION_PROTOCOL.dataset.groundTruthSha256,
  },
  hardware: { machine: 'MacBook Air M4', cpu: 'Apple M4 10-core', memoryBytes: 16 * 1024 ** 3 },
  runtime: { provider: 'ollama', ollamaVersion: '0.20.3', clientVersion: '0.31.1' },
  model: {
    id: modelId,
    quantization: 'UD-Q4_K_XL',
    expectedGgufSha256: HASH_A,
    localDigest: HASH_B,
  },
  inference: { ...FINAL_EVALUATION_PROTOCOL.inference },
});

const makeInput = (mode: OE4InputMode): InputContractSnapshotV1 => {
  const systemInstruction = 'Return one aura.diagnosis.v2 JSON object.';
  const userPayload = JSON.stringify({ mode, evidenceEnvelopeRef: `env:${HASH_A}` });
  return ({
  contractId: 'aura.input-snapshot.v1',
  mode,
  evidenceEnvelopeRef: `env:${HASH_A}`,
  includedSections: ['dataset_summary', 'dataset_schema'],
  systemInstruction,
  userPayload,
  responseSchema: { type: 'object', required: ['contractId'] },
  promptVersion: '1.2.0',
  promptHash: sha256hex(`${systemInstruction}\n\n${userPayload}`),
  inputHash: HASH_B,
  responseSchemaHash: HASH_A,
  });
};

const makeCampaignFixture = (): {
  campaign: ExperimentCampaignV1;
  runs: ExperimentRunV1[];
} => {
  const schedule = buildExperimentSchedule();
  const campaignId = 'campaign:oe4-store-contract';
  const runs = schedule.units.map((unit): ExperimentRunV1 => ({
    contractId: 'aura.experiment-run.v1',
    contractVersion: '1.0.0',
    campaignId,
    runId: unit.runId,
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    modelId: unit.modelId,
    inputMode: unit.inputMode,
    repetition: unit.repetition,
    sequence: unit.sequence,
    status: 'planned',
    createdAt: NOW,
    updatedAt: NOW,
    environment: makeEnvironment(unit.modelId),
    input: makeInput(unit.inputMode),
    diagnosis: null,
    script: null,
    automaticEvaluation: null,
    humanReview: null,
    hitl: null,
    execution: null,
    attempts: [],
  }));
  return {
    campaign: {
      contractId: 'aura.experiment-campaign.v1',
      contractVersion: '1.0.0',
      campaignId,
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
      runIds: runs.map((run) => run.runId),
    },
    runs,
  };
};

const makeEvent = (
  run: ExperimentRunV1,
  overrides: Partial<AttemptEventV1> = {},
): AttemptEventV1 => ({
  contractId: 'aura.attempt-event.v1',
  eventId: `event:${run.runId}:diagnosis:1:started`,
  attemptId: `attempt:${run.runId}:diagnosis:1`,
  sequence: run.attempts.length + 1,
  stage: 'diagnosis',
  type: 'started',
  timestamp: LATER,
  retryOfAttemptId: null,
  error: null,
  ...overrides,
});

const appendSnapshot = (
  run: ExperimentRunV1,
  event: AttemptEventV1,
  changes: Partial<ExperimentRunV1> = {},
): ExperimentRunV1 => ({
  ...run,
  ...changes,
  updatedAt: event.timestamp,
  attempts: [...run.attempts, event],
});

interface StoreHarness {
  open(): ExperimentStore;
}

type HarnessFactory = () => StoreHarness;

const inMemoryHarness: HarnessFactory = () => {
  const state = createInMemoryExperimentState();
  return { open: () => createInMemoryExperimentStore({ state }) };
};

let indexedDatabaseSequence = 0;
const indexedDbHarness: HarnessFactory = () => {
  indexedDatabaseSequence += 1;
  const factory = createTestIndexedDbFactory();
  const databaseName = `aura-experiment-store-test-${indexedDatabaseSequence}`;
  return {
    open: () => createIndexedDbExperimentStore({ indexedDB: factory, databaseName }),
  };
};

const runStoreContract = (name: string, makeHarness: HarnessFactory): void => {
  describe(`${name} experiment store`, () => {
    let harness: StoreHarness;
    let store: ExperimentStore;

    beforeEach(() => {
      harness = makeHarness();
      store = harness.open();
    });

    it('creates, lists and loads one complete campaign with its 45 runs', async () => {
      const fixture = makeCampaignFixture();

      await store.createCampaign(fixture.campaign, fixture.runs);

      expect(await store.listCampaigns()).toEqual([fixture.campaign]);
      expect(await store.loadCampaign(fixture.campaign.campaignId)).toEqual(fixture.campaign);
      const loadedRuns = await store.listRuns(fixture.campaign.campaignId);
      expect(loadedRuns).toHaveLength(45);
      expect(loadedRuns.map((run) => run.sequence)).toEqual(
        Array.from({ length: 45 }, (_, index) => index + 1),
      );
    });

    it('appends an attempt event and its run snapshot as one operation', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const initial = fixture.runs[0];
      const started = makeEvent(initial);
      const next = appendSnapshot(initial, started, { status: 'running' });

      await store.appendAttemptEvent(initial.runId, started, next);

      expect(await store.listAttemptEvents(initial.runId)).toEqual([started]);
      expect(await store.loadRun(initial.runId)).toEqual(next);
    });

    it('leaves both event log and run unchanged when an append is invalid', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const initial = fixture.runs[0];
      const started = makeEvent(initial);

      await expect(
        store.appendAttemptEvent(initial.runId, started, { ...initial, status: 'running' }),
      ).rejects.toThrow(/EVENT_SNAPSHOT_MISMATCH/);

      expect(await store.listAttemptEvents(initial.runId)).toEqual([]);
      expect(await store.loadRun(initial.runId)).toEqual(initial);
    });

    it('loads the same campaign and progress after reconstructing the store', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const started = makeEvent(fixture.runs[0]);
      const next = appendSnapshot(fixture.runs[0], started, { status: 'running' });
      await store.appendAttemptEvent(next.runId, started, next);
      store.close();

      store = harness.open();

      expect(await store.loadCampaign(fixture.campaign.campaignId)).toEqual(fixture.campaign);
      expect(await store.loadRun(next.runId)).toEqual(next);
      expect(await store.listAttemptEvents(next.runId)).toEqual([started]);
    });

    it('rejects a duplicate event ID without changing another run', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const first = fixture.runs[0];
      const firstEvent = makeEvent(first);
      await store.appendAttemptEvent(
        first.runId,
        firstEvent,
        appendSnapshot(first, firstEvent, { status: 'running' }),
      );
      const second = fixture.runs[1];
      const duplicate = makeEvent(second, { eventId: firstEvent.eventId });
      const secondNext = appendSnapshot(second, duplicate, { status: 'running' });

      await expect(
        store.appendAttemptEvent(second.runId, duplicate, secondNext),
      ).rejects.toThrow(/EVENT_DUPLICATE/);

      expect(await store.loadRun(second.runId)).toEqual(second);
      expect(await store.listAttemptEvents(second.runId)).toEqual([]);
    });

    it('preserves a failed first attempt when a linked retry starts', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const initial = fixture.runs[0];
      const started = makeEvent(initial);
      const running = appendSnapshot(initial, started, { status: 'running' });
      await store.appendAttemptEvent(initial.runId, started, running);

      const stageError: LlmStageErrorV1 = {
        code: 'DIAGNOSIS_PROVIDER_ERROR',
        message: 'Ollama unavailable',
        retryable: true,
      };
      const failedEvent = makeEvent(running, {
        eventId: `event:${initial.runId}:diagnosis:1:failed`,
        type: 'failed',
        timestamp: LATEST,
        error: stageError,
      });
      const failedStage: LlmStageResultV1 = {
        contractId: 'aura.llm-stage-result.v1',
        stage: 'diagnosis',
        status: 'failed',
        attemptId: started.attemptId,
        startedAt: started.timestamp,
        completedAt: failedEvent.timestamp,
        rawOutput: '',
        parsedOutput: null,
        validationErrors: [],
        metrics: null,
        error: stageError,
      };
      const failed = appendSnapshot(running, failedEvent, {
        status: 'failed',
        diagnosis: failedStage,
      });
      await store.appendAttemptEvent(initial.runId, failedEvent, failed);

      const retry = makeEvent(failed, {
        eventId: `event:${initial.runId}:diagnosis:2:started`,
        attemptId: `attempt:${initial.runId}:diagnosis:2`,
        timestamp: new Date(Date.parse(LATEST) + 1000).toISOString(),
        retryOfAttemptId: started.attemptId,
      });
      const retrying = appendSnapshot(failed, retry, { status: 'running' });
      await store.appendAttemptEvent(initial.runId, retry, retrying);

      const loaded = await store.loadRun(initial.runId);
      expect(loaded?.attempts).toEqual([started, failedEvent, retry]);
      expect(loaded?.diagnosis).toEqual(failedStage);
      expect((await store.listAttemptEvents(initial.runId)).map((item) => item.eventId)).toEqual([
        started.eventId,
        failedEvent.eventId,
        retry.eventId,
      ]);
    });

    it('returns the next planned unit without modifying earlier units', async () => {
      const fixture = makeCampaignFixture();
      await store.createCampaign(fixture.campaign, fixture.runs);
      const first = fixture.runs[0];
      const started = makeEvent(first);
      const running = appendSnapshot(first, started, { status: 'running' });
      await store.appendAttemptEvent(first.runId, started, running);

      const next = await store.getNextPlannedRun(fixture.campaign.campaignId);

      expect(next?.sequence).toBe(2);
      expect(await store.loadRun(first.runId)).toEqual(running);
      expect(await store.loadRun(fixture.runs[1].runId)).toEqual(fixture.runs[1]);
    });
  });
};

describe('OE4 experiment store contract — Task 6', () => {
  runStoreContract('in-memory', inMemoryHarness);
  runStoreContract('IndexedDB', indexedDbHarness);

  it('persists the complete runner flow through the real store contract', async () => {
    const fixture = makeCampaignFixture();
    const store = createInMemoryExperimentStore();
    await store.createCampaign(fixture.campaign, fixture.runs);
    const outputs = [
      'READY',
      JSON.stringify({
        contractId: 'aura.diagnosis.v2',
        evidenceEnvelopeRef: `env:${HASH_A}`,
        findings: [],
      }),
    ];
    const provider: Pick<AIProvider, 'generateText'> = {
      generateText: async (): Promise<ProviderTextResult> => ({
        text: outputs.shift() ?? '',
        metrics: {
          provider: 'Ollama',
          model: fixture.runs[0].modelId,
          latencyMs: 1000,
          firstTokenMs: 100,
          tokensGenerated: 200,
          isLocal: true,
          timestamp: NOW,
        },
      }),
    };
    let tick = 0;
    const runner = createExperimentRunner({
      provider,
      store,
      validateDiagnosis: () => [],
      now: () => new Date(Date.parse(NOW) + ++tick * 1000).toISOString(),
    });

    const completed = await runner.runUnit(fixture.runs[0]);

    expect(completed.status).toBe('completed');
    expect(await store.loadRun(completed.runId)).toEqual(completed);
    expect(await store.listAttemptEvents(completed.runId)).toHaveLength(2);
    expect((await store.getNextPlannedRun(fixture.campaign.campaignId))?.sequence).toBe(2);
  });
});
