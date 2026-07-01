/**
 * Execution Service Tests — Phase 5 Loop 3
 *
 * Validates controlled execution pipeline: preflight gate,
 * sandbox gate, fixture copy, ExecutionSummaryV1 output.
 * Uses controlled fixture, never real dataset.
 *
 * Note: builder-generated contracts are always safe.
 * Preflight catches hash/fingerprint tampering.
 * Sandbox is tested separately in runtimeSandbox.test.ts.
 * This file tests the INTEGRATED pipeline with builder output.
 */

import { describe, it, expect } from 'vitest';
import { executeControlledRun } from '../services/executionService';
import type { ScriptContractV2, RemediationPlanV2, RemediationActionV2, ScriptBuildContextV2 } from '../contracts/llm/types';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import {
  buildScriptCandidateV2,
  finalizeScriptContractV2,
} from '../contracts/llm/scriptBuilderV2';
import { validateScriptCandidateV2 } from '../contracts/llm/scriptValidatorV2';

// ── Fixture helpers ──

function makeAction(
  columnId: string | null,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
  overrides: Partial<RemediationActionV2> = {},
): RemediationActionV2 {
  return {
    actionId: overrides.actionId ?? `act:test_${columnId ?? 'null'}`,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType: 'trim_whitespace',
    parameters: { trimEdges: true, collapseInternalWhitespace: false } as unknown as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
    ...overrides,
  };
}

function makePlan(actions: RemediationActionV2[], fingerprint?: string): RemediationPlanV2 {
  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId: 'plan:test123',
    diagnosisRef: 'diag:test',
    evidenceEnvelopeRef: 'env:testabc',
    datasetFingerprint: fingerprint ?? 'sha256:testfingerprint',
    plan: actions,
    actionabilityMap: {},
    exclusions: [],
    generatedAt: '2025-01-01T00:00:00.000Z',
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

function buildContract(columns: string[]): {
  contract: ScriptContractV2;
  plan: RemediationPlanV2;
  ctx: ScriptBuildContextV2;
} {
  const columnRefs = buildColumnRegistry(columns);
  const columnId = columnRefs[0].columnId;
  const action = makeAction(columnId);
  const plan = makePlan([action]);
  const ctx = makeBuildContext(plan, columns);
  const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
  const validation = validateScriptCandidateV2(candidate, plan, ctx);
  const contract = finalizeScriptContractV2(candidate, validation);
  return { contract, plan, ctx };
}

const VALID_FINGERPRINT = 'sha256:testfingerprint';
const WRONG_FINGERPRINT = 'sha256:wrong_fingerprint_00123456789';

const FIXTURE_CSV = `Name,Age,City
Alice,30,New York
Bob,25,Los Angeles
Charlie,35,Chicago
`;

// ═══════════════════════════════════════════════════════════
// Successful execution (builder-generated safe contracts)
// ═══════════════════════════════════════════════════════════

describe('Execution: successful controlled run', () => {
  it('completes pipeline with builder-generated valid contract', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
      datasetName: 'test_fixture',
    });

    expect(result.execution.status).toBe('success');
    expect(result.preflightBlocked).toBe(false);
    expect(result.sandboxBlocked).toBe(false);
    expect(result.fixtureApplied).toBe(true);
    expect(result.datasetOriginalIntact).toBe(true);
    expect(result.execution.runtime).toBe('colab_notebook');
    expect(result.execution.error).toBeNull();
  });

  it('returns ExecutionSummaryV1 with all required fields', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    const exec = result.execution;
    expect(exec.runtime).toBe('colab_notebook');
    expect(exec.runtimeVersion).toBeTruthy();
    expect(exec.status).toBe('success');
    expect(exec.startedAt).toBeTruthy();
    expect(exec.finishedAt).toBeTruthy();
    expect(exec.durationMs).toBeGreaterThanOrEqual(0);
    expect(exec.logs.length).toBeGreaterThan(0);
    expect(exec.error).toBeNull();
    expect(exec.sandbox.networkDisabled).toBe(true);
    expect(exec.sandbox.filesystemRestricted).toBe(true);
    expect(exec.sandbox.timeoutMs).toBeGreaterThan(0);
    expect(exec.sandbox.allowedImports.length).toBeGreaterThan(0);
  });

  it('preserves fixture copy and reports dataset original intact', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    expect(result.datasetOriginalIntact).toBe(true);
    expect(result.execution.logs.some(l => l.includes('dataset original intact'))).toBe(true);
  });

  it('includes structured logs with gate passes', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    const logsJoined = result.execution.logs.join('\n');
    expect(logsJoined).toContain('controlled execution started');
    expect(logsJoined).toContain('gate 1 passed: preflight ready');
    expect(logsJoined).toContain('gate 2 passed: sandbox safe');
    expect(logsJoined).toContain('fixture');
    expect(logsJoined).toContain('execution context prepared');
  });

  it('reports runtime as colab_notebook and script details', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    const logsJoined = result.execution.logs.join('\n');
    expect(result.execution.runtime).toBe('colab_notebook');
    expect(logsJoined).toContain('delegating to colab_notebook runtime');
    expect(logsJoined).toContain('script hash');
    expect(logsJoined).toContain('clean_dataset function: present');
  });

  it('reports fixture row and column counts', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    const logsJoined = result.execution.logs.join('\n');
    expect(logsJoined).toContain('fixture: 3 rows, 3 columns');
  });
});

// ═══════════════════════════════════════════════════════════
// Gate 1: Preflight blocked
// ═══════════════════════════════════════════════════════════

describe('Execution: blocked by preflight', () => {
  it('blocks when fingerprint does not match', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, WRONG_FINGERPRINT);

    expect(result.execution.status).toBe('blocked');
    expect(result.preflightBlocked).toBe(true);
    expect(result.sandboxBlocked).toBe(false);
    expect(result.fixtureApplied).toBe(false);
    expect(result.datasetOriginalIntact).toBe(true);
    expect(result.execution.error).toContain('preflight blocked');
    expect(result.gates.preflight?.status).toBe('blocked');
    expect(result.gates.sandbox).toBeNull();
  });

  it('blocks when script hash is tampered', () => {
    const { contract, plan, ctx } = buildContract(['Age']);
    const tampered: ScriptContractV2 = { ...contract, scriptHash: 'broken_hash' };

    const result = executeControlledRun(tampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.execution.status).toBe('blocked');
    expect(result.preflightBlocked).toBe(true);
    expect(result.execution.error).toContain('preflight blocked');
  });

  it('blocks when contract acceptedActionIds do not match plan', () => {
    const { contract, plan, ctx } = buildContract(['Age']);
    const tampered: ScriptContractV2 = { ...contract, acceptedActionIds: ['act:phantom'] };

    const result = executeControlledRun(tampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.execution.status).toBe('blocked');
    expect(result.preflightBlocked).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Sandbox gate: tested in runtimeSandbox.test.ts
// Builder-generated contracts are always sandbox-safe
// ═══════════════════════════════════════════════════════════

describe('Execution: sandbox gate', () => {
  it('passes sandbox gate for builder-generated contract', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    expect(result.sandboxBlocked).toBe(false);
    expect(result.gates.sandbox?.status).toBe('success');
  });
});

// ═══════════════════════════════════════════════════════════
// Default options
// ═══════════════════════════════════════════════════════════

describe('Execution: default options', () => {
  it('works without fixture (empty fixture, still validated)', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.execution.status).toBe('success');
    expect(result.fixtureApplied).toBe(true);
    expect(result.datasetOriginalIntact).toBe(true);
  });

  it('uses default sandbox config when none provided', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.execution.sandbox.networkDisabled).toBe(true);
    expect(result.execution.sandbox.timeoutMs).toBe(30_000);
  });
});

// ═══════════════════════════════════════════════════════════
// Fail-closed
// ═══════════════════════════════════════════════════════════

describe('Execution: fail-closed', () => {
  it('fails immediately on first gate failure (preflight)', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, WRONG_FINGERPRINT);

    expect(result.execution.status).toBe('blocked');
    expect(result.gates.sandbox).toBeNull();
  });

  it('does not apply fixture when preflight blocks', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, WRONG_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    expect(result.fixtureApplied).toBe(false);
    expect(result.datasetOriginalIntact).toBe(true);
  });

  it('returns blocking gate info in gates field', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, WRONG_FINGERPRINT);

    expect(result.gates.preflight).toBeTruthy();
    expect(result.gates.preflight.status).toBe('blocked');
    expect(result.gates.sandbox).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// Fixture metadata
// ═══════════════════════════════════════════════════════════

describe('Execution: fixture metadata', () => {
  it('detects columns from fixture CSV header', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: FIXTURE_CSV,
    });

    const logsJoined = result.execution.logs.join('\n');
    expect(logsJoined).toContain('fixture: 3 rows, 3 columns');
  });

  it('reports 0 rows for header-only fixture', () => {
    const { contract, plan, ctx } = buildContract(['Age']);

    const result = executeControlledRun(contract, plan, ctx, VALID_FINGERPRINT, {
      fixtureCsv: 'A,B,C',
    });

    const logsJoined = result.execution.logs.join('\n');
    expect(logsJoined).toContain('fixture: 0 rows');
  });
});
