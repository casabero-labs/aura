/**
 * Script Builder v2 Tests — Phase 4 Loop 3.
 *
 * Comprehensive tests for candidate builder, hash, and finalizer.
 * Coverage: candidate, partition, columns, context, renderer, reconstruction, hash, finalizer.
 */

import { describe, it, expect } from 'vitest';
import { buildColumnRegistry } from '../contracts/llm/columnRegistry';
import { buildColumnRegistryV2 } from '../contracts/llm/scriptColumnResolver';
import { buildScriptContext } from '../contracts/llm/scriptBuildContext';
import { sha256hex, setForcePureJS } from '../contracts/llm/hash';
import { canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import {
  SCRIPT_CONTRACT_VERSION,
  CLEAN_DATASET_FN,
  buildScriptCandidateCoreV2,
  buildScriptCandidateV2,
  buildScriptHashPayloadV2,
  computeScriptHashV2,
  finalizeScriptContractV2,
  ScriptBuilderError,
} from '../contracts/llm/scriptBuilderV2';
import { SCRIPT_RENDERER_VERSION } from '../contracts/llm/scriptRendererV2';
import { PLACEHOLDER_VOCABULARY_VERSION } from '../contracts/llm/placeholderVocabulary';
import type {
  ColumnRef,
  RemediationPlanV2,
  RemediationActionV2,
  ScriptBuildContextV2,
  ScriptValidationResultV2,
} from '../contracts/llm/types';

// ── Fixtures ──

function makeAction(
  actionType: RemediationActionV2['actionType'],
  columnId: string | null,
  params: Record<string, unknown>,
  approvalStatus: 'approved' | 'pending' | 'rejected' = 'approved',
  overrides: Partial<RemediationActionV2> = {},
): RemediationActionV2 {
  return {
    actionId: overrides.actionId ?? `act:test_${actionType}_${columnId ?? 'null'}_${Math.random().toString(36).slice(2, 8)}`,
    issueId: 'issue:test',
    ruleId: 'rule:test',
    columnId,
    actionType,
    parameters: params as RemediationActionV2['parameters'],
    actionability: 'auto_safe',
    evidenceRefs: [],
    approvalStatus,
    ...overrides,
  };
}

function makePlan(
  actions: RemediationActionV2[],
  overrides: Partial<RemediationPlanV2> = {},
): RemediationPlanV2 {
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

function makeBuildContext(
  plan: RemediationPlanV2,
  columns: string[],
): ScriptBuildContextV2 {
  const columnRefs = buildColumnRegistry(columns);
  return buildScriptContext(
    {
      evidenceEnvelopeRef: plan.evidenceEnvelopeRef,
      datasetFingerprint: plan.datasetFingerprint,
      columns: columnRefs.map(c => ({
        columnId: c.columnId,
        name: c.name,
        position: c.position,
        duplicateOrdinal: c.duplicateOrdinal,
        isAmbiguous: c.isAmbiguous,
        isDuplicate: c.isDuplicate,
      })),
      issues: [],
    },
    columnRefs,
    plan.datasetFingerprint,
  );
}

function makeValidValidationResult(
  syntaxState: 'passed' | 'failed' | 'not_run' = 'passed',
): ScriptValidationResultV2 {
  return {
    valid: syntaxState !== 'failed',
    errors: [],
    warnings: [],
    pythonSyntax: {
      state: syntaxState,
      engine: 'cpython',
    },
  };
}

// ── Version ──

describe('SCRIPT_CONTRACT_VERSION', () => {
  it('is 2.0.0', () => {
    expect(SCRIPT_CONTRACT_VERSION).toBe('2.0.0');
  });
});

describe('CLEAN_DATASET_FN', () => {
  it('is clean_dataset', () => {
    expect(CLEAN_DATASET_FN).toBe('clean_dataset');
  });
});

// ── Candidate: Zero Actions ──

describe('Candidate: zero actions', () => {
  it('produces valid no-op script', () => {
    const actions: RemediationActionV2[] = [];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toEqual([]);
    expect(candidate.rejectedActionIds).toEqual([]);
    expect(candidate.excludedActionIds).toEqual([]);
    expect(candidate.scriptText).toContain('def clean_dataset(df):');
    expect(candidate.scriptText).toContain('return df_clean');
    expect(candidate.scriptText.endsWith('\n')).toBe(true);
    expect(candidate.cleanDatasetFn).toBe('clean_dataset');
  });
});

// ── Candidate: One Approved ──

describe('Candidate: one approved action', () => {
  it('renders a single trim_whitespace', () => {
    const columns = buildColumnRegistry(['FirstName', 'Age']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Age']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(1);
    expect(candidate.rejectedActionIds).toHaveLength(0);
    expect(candidate.excludedActionIds).toHaveLength(0);
    expect(candidate.scriptText).toContain('.str.strip()');
    expect(candidate.columnRefs).toHaveLength(1);
  });
});

// ── Candidate: Multiple Actions ──

describe('Candidate: multiple actions', () => {
  it('mix approved/rejected/pending', () => {
    const columns = buildColumnRegistry(['FirstName', 'AgeCount', 'Fare', 'Score']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected'),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending'),
      makeAction('normalize_casing', columns[3].columnId, { strategy: 'lowercase' }, 'approved'),
    ];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['FirstName', 'AgeCount', 'Fare', 'Score']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(2);
    expect(candidate.rejectedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds[0].reason).toBe('pending');
  });

  it('all approved', () => {
    const columns = buildColumnRegistry(['FirstName', 'AgeCount', 'Fare']);
    const actions = columns.map(c =>
      makeAction('trim_whitespace', c.columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    );
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['FirstName', 'AgeCount', 'Fare']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(3);
    expect(candidate.rejectedActionIds).toHaveLength(0);
    expect(candidate.excludedActionIds).toHaveLength(0);
  });
});

// ── Partition ──

describe('Partition: exclusion rules', () => {
  it('rejected only in rejectedActionIds', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.rejectedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds).toHaveLength(0);
    expect(candidate.acceptedActionIds).toHaveLength(0);
  });

  it('pending only in excludedActionIds', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds[0].reason).toBe('pending');
    expect(candidate.acceptedActionIds).toHaveLength(0);
    expect(candidate.rejectedActionIds).toHaveLength(0);
  });

  it('requires_human_review goes to excluded (unsupported_action)', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('requires_human_review', columns[0].columnId, { reasonCode: 'unknown_rule' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds[0].reason).toBe('unsupported_action');
    expect(candidate.acceptedActionIds).toHaveLength(0);
  });

  it('missing column goes to excluded (missing_column)', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('trim_whitespace', 'col:nonexistent', { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds[0].reason).toBe('missing_column');
  });

  it('ambiguous column goes to excluded (ambiguous_column)', () => {
    const columns = buildColumnRegistry(['col']); // 'col' is ambiguous
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['col']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds[0].reason).toBe('ambiguous_column');
  });

  it('exact coverage of all plan actions', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected'),
      makeAction('normalize_casing', columns[1].columnId, { strategy: 'lowercase' }, 'pending'),
    ];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    const covered = candidate.acceptedActionIds.length + candidate.rejectedActionIds.length + candidate.excludedActionIds.length;
    expect(covered).toBe(3);
  });

  it('disjoint sets', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare', 'Score']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected'),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'pending'),
    ];
    const plan = makePlan(actions);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare', 'Score']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    const accepted = new Set(candidate.acceptedActionIds);
    const rejected = new Set(candidate.rejectedActionIds);
    const excluded = new Set(candidate.excludedActionIds.map(e => e.actionId));
    for (const id of accepted) {
      expect(rejected.has(id)).toBe(false);
      expect(excluded.has(id)).toBe(false);
    }
    for (const id of rejected) {
      expect(accepted.has(id)).toBe(false);
      expect(excluded.has(id)).toBe(false);
    }
    for (const id of excluded) {
      expect(accepted.has(id)).toBe(false);
      expect(rejected.has(id)).toBe(false);
    }
  });

  it('rejects duplicate actionId', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const sameId = 'act:duplicate';
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: sameId }),
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: sameId }),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    expect(() => buildScriptCandidateCoreV2(plan, ctx)).toThrow(ScriptBuilderError);
  });
});

// ── Columns ──

describe('Columns: resolution and refs', () => {
  it('duplicate columns accepted (ordinal 0 and 1)', () => {
    const columns = buildColumnRegistry(['Score', 'Score']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['Score', 'Score']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(2);
  });

  it('columnRefs deduplicated', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('normalize_casing', columns[0].columnId, { strategy: 'lowercase' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.columnRefs).toHaveLength(1);
  });

  it('columnRefs sorted by columnId', () => {
    const columns = buildColumnRegistry(['Fare', 'Age', 'Score']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['Fare', 'Age', 'Score']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    const ids = candidate.columnRefs.map(c => c.columnId);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('no name resolution (byName never used)', () => {
    const columns = buildColumnRegistry(['FirstName']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.columnRefs[0].name).toBe('FirstName');
  });

  it('drop_exact_duplicates uses null columnRef', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([
      makeAction('drop_exact_duplicates', null, { keep: 'first' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(1);
    expect(candidate.columnRefs).toHaveLength(0); // no column for drop
  });
});

// ── Context Validation ──

describe('Context: preconditions', () => {
  it('rejects correspondenceEvidence.valid=false', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    (ctx as unknown as { correspondenceEvidence: { valid: boolean } }).correspondenceEvidence.valid = false;
    expect(() => buildScriptCandidateCoreV2(plan, ctx)).toThrow(ScriptBuilderError);
  });

  it('rejects fingerprint mismatch', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { datasetFingerprint: 'sha256:mismatch' });
    const ctx = makeBuildContext(makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]), ['Age']);
    expect(() => buildScriptCandidateCoreV2(plan, ctx)).toThrow(ScriptBuilderError);
  });

  it('rejects evidenceEnvelopeRef mismatch', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { evidenceEnvelopeRef: 'env:mismatch' });
    const ctx = makeBuildContext(
      makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]),
      ['Age'],
    );
    expect(() => buildScriptCandidateCoreV2(plan, ctx)).toThrow(ScriptBuilderError);
  });

  it('rejects empty planId', () => {
    const plan = makePlan([], { planId: '' });
    const ctx = makeBuildContext(plan, ['Age']);
    expect(() => buildScriptCandidateCoreV2(plan, ctx)).toThrow(ScriptBuilderError);
  });
});

// ── Renderer Integration ──

describe('Renderer integration', () => {
  it('builder passes to renderer correctly', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('drop_exact_duplicates', null, { keep: 'first' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.scriptText).toContain('.str.strip()');
    expect(candidate.scriptText).toContain('drop_duplicates');
  });

  it('excluded actions not in scriptText', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('requires_human_review', columns[1].columnId, { reasonCode: 'unknown_rule' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    expect(candidate.acceptedActionIds).toHaveLength(1);
    expect(candidate.excludedActionIds).toHaveLength(1);
    expect(candidate.scriptText).not.toContain('AURA review-only');
  });

  it('order preserved in script', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare', 'Score']);
    const plan = makePlan([
      makeAction('normalize_casing', columns[0].columnId, { strategy: 'lowercase' }, 'approved'),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: true }, 'approved'),
      makeAction('normalize_placeholders', columns[2].columnId, { strategy: 'controlled_vocabulary', replacement: null }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare', 'Score']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    const lowerPos = candidate.scriptText.indexOf('str.lower()');
    const replacePos = candidate.scriptText.indexOf('str.replace');
    const nanPos = candidate.scriptText.indexOf('np.nan');
    expect(lowerPos).not.toBe(-1);
    expect(replacePos).not.toBe(-1);
    expect(nanPos).not.toBe(-1);
    expect(lowerPos).toBeLessThan(replacePos);
    expect(replacePos).toBeLessThan(nanPos);
  });
});

// ── Reconstruction ──

describe('Reconstruction: determinism', () => {
  it('same plan/context produces same core 3 times', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
      makeAction('normalize_casing', columns[1].columnId, { strategy: 'lowercase' }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare']);
    const core1 = buildScriptCandidateCoreV2(plan, ctx);
    const core2 = buildScriptCandidateCoreV2(plan, ctx);
    const core3 = buildScriptCandidateCoreV2(plan, ctx);
    expect(JSON.stringify(core1)).toBe(JSON.stringify(core2));
    expect(JSON.stringify(core2)).toBe(JSON.stringify(core3));
  });

  it('different generatedAt does not change core', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate1 = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const candidate2 = buildScriptCandidateV2(plan, ctx, { generatedAt: '2026-06-25T12:00:00.000Z' });
    expect(candidate1.generatedAt).not.toBe(candidate2.generatedAt);
    // Core comparison (without generatedAt)
    const { generatedAt: _, ...core1 } = candidate1;
    const { generatedAt: __, ...core2 } = candidate2;
    expect(JSON.stringify(core1)).toBe(JSON.stringify(core2));
  });
});

// ── Hash ──

describe('Hash: stability and sensitivity', () => {
  function buildCandidate(planActions: RemediationActionV2[], columns: string[]): ReturnType<typeof buildScriptCandidateCoreV2> {
    const plan = makePlan(planActions);
    const ctx = makeBuildContext(plan, columns);
    return buildScriptCandidateCoreV2(plan, ctx);
  }

  it('hash stable across 3 executions', () => {
    const columns = buildColumnRegistry(['Age']);
    const action = makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false });
    const h1 = computeScriptHashV2(buildCandidate([action], ['Age']));
    const h2 = computeScriptHashV2(buildCandidate([action], ['Age']));
    const h3 = computeScriptHashV2(buildCandidate([action], ['Age']));
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('hash same with different generatedAt', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const c1 = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const c2 = buildScriptCandidateV2(plan, ctx, { generatedAt: '2026-06-25T12:00:00.000Z' });
    expect(computeScriptHashV2(c1)).toBe(computeScriptHashV2(c2));
  });

  it('hash same with different rejectedActionIds only', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare', 'Score']);
    const actions = [
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:a' }),
      makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved', { actionId: 'act:b' }),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected', { actionId: 'act:c' }),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected', { actionId: 'act:d' }),
    ];
    const planAllRejected = makePlan(actions);
    const ctx = makeBuildContext(planAllRejected, ['FirstName', 'Fare', 'Score']);
    const c1 = buildScriptCandidateCoreV2(planAllRejected, ctx);
    // Hash payload should be identical since rejectedActionIds are excluded
    // Verify: the hash does NOT include rejectedActionIds
    const payload = buildScriptHashPayloadV2(c1);
    expect(payload.acceptedActionIds).toHaveLength(2);
    expect((payload as unknown as Record<string, unknown>).rejectedActionIds).toBeUndefined();

    // Same hash when only excludedActionIds change
    const actions2 = [
      ...actions.slice(0, 2),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected', { actionId: 'act:e' }),
      makeAction('trim_whitespace', columns[2].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'rejected', { actionId: 'act:f' }),
    ];
    const planDiffRejected = makePlan(actions2);
    const c2 = buildScriptCandidateCoreV2(planDiffRejected, ctx);
    expect(computeScriptHashV2(c1)).toBe(computeScriptHashV2(c2));
  });

  it('hash changes when acceptedActionIds change', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const plan1 = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved')]);
    const plan2 = makePlan([makeAction('trim_whitespace', columns[1].columnId, { trimEdges: true, collapseInternalWhitespace: true }, 'approved')]);
    const ctx1 = makeBuildContext(plan1, ['FirstName', 'Fare']);
    const ctx2 = makeBuildContext(plan2, ['FirstName', 'Fare']);
    expect(computeScriptHashV2(buildScriptCandidateCoreV2(plan1, ctx1))).not.toBe(computeScriptHashV2(buildScriptCandidateCoreV2(plan2, ctx2)));
  });

  it('hash changes when columnRefs change', () => {
    const columns = buildColumnRegistry(['FirstName', 'Fare']);
    const plan = makePlan([
      makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false }, 'approved'),
    ]);
    const ctx = makeBuildContext(plan, ['FirstName', 'Fare']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);
    const hash1 = computeScriptHashV2(candidate);
    // Mutate columnRefs
    const altered = { ...candidate, columnRefs: [] };
    const hash2 = computeScriptHashV2(altered);
    expect(hash1).not.toBe(hash2);
  });

  it('hash changes when remediationRef changes', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan1 = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { planId: 'plan:aaa' });
    const plan2 = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { planId: 'plan:bbb' });
    const ctx1 = makeBuildContext(plan1, ['Age']);
    const ctx2 = makeBuildContext(plan2, ['Age']);
    expect(computeScriptHashV2(buildScriptCandidateCoreV2(plan1, ctx1))).not.toBe(computeScriptHashV2(buildScriptCandidateCoreV2(plan2, ctx2)));
  });

  it('hash changes when datasetFingerprint changes', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan1 = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { datasetFingerprint: 'sha256:aaa' });
    const plan2 = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })], { datasetFingerprint: 'sha256:bbb' });
    const ctx1 = makeBuildContext(plan1, ['Age']);
    const ctx2 = makeBuildContext(plan2, ['Age']);
    expect(computeScriptHashV2(buildScriptCandidateCoreV2(plan1, ctx1))).not.toBe(computeScriptHashV2(buildScriptCandidateCoreV2(plan2, ctx2)));
  });

  it('hash with Node vs pure JS produces same result', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateCoreV2(plan, ctx);

    // Force pure JS
    setForcePureJS(true);
    const pureJsHash = computeScriptHashV2(candidate);

    // Reset
    setForcePureJS(false);
    const nodeHash = computeScriptHashV2(candidate);

    expect(pureJsHash).toBe(nodeHash);
  });
});

// ── generatedAt ──

describe('generatedAt', () => {
  it('uses fixed generatedAt', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-06-01T00:00:00.000Z' });
    expect(candidate.generatedAt).toBe('2025-06-01T00:00:00.000Z');
  });

  it('auto-generates valid generatedAt', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx);
    expect(new Date(candidate.generatedAt).getTime()).not.toBeNaN();
  });

  it('rejects invalid generatedAt', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    expect(() => buildScriptCandidateV2(plan, ctx, { generatedAt: 'not-a-date' })).toThrow(ScriptBuilderError);
  });
});

// ── Finalizer ──

describe('Finalizer', () => {
  let columns: ColumnRef[];
  let plan: RemediationPlanV2;
  let ctx: ScriptBuildContextV2;

  beforeEach(() => {
    columns = buildColumnRegistry(['Age']);
    plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    ctx = makeBuildContext(plan, ['Age']);
  });

  it('valid=true + syntax passed', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = makeValidValidationResult('passed');
    const contract = finalizeScriptContractV2(candidate, vr);
    expect(contract.scriptHash).toBeTruthy();
    expect(contract.validationResult).toBe(vr);
    expect(contract.generatedAt).toBe(candidate.generatedAt);
  });

  it('valid=true + syntax not_run', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = makeValidValidationResult('not_run');
    const contract = finalizeScriptContractV2(candidate, vr);
    expect(contract.scriptHash).toBeTruthy();
    expect(contract.validationResult).toBe(vr);
  });

  it('valid=false rejected', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = { ...makeValidValidationResult('passed'), valid: false };
    expect(() => finalizeScriptContractV2(candidate, vr)).toThrow(ScriptBuilderError);
  });

  it('syntax failed rejected', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = { ...makeValidValidationResult('failed'), valid: true };
    expect(() => finalizeScriptContractV2(candidate, vr)).toThrow(ScriptBuilderError);
  });

  it('validationResult absent via null cast', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    expect(() => finalizeScriptContractV2(candidate, null as unknown as ScriptValidationResultV2)).toThrow(ScriptBuilderError);
  });

  it('hash matches recomputation', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = makeValidValidationResult('passed');
    const contract = finalizeScriptContractV2(candidate, vr);
    expect(contract.scriptHash).toBe(computeScriptHashV2(candidate));
  });

  it('candidate not mutated by finalizer', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const candidateJson = JSON.stringify(candidate);
    finalizeScriptContractV2(candidate, makeValidValidationResult('passed'));
    expect(JSON.stringify(candidate)).toBe(candidateJson);
  });

  it('final contract has all required fields', () => {
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    const vr = makeValidValidationResult('passed');
    const contract = finalizeScriptContractV2(candidate, vr);
    expect(contract.contractId).toBe('aura.script.v2');
    expect(contract.contractVersion).toBe('2.0.0');
    expect(contract.remediationRef).toBe(plan.planId);
    expect(contract.datasetFingerprint).toBe(plan.datasetFingerprint);
    expect(contract.scriptText).toBeTruthy();
    expect(contract.cleanDatasetFn).toBe('clean_dataset');
    expect(contract.scriptHash).toBeTruthy();
    expect(contract.validationResult).toBeDefined();
    expect(contract.generatedAt).toBe(candidate.generatedAt);
    expect(contract.acceptedActionIds).toBeDefined();
    expect(contract.rejectedActionIds).toBeDefined();
    expect(contract.excludedActionIds).toBeDefined();
    expect(contract.columnRefs).toBeDefined();
  });
});

// ── Candidate Shape ──

describe('Candidate shape', () => {
  it('core has no scriptHash', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const core = buildScriptCandidateCoreV2(plan, ctx);
    expect((core as unknown as Record<string, unknown>).scriptHash).toBeUndefined();
  });

  it('core has no validationResult', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const core = buildScriptCandidateCoreV2(plan, ctx);
    expect((core as unknown as Record<string, unknown>).validationResult).toBeUndefined();
  });

  it('candidate has no scriptHash', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    expect((candidate as unknown as Record<string, unknown>).scriptHash).toBeUndefined();
  });

  it('candidate has rendererVersion and placeholderVocabularyVersion', () => {
    const columns = buildColumnRegistry(['Age']);
    const plan = makePlan([makeAction('trim_whitespace', columns[0].columnId, { trimEdges: true, collapseInternalWhitespace: false })]);
    const ctx = makeBuildContext(plan, ['Age']);
    const candidate = buildScriptCandidateV2(plan, ctx, { generatedAt: '2025-01-01T00:00:00.000Z' });
    expect(candidate.rendererVersion).toBe(SCRIPT_RENDERER_VERSION);
    expect(candidate.placeholderVocabularyVersion).toBe(PLACEHOLDER_VOCABULARY_VERSION);
    expect(candidate.cleanDatasetFn).toBe(CLEAN_DATASET_FN);
  });
});
