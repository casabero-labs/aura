/**
 * Preflight Check Tests — Phase 5 Loop 1
 *
 * Validates that preflightCheck correctly blocks or allows
 * ScriptContractV2 execution based on verification, hash,
 * fingerprint, and HITL coherence.
 */

import { describe, it, expect } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import {
  buildScriptCandidateV2,
  computeScriptHashV2,
  finalizeScriptContractV2,
} from '../contracts/llm/scriptBuilderV2';
import { validateScriptCandidateV2 } from '../contracts/llm/scriptValidatorV2';
import { preflightCheck } from '../services/preflightCheck';
import type {
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptContractV2,
  ScriptContractCandidateV2,
} from '../contracts/llm/types';

// ── Fixtures ──

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
    datasetFingerprint: overrides.datasetFingerprint ?? 'sha256:testfingerprint',
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

function buildAndFinalizeContract(
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

const VALID_FINGERPRINT = 'sha256:testfingerprint';
const OTHER_FINGERPRINT = 'sha256:different_fingerprint_12345';

function makeActionWithColumn(
  actionType: string,
  columns: string[],
  colIndex: number,
  params: Record<string, unknown>,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
  overrides: Partial<RemediationActionV2> = {},
): { action: RemediationActionV2; columnId: string } {
  const columnRefs = buildColumnRegistry(columns);
  const columnId = columnRefs[colIndex].columnId;
  return {
    action: makeAction(actionType, columnId, params, approvalStatus, overrides),
    columnId,
  };
}

function validContractFixture(
  columns: string[],
  actions: RemediationActionV2[],
  planOverrides: Partial<RemediationPlanV2> = {},
) {
  return buildAndFinalizeContract(actions, columns, planOverrides);
}

// ═══════════════════════════════════════════════════════════
// Ready cases
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: ready status', () => {
  it('returns ready for a valid contract with matching fingerprint and HITL', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const result = preflightCheck(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('ready');
    expect(result.verification.valid).toBe(true);
    expect(result.verification.errors).toEqual([]);
    expect(result.hashMatch).toBe(true);
    expect(result.fingerprintMatch).toBe(true);
    expect(result.acceptedActionsCoherent).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('returns ready with multiple approved actions', () => {
    const { action: a1 } = makeActionWithColumn('trim_whitespace', ['Age', 'Fare'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
    const { action: a2 } = makeActionWithColumn('trim_whitespace', ['Age', 'Fare'], 1, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a2' });
    const { contract, plan, ctx } = validContractFixture(['Age', 'Fare'], [a1, a2]);

    const result = preflightCheck(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('ready');
    expect(result.acceptedActionsCoherent).toBe(true);
  });

  it('excludes rejected and pending actions from acceptedActionIds', () => {
    const { action: a1 } = makeActionWithColumn('trim_whitespace', ['Age', 'Fare'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
    const { action: a2 } = makeActionWithColumn('normalize_casing', ['Age', 'Fare'], 1, { strategy: 'lowercase' }, 'rejected', { actionId: 'act:a2' });
    const { action: a3 } = makeActionWithColumn('trim_whitespace', ['Age', 'Fare'], 0, { trimEdges: false, collapseInternalWhitespace: true }, 'pending', { actionId: 'act:a3' });
    const { contract, plan, ctx } = validContractFixture(['Age', 'Fare'], [a1, a2, a3]);

    const result = preflightCheck(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('ready');
    expect(result.acceptedActionsCoherent).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Blocked: hash mismatch
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: blocked by hash mismatch', () => {
  it('blocks when scriptHash is altered after finalization', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = { ...contract, scriptHash: 'not_the_real_hash' };

    const result = preflightCheck(tampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.hashMatch).toBe(false);
    expect(result.reasons.some(r => r.includes('scriptHash mismatch'))).toBe(true);
  });

  it('blocks when scriptText is altered (hash changes)', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = { ...contract, scriptText: 'print("malicious")' };

    const result = preflightCheck(tampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.hashMatch).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Blocked: fingerprint mismatch
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: blocked by fingerprint mismatch', () => {
  it('blocks when current fingerprint differs from contract', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const result = preflightCheck(contract, plan, ctx, OTHER_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.fingerprintMatch).toBe(false);
    expect(result.reasons.some(r => r.includes('datasetFingerprint mismatch'))).toBe(true);
  });

  it('blocks when fingerprint is empty string', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const result = preflightCheck(contract, plan, ctx, '');

    expect(result.status).toBe('blocked');
    expect(result.fingerprintMatch).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Blocked: HITL coherence
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: blocked by HITL coherence', () => {
  it('blocks when acceptedActionIds includes a rejected action', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected');
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = {
      ...contract,
      acceptedActionIds: [action.actionId],
    };
    const tamperedHash = computeScriptHashV2(tampered as unknown as ScriptContractCandidateV2);
    const fullyTampered: ScriptContractV2 = { ...tampered, scriptHash: tamperedHash };

    const result = preflightCheck(fullyTampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.acceptedActionsCoherent).toBe(false);
    expect(result.reasons.some(r => r.includes('HITL coherence violations'))).toBe(true);
  });

  it('blocks when acceptedActionIds includes a pending action', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'pending');
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = {
      ...contract,
      acceptedActionIds: [action.actionId],
    };
    const tamperedHash = computeScriptHashV2(tampered as unknown as ScriptContractCandidateV2);
    const fullyTampered: ScriptContractV2 = { ...tampered, scriptHash: tamperedHash };

    const result = preflightCheck(fullyTampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.acceptedActionsCoherent).toBe(false);
    expect(result.reasons.some(r => r.includes('pending'))).toBe(true);
  });

  it('blocks when an approved action is missing from acceptedActionIds', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'approved');
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = {
      ...contract,
      acceptedActionIds: [],
    };
    const tamperedHash = computeScriptHashV2(tampered as unknown as ScriptContractCandidateV2);
    const fullyTampered: ScriptContractV2 = { ...tampered, scriptHash: tamperedHash };

    const result = preflightCheck(fullyTampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.acceptedActionsCoherent).toBe(false);
    expect(result.reasons.some(r => r.includes('missing from contract'))).toBe(true);
  });

  it('blocks when acceptedActionIds references a nonexistent action', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:real' });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    const tampered: ScriptContractV2 = {
      ...contract,
      acceptedActionIds: ['act:real', 'act:phantom'],
    };
    const tamperedHash = computeScriptHashV2(tampered as unknown as ScriptContractCandidateV2);
    const fullyTampered: ScriptContractV2 = { ...tampered, scriptHash: tamperedHash };

    const result = preflightCheck(fullyTampered, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.acceptedActionsCoherent).toBe(false);
    expect(result.reasons.some(r => r.includes('not found in remediation plan'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Blocked: verification failure + null guards
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: blocked by verification failure', () => {
  it('blocks when contract is null', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const plan = makePlan([action]);
    const ctx = makeBuildContext(plan, ['Age']);

    const result = preflightCheck(null as unknown as ScriptContractV2, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.verification.valid).toBe(false);
    expect(result.reasons.some(r => r.includes('null or undefined'))).toBe(true);
  });

  it('blocks when contract is undefined', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const plan = makePlan([action]);
    const ctx = makeBuildContext(plan, ['Age']);

    const result = preflightCheck(undefined as unknown as ScriptContractV2, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.reasons.some(r => r.includes('null or undefined'))).toBe(true);
  });

  it('blocks when contract is an empty object', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const plan = makePlan([action]);
    const ctx = makeBuildContext(plan, ['Age']);

    const result = preflightCheck({} as ScriptContractV2, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.fingerprintMatch).toBe(false);
    expect(result.hashMatch).toBe(false);
    expect(result.acceptedActionsCoherent).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Multiple block reasons
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: multiple block reasons', () => {
  it('reports all violations when multiple checks fail', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age', 'Fare'], 0, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a1' });
    const { action: rejected } = makeActionWithColumn('normalize_casing', ['Age', 'Fare'], 1, { strategy: 'lowercase' }, 'rejected', { actionId: 'act:a2' });
    const { contract, plan, ctx } = validContractFixture(['Age', 'Fare'], [action, rejected]);

    // Tamper: wrong fingerprint, add rejected action to acceptedActionIds, alter hash
    const tampered: ScriptContractV2 = {
      ...contract,
      acceptedActionIds: [...contract.acceptedActionIds, 'act:a2'],
    };
    const fullyTampered: ScriptContractV2 = {
      ...tampered,
      scriptHash: 'broken_hash_12345',
    };

    const result = preflightCheck(fullyTampered, plan, ctx, OTHER_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.hashMatch).toBe(false);
    expect(result.fingerprintMatch).toBe(false);
    expect(result.acceptedActionsCoherent).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════

describe('PreflightCheck: edge cases', () => {
  it('ready with empty plan and empty acceptedActionIds', () => {
    const plan = makePlan([]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const validation = validateScriptCandidateV2(candidate, plan, ctx);
    const contract = finalizeScriptContractV2(candidate, validation);

    const result = preflightCheck(contract, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('ready');
    expect(result.acceptedActionsCoherent).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('hashMatch is false and blocked when scriptText is altered', () => {
    const { action } = makeActionWithColumn('trim_whitespace', ['Age'], 0, { trimEdges: true, collapseInternalWhitespace: false });
    const { contract, plan, ctx } = validContractFixture(['Age'], [action]);

    // Alter scriptText so recomputed hash differs from stored hash
    const broken: ScriptContractV2 = { ...contract, scriptText: 'print("different")' };

    const result = preflightCheck(broken, plan, ctx, VALID_FINGERPRINT);

    expect(result.status).toBe('blocked');
    expect(result.hashMatch).toBe(false);
    expect(result.reasons.some(r => r.includes('scriptHash mismatch'))).toBe(true);
  });
});
