import { describe, expect, it, vi } from 'vitest';
import {
  createExperimentExecutionBridge,
  ExperimentExecutionBridgeError,
} from '../services/benchmark/experimentExecutionBridge';
import { computeExactCsvFingerprint } from '../services/reauditService';
import type { ControlledExecutionResult } from '../services/executionService';
import type {
  ExperimentRunV1,
  HitlDecisionV1,
} from '../services/benchmark/experimentTypes';
import type {
  RemediationPlanV2,
  ScriptBuildContextV2,
  ScriptContractV2,
} from '../contracts/llm/types';
import { createPythonReceiptFixture } from './fixtures/pythonReceiptFixture';

const NOW = '2026-07-11T14:00:00.000Z';
const LATER = '2026-07-11T14:05:00.000Z';
const BEFORE_CSV = 'name,email\n Ana ,bad\nBob,bob@example.com\n';
const AFTER_CSV = 'name,email\nAna,ana@example.com\nBob,bob@example.com\n';
const BEFORE_HASH = computeExactCsvFingerprint(BEFORE_CSV);
const SCRIPT_HASH = 'a'.repeat(64);

const makeRun = (status: ExperimentRunV1['status'] = 'reviewed'): ExperimentRunV1 => ({
  runId: 'run:oe4:representative',
  status,
  updatedAt: NOW,
  environment: { dataset: { sha256: BEFORE_HASH } },
  diagnosis: { status: 'completed' },
  script: { status: 'completed' },
  automaticEvaluation: {
    script: {
      contractValid: true,
      syntaxValid: true,
      safe: true,
      missingActions: [],
      unsupportedActions: [],
    },
  },
  humanReview: { mean: 3 },
  hitl: null,
  execution: null,
} as unknown as ExperimentRunV1);

const approval = (status: HitlDecisionV1['status']): HitlDecisionV1 => ({
  contractId: 'aura.hitl-decision.v1',
  status,
  reviewerId: 'reviewer:oe4',
  decidedAt: LATER,
  reason: status === 'approved' ? 'Aprobado para ejecución externa.' : 'No autorizado.',
});

const controlledResult = (status: 'success' | 'blocked'): ControlledExecutionResult => ({
  execution: {
    runtime: 'colab_notebook',
    runtimeVersion: '1.0.0',
    status,
    startedAt: NOW,
    finishedAt: status === 'success' ? LATER : null,
    durationMs: status === 'success' ? 100 : null,
    logs: [],
    error: status === 'blocked' ? 'preflight blocked: fingerprint mismatch' : null,
    sandbox: {
      networkDisabled: true,
      filesystemRestricted: true,
      timeoutMs: 30_000,
      memoryLimitMb: null,
      allowedImports: ['pandas', 'numpy'],
    },
    notebook: status === 'success'
      ? { generated: true, json: '{"nbformat":4}' }
      : { generated: false },
  },
  preflightBlocked: status === 'blocked',
  sandboxBlocked: false,
  fixtureApplied: status === 'success',
  datasetOriginalIntact: true,
  gates: { preflight: {} as ControlledExecutionResult['gates']['preflight'], sandbox: null },
});

const contract = { scriptHash: SCRIPT_HASH } as ScriptContractV2;
const plan = {} as RemediationPlanV2;
const context = {} as ScriptBuildContextV2;

const makeStore = (initial: ExperimentRunV1) => {
  let current = structuredClone(initial);
  return {
    loadRun: vi.fn(async () => structuredClone(current)),
    saveRun: vi.fn(async (run: ExperimentRunV1) => { current = structuredClone(run); }),
    current: () => structuredClone(current),
  };
};

describe('OE4 experiment execution bridge', () => {
  it('refuses execution before an explicit human approval', async () => {
    const store = makeStore(makeRun());
    const execute = vi.fn(() => controlledResult('success'));
    const bridge = createExperimentExecutionBridge({ store, execute, now: () => LATER });

    await expect(bridge.prepareExternalExecution('run:oe4:representative', {
      contract, remediationPlan: plan, buildContext: context, beforeCsv: BEFORE_CSV,
    })).rejects.toBeInstanceOf(ExperimentExecutionBridgeError);
    expect(execute).not.toHaveBeenCalled();
    expect(store.saveRun).not.toHaveBeenCalled();
  });

  it('records HITL rejection and still refuses execution', async () => {
    const store = makeStore(makeRun());
    const execute = vi.fn(() => controlledResult('success'));
    const bridge = createExperimentExecutionBridge({ store, execute, now: () => LATER });

    await bridge.queueForHitl('run:oe4:representative');
    await bridge.recordHitlDecision('run:oe4:representative', approval('rejected'));

    expect(store.current().status).toBe('rejected');
    await expect(bridge.prepareExternalExecution('run:oe4:representative', {
      contract, remediationPlan: plan, buildContext: context, beforeCsv: BEFORE_CSV,
    })).rejects.toThrow('explicitly approved');
    expect(execute).not.toHaveBeenCalled();
  });

  it('persists a preflight or sandbox failure as blocked', async () => {
    const approved = { ...makeRun('approved'), hitl: approval('approved') };
    const store = makeStore(approved);
    const bridge = createExperimentExecutionBridge({
      store,
      execute: () => controlledResult('blocked'),
      now: () => LATER,
    });

    const prepared = await bridge.prepareExternalExecution('run:oe4:representative', {
      contract, remediationPlan: plan, buildContext: context, beforeCsv: BEFORE_CSV,
    });

    expect(prepared.run.status).toBe('blocked');
    expect(prepared.run.execution?.status).toBe('blocked');
    expect(prepared.run.execution?.executionEnvironment).toContain('preflight blocked');
    expect(store.current().status).toBe('blocked');
  });

  it('prepares an external notebook only after approval', async () => {
    const approved = { ...makeRun('approved'), hitl: approval('approved') };
    const store = makeStore(approved);
    const execute = vi.fn(() => controlledResult('success'));
    const bridge = createExperimentExecutionBridge({ store, execute, now: () => LATER });

    const prepared = await bridge.prepareExternalExecution('run:oe4:representative', {
      contract, remediationPlan: plan, buildContext: context, beforeCsv: BEFORE_CSV,
    });

    expect(prepared.notebookJson).toBe('{"nbformat":4}');
    expect(prepared.run.status).toBe('awaiting_external_output');
    expect(prepared.run.execution).toMatchObject({
      status: 'awaiting_external_output',
      approvedScriptHash: SCRIPT_HASH,
      beforeDatasetSha256: BEFORE_HASH,
      afterDatasetSha256: null,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('stores the imported fingerprint and complete before/after reaudit evidence', async () => {
    const awaiting = {
      ...makeRun('awaiting_external_output'),
      hitl: approval('approved'),
      execution: {
        contractId: 'aura.dynamic-execution-evidence.v1',
        status: 'awaiting_external_output',
        approvedScriptHash: SCRIPT_HASH,
        beforeDatasetSha256: BEFORE_HASH,
        afterDatasetSha256: null,
        executionEnvironment: 'colab_notebook:1.0.0',
        executedAt: null,
        pythonReceipt: null,
        reaudit: null,
      },
    } as ExperimentRunV1;
    const store = makeStore(awaiting);
    const bridge = createExperimentExecutionBridge({ store, now: () => LATER });

    const result = await bridge.importExternalOutput('run:oe4:representative', {
      beforeCsv: BEFORE_CSV,
      afterCsv: AFTER_CSV,
      beforeEvidenceRef: 'env:before',
      executionEnvironment: 'Google Colab controlado',
      executedAt: LATER,
      pythonReceipt: createPythonReceiptFixture({
        runId: awaiting.runId,
        approvedScriptHash: SCRIPT_HASH,
        scriptText: '',
        beforeDatasetSha256: BEFORE_HASH,
        afterDatasetSha256: computeExactCsvFingerprint(AFTER_CSV),
        completedAt: LATER,
      }),
    });

    expect(result.run.status).toBe('reaudited');
    expect(result.run.execution?.afterDatasetSha256).toBe(computeExactCsvFingerprint(AFTER_CSV));
    expect(result.run.execution?.reaudit).toMatchObject({
      beforeRows: 2,
      afterRows: 2,
      beforeColumns: 2,
      afterColumns: 2,
    });
    expect(result.healthDelta.beforeScore).toBe(result.reaudit.beforeReport.score);
    expect(result.run.environment.dataset.sha256).toBe(BEFORE_HASH);
    expect(store.current().environment.dataset.sha256).toBe(BEFORE_HASH);
  });
});
