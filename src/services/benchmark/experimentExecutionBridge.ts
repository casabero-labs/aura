import type {
  RemediationPlanV2,
  ScriptBuildContextV2,
  ScriptContractV2,
} from '../../contracts/llm/types';
import {
  executeControlledRun,
  RUNTIME_VERSION,
  type ControlledExecutionResult,
  type ExecutionOptions,
} from '../executionService';
import { calculateHealthDelta } from '../improvementService';
import {
  buildReauditEvidence,
  computeExactCsvFingerprint,
  runReaudit,
  type ReauditResult,
} from '../reauditService';
import type { HealthDelta } from '../../types';
import type { ExperimentStore } from './experimentStore';
import type {
  DynamicExecutionEvidenceV1,
  ExperimentRunV1,
  HitlDecisionV1,
} from './experimentTypes';

export type ExperimentExecutionBridgeErrorCode =
  | 'RUN_NOT_FOUND'
  | 'RUN_NOT_REVIEWED'
  | 'RUN_NOT_AWAITING_HITL'
  | 'RUN_NOT_APPROVED'
  | 'RUN_NOT_AWAITING_OUTPUT'
  | 'SOURCE_FINGERPRINT_MISMATCH';

export class ExperimentExecutionBridgeError extends Error {
  constructor(readonly code: ExperimentExecutionBridgeErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ExperimentExecutionBridgeError';
  }
}

type BridgeStore = Pick<ExperimentStore, 'loadRun' | 'saveRun'>;

export interface ExperimentExecutionBridgeDependencies {
  store: BridgeStore;
  now?: () => string;
  execute?: typeof executeControlledRun;
  reaudit?: typeof runReaudit;
  calculateDelta?: typeof calculateHealthDelta;
}

export interface PrepareExternalExecutionInput {
  contract: ScriptContractV2;
  remediationPlan: RemediationPlanV2;
  buildContext: ScriptBuildContextV2;
  beforeCsv: string;
  options?: Omit<ExecutionOptions, 'fixtureCsv'>;
}

export interface PreparedExternalExecution {
  run: ExperimentRunV1;
  controlled: ControlledExecutionResult | null;
  notebookJson: string | null;
}

export interface ImportExternalOutputInput {
  beforeCsv: string;
  afterCsv: string;
  beforeEvidenceRef: string;
  executionEnvironment: string;
  executedAt?: string;
  delimiter?: string;
}

export interface ImportedExternalOutput {
  run: ExperimentRunV1;
  reaudit: ReauditResult;
  healthDelta: HealthDelta;
}

export interface ExperimentExecutionBridge {
  queueForHitl(runId: string): Promise<ExperimentRunV1>;
  recordHitlDecision(runId: string, decision: HitlDecisionV1): Promise<ExperimentRunV1>;
  prepareExternalExecution(runId: string, input: PrepareExternalExecutionInput): Promise<PreparedExternalExecution>;
  importExternalOutput(runId: string, input: ImportExternalOutputInput): Promise<ImportedExternalOutput>;
}

const loadRequiredRun = async (store: BridgeStore, runId: string): Promise<ExperimentRunV1> => {
  const run = await store.loadRun(runId);
  if (run === null) throw new ExperimentExecutionBridgeError('RUN_NOT_FOUND', `Run ${runId} does not exist.`);
  return run;
};

export const assertHumanApproved = (run: ExperimentRunV1): void => {
  const script = run.automaticEvaluation?.script;
  const evaluationEligible = script?.contractValid === true
    && script.syntaxValid
    && script.safe
    && script.missingActions.length === 0
    && script.unsupportedActions.length === 0
    && run.diagnosis?.status === 'completed'
    && run.script?.status === 'completed';
  if (
    run.status !== 'approved'
    || run.hitl?.status !== 'approved'
    || run.humanReview === null
    || !evaluationEligible
  ) {
    throw new ExperimentExecutionBridgeError(
      'RUN_NOT_APPROVED',
      'Run must be explicitly approved by HITL and pass automatic script gates.',
    );
  }
};

const executionEvidence = (
  run: ExperimentRunV1,
  scriptHash: string,
  status: DynamicExecutionEvidenceV1['status'],
  executionEnvironment: string,
): DynamicExecutionEvidenceV1 => ({
  contractId: 'aura.dynamic-execution-evidence.v1',
  status,
  approvedScriptHash: scriptHash,
  beforeDatasetSha256: run.environment.dataset.sha256,
  afterDatasetSha256: null,
  executionEnvironment,
  executedAt: null,
  reaudit: null,
});

export const createExperimentExecutionBridge = ({
  store,
  now = () => new Date().toISOString(),
  execute = executeControlledRun,
  reaudit = runReaudit,
  calculateDelta = calculateHealthDelta,
}: ExperimentExecutionBridgeDependencies): ExperimentExecutionBridge => {
  const queueForHitl = async (runId: string): Promise<ExperimentRunV1> => {
    const run = await loadRequiredRun(store, runId);
    if (run.status !== 'reviewed' || run.humanReview === null || run.automaticEvaluation === null) {
      throw new ExperimentExecutionBridgeError('RUN_NOT_REVIEWED', 'Run must be reviewed before HITL.');
    }
    const next = { ...run, status: 'awaiting_hitl' as const, updatedAt: now() };
    await store.saveRun(next);
    return next;
  };

  const recordHitlDecision = async (
    runId: string,
    decision: HitlDecisionV1,
  ): Promise<ExperimentRunV1> => {
    const run = await loadRequiredRun(store, runId);
    if (run.status !== 'awaiting_hitl') {
      throw new ExperimentExecutionBridgeError('RUN_NOT_AWAITING_HITL', 'Run is not awaiting a HITL decision.');
    }
    const next: ExperimentRunV1 = {
      ...run,
      status: decision.status,
      updatedAt: decision.decidedAt,
      hitl: structuredClone(decision),
    };
    await store.saveRun(next);
    return next;
  };

  const prepareExternalExecution = async (
    runId: string,
    input: PrepareExternalExecutionInput,
  ): Promise<PreparedExternalExecution> => {
    const run = await loadRequiredRun(store, runId);
    assertHumanApproved(run);
    const exactBeforeHash = computeExactCsvFingerprint(input.beforeCsv);
    if (exactBeforeHash !== run.environment.dataset.sha256) {
      const reason = `source fingerprint mismatch: expected ${run.environment.dataset.sha256}, received ${exactBeforeHash}`;
      const next: ExperimentRunV1 = {
        ...run,
        status: 'blocked',
        updatedAt: now(),
        execution: executionEvidence(run, input.contract.scriptHash, 'blocked', `colab_notebook:blocked:${reason}`),
      };
      await store.saveRun(next);
      return { run: next, controlled: null, notebookJson: null };
    }

    const controlled = execute(
      input.contract,
      input.remediationPlan,
      input.buildContext,
      exactBeforeHash,
      { ...input.options, fixtureCsv: input.beforeCsv },
    );
    const notebookJson = controlled.execution.notebook?.generated === true
      ? controlled.execution.notebook.json ?? null
      : null;
    const prepared = controlled.execution.status === 'success'
      && notebookJson !== null
      && controlled.datasetOriginalIntact;
    const reason = controlled.execution.error ?? 'execution preparation did not pass every gate';
    const next: ExperimentRunV1 = {
      ...run,
      status: prepared ? 'awaiting_external_output' : 'blocked',
      updatedAt: now(),
      execution: executionEvidence(
        run,
        input.contract.scriptHash,
        prepared ? 'awaiting_external_output' : 'blocked',
        prepared ? `colab_notebook:${RUNTIME_VERSION}` : `colab_notebook:blocked:${reason}`,
      ),
    };
    await store.saveRun(next);
    return { run: next, controlled, notebookJson: prepared ? notebookJson : null };
  };

  const importExternalOutput = async (
    runId: string,
    input: ImportExternalOutputInput,
  ): Promise<ImportedExternalOutput> => {
    const run = await loadRequiredRun(store, runId);
    if (
      run.status !== 'awaiting_external_output'
      || run.hitl?.status !== 'approved'
      || run.execution?.status !== 'awaiting_external_output'
    ) {
      throw new ExperimentExecutionBridgeError(
        'RUN_NOT_AWAITING_OUTPUT',
        'Run must be approved and awaiting an external CSV output.',
      );
    }
    const beforeHash = computeExactCsvFingerprint(input.beforeCsv);
    if (
      beforeHash !== run.environment.dataset.sha256
      || beforeHash !== run.execution.beforeDatasetSha256
    ) {
      throw new ExperimentExecutionBridgeError(
        'SOURCE_FINGERPRINT_MISMATCH',
        'Imported before CSV does not match the immutable source dataset.',
      );
    }

    const reauditResult = reaudit(input.beforeCsv, input.afterCsv, input.beforeEvidenceRef, {
      delimiter: input.delimiter,
    });
    const healthDelta = calculateDelta(reauditResult.beforeReport, reauditResult.afterReport);
    const exactAfterHash = computeExactCsvFingerprint(input.afterCsv);
    const executedAt = input.executedAt ?? now();
    const next: ExperimentRunV1 = {
      ...run,
      status: 'reaudited',
      updatedAt: now(),
      execution: {
        ...run.execution,
        status: 'reaudited',
        afterDatasetSha256: exactAfterHash,
        executionEnvironment: input.executionEnvironment,
        executedAt,
        reaudit: buildReauditEvidence(reauditResult, healthDelta),
      },
    };
    await store.saveRun(next);
    return { run: next, reaudit: reauditResult, healthDelta };
  };

  return { queueForHitl, recordHitlDecision, prepareExternalExecution, importExternalOutput };
};
