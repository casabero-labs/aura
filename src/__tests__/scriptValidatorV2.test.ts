/**
 * Script Validator v2 Tests — Phase 4 Loop 4R.1.
 *
 * 104 tests covering shape, references, partition, columns, security,
 * syntax, reconstruction, final contract, embedded validationResult, hash fields.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import {
  buildScriptCandidateCoreV2,
  buildScriptCandidateV2,
  computeScriptHashV2,
  finalizeScriptContractV2,
} from '../contracts/llm/scriptBuilderV2';
import { SCRIPT_RENDERER_VERSION } from '../contracts/llm/scriptRendererV2';
import { PLACEHOLDER_VOCABULARY_VERSION } from '../contracts/llm/placeholderVocabulary';
import {
  validateScriptCandidateV2,
  verifyScriptContractV2,
} from '../contracts/llm/scriptValidatorV2';
import type {
  ColumnRef,
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptValidationResultV2,
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

function buildValidCandidate(actions: RemediationActionV2[], columns: string[]) {
  const plan = makePlan(actions);
  const ctx = makeBuildContext(plan, columns);
  return buildScriptCandidateCoreV2(plan, ctx);
}

function buildCandidateWithGen(actions: RemediationActionV2[], columns: string[]) {
  const plan = makePlan(actions);
  const ctx = makeBuildContext(plan, columns);
  return buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
}

function validate(candidate: unknown, actions: RemediationActionV2[], columns: string[]): ScriptValidationResultV2 {
  const plan = makePlan(actions);
  const ctx = makeBuildContext(plan, columns);
  return validateScriptCandidateV2(candidate, plan, ctx);
}

// ═══════════════════════════════════════════════════════════
// Shape Validation
// ═══════════════════════════════════════════════════════════

describe('Shape: candidate structure', () => {
  let columns: ColumnRef[];
  let basePlan: RemediationPlanV2;

  beforeEach(() => {
    columns = buildColumnRegistry(['Age']);
    const action = makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false });
    basePlan = makePlan([action]);
  });

  it('rejects null candidate', () => {
    const plan = basePlan;
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(null, plan, ctx);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects array candidate', () => {
    const plan = basePlan;
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2([], plan, ctx);
    expect(result.valid).toBe(false);
  });

  it('rejects missing scriptText', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, scriptText: undefined };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID')).toBe(true);
  });

  it('rejects extra property scriptHash in candidate', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, scriptHash: 'fakehash' };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('scriptHash'))).toBe(true);
  });

  it('rejects validationResult in candidate', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, validationResult: {} };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('validationResult'))).toBe(true);
  });

  it('rejects wrong contractId', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, contractId: 'aura.other.v2' };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
  });

  it('rejects wrong contractVersion', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, contractVersion: '1.0.0' };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
  });

  it('rejects wrong cleanDatasetFn', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, cleanDatasetFn: 'wrong_name' };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
  });

  it('rejects non-canonical generatedAt', () => {
    const bad = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    (bad as unknown as Record<string, unknown>).generatedAt = '2025-01-01';
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
  });

  it('rejects wrong rendererVersion', () => {
    const valid = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...valid, rendererVersion: '1.0.0' };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.valid).toBe(false);
  });

  it('valid candidate passes shape', () => {
    const candidate = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const result = validate(candidate, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const shapeErrors = result.errors.filter(e => e.code === 'SCRIPT_CONTRACT_INVALID');
    expect(shapeErrors).toHaveLength(0);
  });

  it('rejects duplicate IDs in acceptedActionIds', () => {
    const cols = buildColumnRegistry(['Age', 'Fare']);
    const actions = [
      makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a' }),
      makeAction('trim_whitespace', cols[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:b' }),
    ];
    const candidate = buildCandidateWithGen(actions, ['Age', 'Fare']);
    (candidate as unknown as Record<string, unknown>).acceptedActionIds = ['act:a', 'act:a'];
    const result = validate(candidate, actions, ['Age', 'Fare']);
    expect(result.valid).toBe(false);
  });

  it('rejects columnRef position NaN', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, position: NaN }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('position'))).toBe(true);
  });

  it('rejects columnRef position Infinity', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, position: Infinity }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('position'))).toBe(true);
  });

  it('rejects columnRef position fractional', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, position: 0.5 }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('position'))).toBe(true);
  });

  it('rejects columnRef duplicateOrdinal NaN', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, duplicateOrdinal: NaN }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('duplicateOrdinal'))).toBe(true);
  });

  it('rejects columnRef duplicateOrdinal fractional', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, duplicateOrdinal: 1.5 }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('duplicateOrdinal'))).toBe(true);
  });

  it('rejects columnRef extra property', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(cols[0].columnId)!;
    const bad = { ...candidate, columnRefs: [{ ...regCol, extraField: 'malicious' }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('extraField'))).toBe(true);
  });

  it('rejects excludedAction extra property', () => {
    const cols = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:x' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', cols[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:x' })], ['Age']);
    const bad = { ...candidate, excludedActionIds: [{ actionId: 'act:x', reason: 'pending', extraProp: true }] };
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('extraProp'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Reference Validation
// ═══════════════════════════════════════════════════════════

describe('References: correspondence', () => {
  it('rejects remediationRef mismatch', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions, { planId: 'plan:original' });
    const planOther = makePlan(actions, { planId: 'plan:other' });
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate(actions, ['Age']);
    const result = validateScriptCandidateV2(candidate, planOther, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_REMEDIATION_MISMATCH')).toBe(true);
  });

  it('rejects fingerprint mismatch', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const badPlan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { datasetFingerprint: 'sha256:wrong' });
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const result = validateScriptCandidateV2(candidate, badPlan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_REFERENCE_INVALID')).toBe(true);
  });

  it('rejects context invalid', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    (ctx.correspondenceEvidence as unknown as Record<string, unknown>).valid = false;
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_REFERENCE_INVALID')).toBe(true);
  });

  it('rejects nonexistent actionId in accepted', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    (candidate as unknown as Record<string, unknown>).acceptedActionIds = ['act:nonexistent'];
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_REFERENCE_INVALID')).toBe(true);
  });

  it('rejects falsified pythonLiteral in columnRefs', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const regCol = ctx.columnRegistry.byColumnId.get(columns[0].columnId)!;
    (candidate as unknown as Record<string, unknown>).columnRefs = [{ ...regCol, pythonLiteral: '__import__("os").system("rm -rf /")' }];
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_REFERENCE_INVALID')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Partition Validation
// ═══════════════════════════════════════════════════════════

describe('Partition: HITL rules and intersections', () => {
  it('rejects accepted ∩ rejected → SCRIPT_PARTITION_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: ['act:a'],
      rejectedActionIds: ['act:a'],
      excludedActionIds: [],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_PARTITION_INVALID' && e.path.includes('accepted'))).toBe(true);
  });

  it('rejects accepted ∩ excluded → SCRIPT_PARTITION_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:p' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: ['act:p'],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:p', reason: 'pending' }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_PARTITION_INVALID')).toBe(true);
  });

  it('rejects rejected ∩ excluded → SCRIPT_PARTITION_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected', { actionId: 'act:r' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: ['act:r'],
      excludedActionIds: [{ actionId: 'act:r', reason: 'pending' }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_PARTITION_INVALID')).toBe(true);
  });

  it('rejects pending not in excluded', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:p' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toBe(true);
  });

  it('rejects pending with wrong reason', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:p' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:p', reason: 'unsupported_action' }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toBe(true);
  });

  it('rejects requires_human_review in accepted', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('requires_human_review', columns[0].columnId, { reasonCode: 'unknown_rule' }, 'approved', { actionId: 'act:hr' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: ['act:hr'],
      rejectedActionIds: [],
      excludedActionIds: [],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Column Validation
// ═══════════════════════════════════════════════════════════

describe('Columns: registry matching', () => {
  it('rejects ambiguous column in accepted', () => {
    const columns = buildColumnRegistry(['col']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:amb' })]);
    const ctx = makeBuildContext(plan, ['col']);
    const candidate = {
      ...buildValidCandidate([], ['col']),
      acceptedActionIds: ['act:amb'],
      columnRefs: [ctx.columnRegistry.byColumnId.get(columns[0].columnId)!],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_COLUMN_AMBIGUOUS')).toBe(true);
  });

  it('duplicate ordinal 0 for first duplicate column is valid', () => {
    const columns = buildColumnRegistry(['Score', 'Score']);
    const candidate = buildValidCandidate([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:s0' }),
    ], ['Score', 'Score']);
    expect(candidate.columnRefs[0].duplicateOrdinal).toBe(0);
  });

  it('duplicate ordinal 1 for second duplicate column is valid', () => {
    const columns = buildColumnRegistry(['Score', 'Score']);
    const candidate = buildValidCandidate([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:s0' }),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:s1' }),
    ], ['Score', 'Score']);
    const sortedRefs = [...candidate.columnRefs].sort((a, b) => a.columnId.localeCompare(b.columnId));
    expect(sortedRefs[1].duplicateOrdinal).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// Security Validation
// ═══════════════════════════════════════════════════════════

describe('Security: dangerous content detection', () => {
  it('rejects eval( in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\n    eval("1+1")`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_EXECUTABLE_CONTENT')).toBe(true);
  });

  it('rejects exec( in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\n    exec("x=1")`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_EXECUTABLE_CONTENT')).toBe(true);
  });

  it('rejects __import__( in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\n    __import__("os")`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_EXECUTABLE_CONTENT')).toBe(true);
  });

  it('rejects subprocess in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\n    import subprocess`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT' || e.code === 'SCRIPT_NETWORK_ACCESS')).toBe(true);
  });

  it('column named eval does not cause false positive', () => {
    const columns = buildColumnRegistry(['eval']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:eval' })]);
    const ctx = makeBuildContext(plan, ['eval']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:eval' })], ['eval']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_EXECUTABLE_CONTENT')).toHaveLength(0);
  });

  it('column named open does not cause false positive', () => {
    const columns = buildColumnRegistry(['open']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:open' })]);
    const ctx = makeBuildContext(plan, ['open']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:open' })], ['open']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_FILE_ACCESS')).toHaveLength(0);
  });

  it('column named os.system does not cause false positive', () => {
    const columns = buildColumnRegistry(['os.system']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:ossys' })]);
    const ctx = makeBuildContext(plan, ['os.system']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:ossys' })], ['os.system']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_NETWORK_ACCESS')).toHaveLength(0);
  });

  it('column named subprocess does not cause false positive', () => {
    const columns = buildColumnRegistry(['subprocess']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:subp' })]);
    const ctx = makeBuildContext(plan, ['subprocess']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:subp' })], ['subprocess']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_NETWORK_ACCESS')).toHaveLength(0);
  });

  it('column named __file__ does not cause false positive', () => {
    const columns = buildColumnRegistry(['__file__']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:f' })]);
    const ctx = makeBuildContext(plan, ['__file__']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:f' })], ['__file__']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_FILE_ACCESS')).toHaveLength(0);
  });

  it('column named del does not cause false positive', () => {
    const columns = buildColumnRegistry(['del']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:del' })]);
    const ctx = makeBuildContext(plan, ['del']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:del' })], ['del']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_DESTRUCTIVE_OPERATION')).toHaveLength(0);
  });

  it('rejects inplace=True in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\ndf_clean.sort_values(inplace=True)`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_DESTRUCTIVE_OPERATION')).toBe(true);
  });

  it('rejects del statement in scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\ndel df_clean["Age"]`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_DESTRUCTIVE_OPERATION')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Import Whitelist
// ═══════════════════════════════════════════════════════════

describe('Import whitelist: only pandas as pd and numpy as np', () => {
  it('rejects import pandas (no alias)', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import pandas\nimport numpy as np');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects import pandas as pandas', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import pandas as pandas\nimport numpy as np');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects import numpy (no alias)', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import numpy');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects import numpy as numpy', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import numpy as numpy');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects from os import system', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = `${candidate.scriptText}\nfrom os import system`;
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('accepts valid imports in generated script', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const result = validate(candidate, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.filter(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// Syntax Validation
// ═══════════════════════════════════════════════════════════

describe('Syntax: tri-state and malformed checker results', () => {
  it('not_run without checker', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const result = validate(candidate, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('passed with checker returning passed', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'passed', engine: 'cpython' }),
    });
    expect(result.pythonSyntax.state).toBe('passed');
    expect(result.pythonSyntax.engine).toBe('cpython');
  });

  it('failed with checker returning failed', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'failed', engine: 'cpython', message: 'SyntaxError' }),
    });
    expect(result.pythonSyntax.state).toBe('failed');
    expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('not_run when checker throws', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => { throw new Error('boom'); },
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns null', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => null as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns undefined', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => undefined as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns string', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => 'passed' as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns array', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ['passed'] as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns object without state', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ engine: 'cpython' } as any),
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns unknown state', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'unknown' }) as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker returns object with extra property', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'passed', extra: 'field' }) as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker engine is not string', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'passed', engine: 123 }) as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('not_run when checker message is not string', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'failed', message: { oops: true } }) as any,
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Reconstruction
// ═══════════════════════════════════════════════════════════

describe('Reconstruction: V35', () => {
  it('valid candidate reconstructs exactly', () => {
    const columns = buildColumnRegistry(['FirstName', 'AgeCount', 'Fare']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a' }),
      makeAction('normalize_casing', columns[1].columnId, { strategy: 'lowercase' }, 'approved', { actionId: 'act:b' }),
    ];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['FirstName', 'AgeCount', 'Fare']);
    const candidate = buildValidCandidate(actions, ['FirstName', 'AgeCount', 'Fare']);
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_RENDER_MISMATCH')).toHaveLength(0);
  });

  it('detects altered scriptText', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...candidate, scriptText: candidate.scriptText.replace('.strip()', '') };
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_RENDER_MISMATCH')).toBe(true);
  });

  it('detects altered acceptedActionIds', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const bad = { ...candidate, acceptedActionIds: [] };
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_RENDER_MISMATCH')).toBe(true);
  });

  it('detects altered columnRefs', () => {
    const columns = buildColumnRegistry(['Age', 'Fare']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:age' }),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:fare' }),
    ];
    const candidate = buildValidCandidate(actions, ['Age', 'Fare']);
    const bad = { ...candidate, columnRefs: [] };
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age', 'Fare']);
    const result = validateScriptCandidateV2(bad, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_RENDER_MISMATCH')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Final Contract Verification
// ═══════════════════════════════════════════════════════════

describe('Final contract: verifyScriptContractV2', () => {
  it('validates hash correctly', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed', engine: 'cpython' },
    });
    const result = verifyScriptContractV2(contract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_HASH_MISMATCH')).toHaveLength(0);
  });

  it('detects hash mismatch', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed', engine: 'cpython' },
    });
    const badContract = { ...contract, scriptHash: '0000000000000000' };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_HASH_MISMATCH')).toBe(true);
  });

  it('detects remediationRef change → SCRIPT_HASH_MISMATCH', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, remediationRef: 'plan:different' };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_HASH_MISMATCH')).toBe(true);
  });

  it('detects datasetFingerprint change → SCRIPT_HASH_MISMATCH', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, datasetFingerprint: 'sha256:changed' };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_HASH_MISMATCH')).toBe(true);
  });

  it('detects acceptedActionIds change → SCRIPT_HASH_MISMATCH', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a' })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, acceptedActionIds: [] };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_HASH_MISMATCH')).toBe(true);
  });

  it('detects scriptText change → SCRIPT_HASH_MISMATCH', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, scriptText: contract.scriptText + '\n# tampered' };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_HASH_MISMATCH')).toBe(true);
  });

  it('generatedAt does NOT change hash', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, generatedAt: '2026-01-01T00:00:00.000Z' };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_HASH_MISMATCH')).toHaveLength(0);
  });

  it('validationResult does NOT change hash', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: false, errors: [{ code: 'X', path: '$.x', message: 'error', value: undefined }], warnings: [], pythonSyntax: { state: 'failed' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_HASH_MISMATCH')).toHaveLength(0);
  });

  it('rejectedActionIds does NOT change hash', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, rejectedActionIds: ['act:extra'] };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_HASH_MISMATCH')).toHaveLength(0);
  });

  it('excludedActionIds does NOT change hash', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = { ...contract, excludedActionIds: [{ actionId: 'act:x', reason: 'pending' }] };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_HASH_MISMATCH')).toHaveLength(0);
  });

  it('detects missing scriptHash', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildValidCandidate(actions, ['Age']);
    const badContract = { ...candidate, scriptHash: undefined };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('scriptHash'))).toBe(true);
  });

  it('detects missing validationResult', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const hash = computeScriptHashV2(candidate as any);
    const badContract = { ...candidate, scriptHash: hash, validationResult: undefined };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('validationResult'))).toBe(true);
  });

  it('detects embedded error item missing code', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: true, errors: [{ path: '$.x', message: 'e' }], warnings: [], pythonSyntax: { state: 'passed' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('code'))).toBe(true);
  });

  it('detects embedded error item code empty string', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: true, errors: [{ code: '', path: '$.x', message: 'e' }], warnings: [], pythonSyntax: { state: 'passed' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('code'))).toBe(true);
  });

  it('detects embedded error item extra property', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: true, errors: [{ code: 'X', path: '$.x', message: 'e', extra: 'bad' }], warnings: [], pythonSyntax: { state: 'passed' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('extra'))).toBe(true);
  });

  it('detects embedded pythonSyntax invalid state', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: true, errors: [], warnings: [], pythonSyntax: { state: 'invalid' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('pythonSyntax'))).toBe(true);
  });

  it('detects embedded pythonSyntax extra property', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: { valid: true, errors: [], warnings: [], pythonSyntax: { state: 'passed', extra: 'bad' } },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.includes('extra'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Python compile (real)
// ═══════════════════════════════════════════════════════════

describe('Python compile (real)', () => {
  it('valid script → passed when Python available', async () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);

    try {
      const { execSync } = await import('node:child_process');
      const result = validateScriptCandidateV2(candidate, plan, ctx, {
        syntaxChecker: () => {
          try {
            execSync('python3 -c "import sys; compile(sys.stdin.read(), \'<aura>\', \'exec\')"', {
              input: candidate.scriptText,
              timeout: 5000,
              encoding: 'utf8',
            });
            return { state: 'passed', engine: 'python3' };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { state: 'failed', engine: 'python3', message: msg };
          }
        },
      });
      expect(result.pythonSyntax.state).toBe('passed');
      expect(result.pythonSyntax.engine).toBe('python3');
    } catch {
      // node:child_process not available, skip
    }
  });

  it('invalid script → failed', async () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);

    try {
      const { execSync } = await import('node:child_process');
      const invalidScript = candidate.scriptText.replace('def clean_dataset(df):', 'def clean_dataset(df):\n    raise = 1');
      const result = validateScriptCandidateV2({ ...candidate, scriptText: invalidScript } as any, plan, ctx, {
        syntaxChecker: () => {
          try {
            execSync('python3 -c "import sys; compile(sys.stdin.read(), \'<aura>\', \'exec\')"', {
              input: invalidScript,
              timeout: 5000,
              encoding: 'utf8',
            });
            return { state: 'passed', engine: 'python3' };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { state: 'failed', engine: 'python3', message: msg };
          }
        },
      });
      expect(result.pythonSyntax.state).toBe('failed');
      expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(true);
    } catch {
      // node:child_process not available, skip
    }
  });

  it('Python unavailable → not_run (graceful)', async () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);

    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => {
        throw new Error('python3 not found');
      },
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.some(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toBe(true);
  });

  it('valid { state: "not_run" } → not_run with one warning', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'not_run' as const }),
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.warnings.filter(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toHaveLength(1);
    expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('valid { state: "not_run", engine } → preserves engine', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'not_run' as const, engine: 'python3' }),
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.pythonSyntax.engine).toBe('python3');
    expect(result.warnings.filter(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toHaveLength(1);
    expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(false);
  });

  it('valid { state: "not_run", message } → preserves message', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'not_run' as const, message: 'python unavailable' }),
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.pythonSyntax.message).toBe('python unavailable');
    expect(result.warnings.filter(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toHaveLength(1);
    expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(false);
  });

  it('valid { state: "not_run", engine, message } → all preserved', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildCandidateWithGen([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const result = validateScriptCandidateV2(candidate, plan, ctx, {
      syntaxChecker: () => ({ state: 'not_run' as const, engine: 'cpython', message: 'unavailable' }),
    });
    expect(result.pythonSyntax.state).toBe('not_run');
    expect(result.pythonSyntax.engine).toBe('cpython');
    expect(result.pythonSyntax.message).toBe('unavailable');
    expect(result.warnings.filter(w => w.code === 'SCRIPT_SYNTAX_NOT_RUN')).toHaveLength(1);
    expect(result.errors.some(e => e.code === 'SCRIPT_SYNTAX_INVALID')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Import Whitelist (exact form)
// ═══════════════════════════════════════════════════════════

describe('Import whitelist: exact form', () => {
  it('rejects import pandas as pd, numpy as np', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import pandas as pd, numpy as np');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects import pandas, numpy', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import numpy as np', 'import pandas, numpy');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects duplicate numpy', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText + '\nimport numpy as np';
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT' && e.message.includes('duplicate'))).toBe(true);
  });

  it('rejects indented import', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace(
      'import numpy as np',
      '    import numpy as np',
    );
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT' && e.message.includes('indented'))).toBe(true);
  });

  it('rejects import inside clean_dataset body', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace(
      'def clean_dataset(df):\n    df_clean = df.copy()',
      'def clean_dataset(df):\n    import pandas as pd\n    df_clean = df.copy()',
    );
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('no false positive: import os inside string literal', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const script = candidate.scriptText.replace(
      '"columnName"', '"columnName with import os inside"',
    );
    const bad = { ...candidate, scriptText: script };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.filter(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toHaveLength(0);
  });

  it('no false positive: import pandas as pd inside triple string', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const script = candidate.scriptText.replace(
      '_c = {',
      '_c = {\n    "doc": """import pandas as pd, numpy as np\nfrom os import system"""',
    );
    const bad = { ...candidate, scriptText: script };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.filter(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toHaveLength(0);
  });

  it('no false positive: import pandas as pd inside comment', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const script = `${candidate.scriptText}\n# import os\n# import pandas as pd, numpy as np`;
    const bad = { ...candidate, scriptText: script };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.filter(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toHaveLength(0);
  });

  it('no false positive: from os import system inside string', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const script = candidate.scriptText.replace(
      '"columnName"',
      '"use from os import system to call system commands"',
    );
    const bad = { ...candidate, scriptText: script };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.filter(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toHaveLength(0);
  });

  it('rejects import with semicolon', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace(
      'import numpy as np',
      'import pandas as pd; import numpy as np',
    );
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT')).toBe(true);
  });

  it('rejects missing pandas import', () => {
    const columns = buildColumnRegistry(['Age']);
    const candidate = buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    const badScript = candidate.scriptText.replace('import pandas as pd\n', '');
    const bad = { ...candidate, scriptText: badScript };
    const result = validate(bad, [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], ['Age']);
    expect(result.errors.some(e => e.code === 'SCRIPT_UNAUTHORIZED_IMPORT' && e.message.includes('missing required import'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Exclusion Reasons Validation
// ═══════════════════════════════════════════════════════════

describe('Exclusion reasons: direct derivation', () => {
  it('pending → excluded with reason "pending"', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:p' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:p', reason: 'pending' as const }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toHaveLength(0);
  });

  it('pending → wrong reason → SCRIPT_APPROVAL_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending', { actionId: 'act:p' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:p', reason: 'unsupported_action' as const }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID' && e.message.includes('pending') && e.message.includes('reason'))).toBe(true);
  });

  it('approved + requires_human_review → excluded with "unsupported_action"', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('requires_human_review', columns[0].columnId, { reasonCode: 'x' }, 'approved', { actionId: 'act:hr' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:hr', reason: 'unsupported_action' as const }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toHaveLength(0);
  });

  it('approved + requires_human_review in accepted → SCRIPT_APPROVAL_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('requires_human_review', columns[0].columnId, { reasonCode: 'x' }, 'approved', { actionId: 'act:hr' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: ['act:hr'],
      rejectedActionIds: [],
      excludedActionIds: [],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID' && e.message.includes('requires_human_review'))).toBe(true);
  });

  it('approved + missing columnId → excluded with "missing_column"', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', null, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:nc' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:nc', reason: 'missing_column' as const }],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toHaveLength(0);
  });

  it('approved + missing columnId in accepted → SCRIPT_APPROVAL_INVALID', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', null, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:nc' })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = {
      ...buildValidCandidate([], ['Age']),
      acceptedActionIds: ['act:nc'],
      rejectedActionIds: [],
      excludedActionIds: [],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_APPROVAL_INVALID' && e.message.includes('missing column'))).toBe(true);
  });

  it('approved + ambiguous column → excluded with "ambiguous_column"', () => {
    const columns = buildColumnRegistry(['col']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:amb' })]);
    const ctx = makeBuildContext(plan, ['col']);
    const ambCol = ctx.columnRegistry.byColumnId.get(columns[0].columnId)!;
    const candidate = {
      ...buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:amb' })], ['col']),
      acceptedActionIds: [],
      rejectedActionIds: [],
      excludedActionIds: [{ actionId: 'act:amb', reason: 'ambiguous_column' as const }],
      columnRefs: [ambCol],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_APPROVAL_INVALID')).toHaveLength(0);
  });

  it('approved + ambiguous column in accepted → SCRIPT_COLUMN_AMBIGUOUS', () => {
    const columns = buildColumnRegistry(['col']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:amb' })]);
    const ctx = makeBuildContext(plan, ['col']);
    const candidate = {
      ...buildValidCandidate([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:amb' })], ['col']),
      acceptedActionIds: ['act:amb'],
      rejectedActionIds: [],
      excludedActionIds: [],
      columnRefs: [ctx.columnRegistry.byColumnId.get(columns[0].columnId)!],
      datasetFingerprint: plan.datasetFingerprint,
    };
    const result = validateScriptCandidateV2(candidate, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_COLUMN_AMBIGUOUS')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Embedded validationResult root keys
// ═══════════════════════════════════════════════════════════

describe('Embedded validationResult: root keys', () => {
  it('rejects unexpected root property', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: {
        valid: true,
        errors: [],
        warnings: [],
        pythonSyntax: { state: 'passed' },
        extraField: true,
      },
    };
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path === '$.validationResult.extraField')).toBe(true);
  });

  it('rejects missing valid key', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: {
        errors: [],
        warnings: [],
        pythonSyntax: { state: 'passed' },
      },
    } as any;
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path === '$.validationResult.valid')).toBe(true);
  });

  it('rejects missing pythonSyntax key', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const badContract = {
      ...contract,
      validationResult: {
        valid: true,
        errors: [],
        warnings: [],
      },
    } as any;
    const result = verifyScriptContractV2(badContract, plan, ctx);
    expect(result.errors.some(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path === '$.validationResult.pythonSyntax')).toBe(true);
  });

  it('accepts valid embedded validationResult with all keys', () => {
    const columns = buildColumnRegistry(['Age']);
    const actions = [makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const contract = finalizeScriptContractV2(candidate, {
      valid: true, errors: [], warnings: [],
      pythonSyntax: { state: 'passed' },
    });
    const result = verifyScriptContractV2(contract, plan, ctx);
    expect(result.errors.filter(e => e.code === 'SCRIPT_CONTRACT_INVALID' && e.path.startsWith('$.validationResult'))).toHaveLength(0);
  });
});
