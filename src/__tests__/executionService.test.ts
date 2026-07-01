/**
 * ExecutionService Tests — Phase 5 Loop 3
 *
 * Tests the integrated pipeline: preflight gate → sandbox gate →
 * Colab notebook generation on fixture copy.
 *
 * Sandbox blocking is validated in Loop 2 (runtimeSandbox.test.ts).
 * Here we focus on: integrated pipeline, preflight gate, notebook generation.
 */

import { describe, expect, it } from 'vitest';
import { executeControlledRun, RUNTIME_VERSION } from '../services/executionService';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import {
  buildScriptCandidateV2,
  finalizeScriptContractV2,
} from '../contracts/llm/scriptBuilderV2';
import { validateScriptCandidateV2 } from '../contracts/llm/scriptValidatorV2';
import type {
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptContractV2,
} from '../contracts/llm/types';

const VALID_FINGERPRINT = 'sha256:testfingerprint';

const FIXTURE_CSV = `Address,City,CallDateTime,CrimeId
"123 Main St","San Francisco","2024-01-01",160903280
"456 Oak Ave","Los Angeles","2024-01-02",160903281
"789 Pine Rd","Chicago","2024-01-03",160903282
`;

function makeAction(
  actionType: string,
  columnId: string | null,
  params: Record<string, unknown>,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
  overrides: Partial<RemediationActionV2> = {},
): RemediationActionV2 {
  return {
    actionId: overrides.actionId ?? `act:test_${actionType}_${columnId ?? 'null'}`,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType: actionType as RemediationActionV2['actionType'],
    parameters: params as unknown as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
    ...overrides,
  };
}

function makePlan(actions: RemediationActionV2[], overrides: Partial<RemediationPlanV2> = {}): RemediationPlanV2 {
  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId: overrides.planId ?? 'plan:test123',
    diagnosisRef: 'diag:test',
    evidenceEnvelopeRef: overrides.evidenceEnvelopeRef ?? 'env:testabc',
    datasetFingerprint: overrides.datasetFingerprint ?? VALID_FINGERPRINT,
    plan: actions,
    actionabilityMap: {},
    exclusions: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBuildContext(plan: RemediationPlanV2, columns: string[]): ScriptBuildContextV2 {
  const columnRefs = buildColumnRegistry(columns);
  return buildScriptContext(
    {
      evidenceEnvelopeRef: plan.evidenceEnvelopeRef,
      datasetFingerprint: plan.datasetFingerprint,
      columns: columnRefs.map(c => ({
        columnId: c.columnId, name: c.name, position: c.position,
        duplicateOrdinal: c.duplicateOrdinal, isAmbiguous: c.isAmbiguous, isDuplicate: c.isDuplicate,
      })),
      issues: [],
    },
    columnRefs,
    plan.datasetFingerprint,
  );
}

function buildValidContract(
  actions: RemediationActionV2[],
  columns: string[],
  planOverrides: Partial<RemediationPlanV2> = {},
): { contract: ScriptContractV2; plan: RemediationPlanV2; ctx: ScriptBuildContextV2 } {
  const plan = makePlan(actions, planOverrides);
  const ctx = makeBuildContext(plan, columns);
  const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
  const validation = validateScriptCandidateV2(candidate, plan, ctx);
  const contract = finalizeScriptContractV2(candidate, validation);
  return { contract, plan, ctx };
}

// ── Tests ──

describe('executionService', () => {
  describe('gate 1: preflight blocked', () => {
    it('blocks when fingerprint does not match', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { contract, plan, ctx } = buildValidContract([action], ['Age']);
      const wrongFp = 'sha256:wrong_fingerprint_xyz';

      const result = executeControlledRun(contract, plan, ctx, wrongFp);

      expect(result.preflightBlocked).toBe(true);
      expect(result.sandboxBlocked).toBe(false);
      expect(result.execution.status).toBe('blocked');
      expect(result.execution.error).toContain('datasetFingerprint');
      expect(result.gates.preflight.status).toBe('blocked');
      expect(result.fixtureApplied).toBe(false);
      expect(result.datasetOriginalIntact).toBe(true);
    });

    it('blocks when scriptHash is tampered after finalization', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { plan, ctx } = buildValidContract([action], ['Age']);

      const tamperedContract: ScriptContractV2 = {
        ...plan,
        contractId: 'aura.script.v2',
        contractVersion: '2.0.0',
        remediationRef: 'plan:test',
        datasetFingerprint: VALID_FINGERPRINT,
        acceptedActionIds: ['act:a1'],
        rejectedActionIds: [],
        excludedActionIds: [],
        columnRefs: [],
        rendererVersion: '2.0.0',
        placeholderVocabularyVersion: '1.0.0',
        scriptText: `def clean_dataset(df):\n    df = df.copy()\n    return df`,
        cleanDatasetFn: 'clean_dataset',
        scriptHash: 'this_hash_is_tampered',
        validationResult: { valid: true, errors: [], warnings: [], pythonSyntax: { state: 'passed' } },
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      const result = executeControlledRun(tamperedContract, plan, ctx, VALID_FINGERPRINT);

      expect(result.preflightBlocked).toBe(true);
      expect(result.execution.status).toBe('blocked');
      expect(result.gates.preflight.hashMatch).toBe(false);
    });

    it('blocks when acceptedActionIds contains action not in plan', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { plan, ctx } = buildValidContract([action], ['Age']);

      const phantomContract: ScriptContractV2 = {
        ...plan,
        contractId: 'aura.script.v2',
        contractVersion: '2.0.0',
        remediationRef: 'plan:test',
        datasetFingerprint: VALID_FINGERPRINT,
        acceptedActionIds: ['act:phantom_not_in_plan'],
        rejectedActionIds: [],
        excludedActionIds: [],
        columnRefs: [],
        rendererVersion: '2.0.0',
        placeholderVocabularyVersion: '1.0.0',
        scriptText: `def clean_dataset(df):\n    df = df.copy()\n    return df`,
        cleanDatasetFn: 'clean_dataset',
        scriptHash: 'abc123',
        validationResult: { valid: true, errors: [], warnings: [], pythonSyntax: { state: 'passed' } },
        generatedAt: '2025-01-01T00:00:00.000Z',
      };

      const result = executeControlledRun(phantomContract, plan, ctx, VALID_FINGERPRINT);

      expect(result.preflightBlocked).toBe(true);
      expect(result.execution.status).toBe('blocked');
    });
  });

  describe('successful execution: both gates pass + notebook generated', () => {
    it('returns success with notebook generated when preflight and sandbox pass', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Incidentes_Policiales.csv',
      });

      expect(result.preflightBlocked).toBe(false);
      expect(result.sandboxBlocked).toBe(false);
      expect(result.execution.status).toBe('success');
      expect(result.execution.runtime).toBe('colab_notebook');
      expect(result.execution.runtimeVersion).toBe(RUNTIME_VERSION);
      expect(result.fixtureApplied).toBe(true);
      expect(result.datasetOriginalIntact).toBe(true);
      expect(result.gates.preflight.status).toBe('ready');
      expect(result.gates.sandbox).not.toBeNull();
      expect(result.gates.sandbox!.status).toBe('success');
    });

    it('generates a valid notebook JSON after passing both gates', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Incidentes_Policiales.csv',
      });

      expect(result.execution.notebook).toBeDefined();
      expect(result.execution.notebook!.generated).toBe(true);
      expect(result.execution.notebook!.json).toBeTruthy();

      const notebook = JSON.parse(result.execution.notebook!.json!);
      expect(notebook.nbformat).toBe(4);
      expect(notebook.nbformat_minor).toBe(5);
      expect(notebook.cells).toBeInstanceOf(Array);
      expect(notebook.cells.length).toBeGreaterThan(0);
    });

    it('includes approved script in generated notebook', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Incidentes_Policiales.csv',
      });

      const notebookJson = result.execution.notebook!.json!;
      expect(notebookJson).toContain('def clean_dataset(df)');
      expect(notebookJson).toContain('clean_dataset');
    });

    it('populates ExecutionSummaryV1 with correct structure', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'TestDataset.csv',
      });

      const { execution } = result;
      expect(execution.startedAt).toBeTruthy();
      expect(execution.finishedAt).toBeTruthy();
      expect(execution.durationMs).toBeGreaterThanOrEqual(0);
      expect(execution.logs).toBeInstanceOf(Array);
      expect(execution.logs.length).toBeGreaterThan(0);
      expect(execution.sandbox.networkDisabled).toBe(true);
      expect(execution.sandbox.filesystemRestricted).toBe(true);
      expect(execution.sandbox.timeoutMs).toBe(30000);
      expect(execution.sandbox.allowedImports).toContain('pandas');
      expect(execution.error).toBeNull();
    });

    it('includes fixture metadata in logs', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Incidentes_Policiales.csv',
      });

      expect(result.execution.logs).toContain('fixture: 3 rows, 4 columns');
      expect(result.execution.logs).toContain('operating on fixture copy — dataset original intact');
      expect(result.execution.logs).toContain('gate 1 passed: preflight ready');
      expect(result.execution.logs).toContain('gate 2 passed: sandbox safe');
    });

    it('sets notebook.error=undefined on successful generation', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
      });

      expect(result.execution.notebook!.error).toBeUndefined();
    });

    it('logs confirm execution delegates to external Colab runtime', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Incidentes_Policiales.csv',
      });

      const logsJoined = result.execution.logs.join(' ');
      expect(logsJoined).toContain('notebook prepared');
      expect(logsJoined).toContain('Colab');
      expect(logsJoined).toContain('clean_dataset');
    });
  });

  describe('fixture metadata', () => {
    it('detects correct column count from CSV header', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: FIXTURE_CSV,
        datasetName: 'Test.csv',
      });

      expect(result.execution.logs).toContain('fixture: 3 rows, 4 columns');
    });

    it('reports 0 rows for header-only CSV', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: 'col1,col2,col3\n',
        datasetName: 'Empty.csv',
      });

      expect(result.execution.logs).toContain('fixture: 0 rows, 3 columns');
    });
  });

  describe('default options', () => {
    it('uses default sandbox config when not provided', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT);

      expect(result.execution.sandbox.allowedImports).toContain('pandas');
      expect(result.execution.sandbox.networkDisabled).toBe(true);
    });

    it('accepts empty fixtureCsv without error', () => {
      const colRefs = buildColumnRegistry(['City']);
      const action = makeAction('normalize_casing', colRefs[0].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:normalize_city' });
      const { contract, plan, ctx } = buildValidContract([action], ['City']);

      const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
        fixtureCsv: '',
      });

      expect(result.execution.status).toBe('success');
      expect(result.execution.notebook!.generated).toBe(true);
      expect(result.execution.logs).toContain('fixture: 0 rows, 0 columns');
    });
  });

  describe('fail-closed behavior', () => {
    it('sets fixtureApplied=false when preflight blocks', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { contract, plan, ctx } = buildValidContract([action], ['Age']);

      const result = executeControlledRun(contract, plan, ctx, 'sha256:wrong_fp');

      expect(result.fixtureApplied).toBe(false);
      expect(result.datasetOriginalIntact).toBe(true);
    });

    it('reports both gates in result when preflight blocks', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { contract, plan, ctx } = buildValidContract([action], ['Age']);

      const result = executeControlledRun(contract, plan, ctx, 'sha256:wrong_fp');

      expect(result.gates.preflight.status).toBe('blocked');
      expect(result.gates.sandbox).toBeNull();
      expect(result.sandboxBlocked).toBe(false);
    });

    it('logs describe the blocking reason', () => {
      const colRefs = buildColumnRegistry(['Age']);
      const action = makeAction('trim_whitespace', colRefs[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
      const { contract, plan, ctx } = buildValidContract([action], ['Age']);

      const result = executeControlledRun(contract, plan, ctx, 'sha256:wrong_fp');

      const blockingLog = result.execution.logs.find(l => l.includes('blocked'));
      expect(blockingLog).toBeTruthy();
    });
  });
});
