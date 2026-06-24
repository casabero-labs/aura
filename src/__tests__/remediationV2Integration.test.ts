/**
 * Remediation v2 — Full Integration Tests.
 *
 * Tests the complete v2 flow without Ollama:
 * 1. Envelope → Diagnosis fixture → DiagnosisExecutionResult (with context)
 * 2. buildRemediationPlanV2 produces deterministic plan
 * 3. Validator rejects all tampering attempts
 * 4. Plan lifecycle (clear on new diagnosis, validate restored)
 * 5. v2 never calls AI functions
 * 6. Exported buildRemediationPlanId is used by both builder and validator
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../contracts/llm/contractRegistry', () => ({ isContractsV2Enabled: vi.fn().mockReturnValue(true) }));

import { buildRemediationPlanV2, buildRemediationPlanId, computeEffectiveActionability } from '../contracts/llm/remediationBuilderV2';
import { validateRemediationPlanV2 } from '../contracts/llm/remediationValidatorV2';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import { buildRemediationContext, buildDiagnosisRef } from '../contracts/llm/remediationContextV2';
import type { DiagnosisExecutionResult, RemediationPlanV2, Actionability } from '../contracts/llm';

function buildFixture(): { diagExec: DiagnosisExecutionResult; plan: RemediationPlanV2 } {
  const report = {
    score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
    issues: [
      { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene', ruleName: 'Espacios Fantasma', description: 'ws', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' } },
      { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos', description: 'nulls', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null], ruleId: 'rule:null-values', automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto' } },
      { id: 'integrity-exactdup', column: null, category: 'Integridad', ruleName: 'Duplicados Exactos', description: 'dup', severity: 'info', count: 0, affectedPercentage: 0, sampleValues: [], ruleId: 'rule:drop-exact-duplicates', automaticAuthorization: { actionType: 'drop_exact_duplicates', authorized: true, conditionsMet: [], reason: 'Deterministic' } },
    ],
    columnStats: {
      Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
      Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
    },
    datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
  } as Parameters<typeof _buildEvidenceEnvelopeV2>[0];

  const env = _buildEvidenceEnvelopeV2(report, { privacyLevel: 'local_full', datasetSha256: 'abc123', delimiter: ',' });
  const pp = buildDiagnosisPromptV2(env);
  const ctx = buildRemediationContext(env);
  ctx.evidenceEnvelopeRef = pp.evidenceEnvelopeRef;
  ctx.datasetFingerprint = 'abc123';

  const diagExec: DiagnosisExecutionResult = {
    version: 2,
    diagnosis: {
      contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
      evidenceEnvelopeRef: pp.evidenceEnvelopeRef, responseId: 'diag-fixture',
      issues: env.issues.map((iss) => ({
        issueId: iss.issueId,
        evidenceRefs: iss.evidenceRefs || [],
        hypothesis: `Auto-generated from ${iss.ruleName || iss.ruleId}`,
        confidence: 0.5,
        requiresHumanReview: iss.actionability === 'review_only' || !iss.automaticAuthorization?.authorized,
        limits: ['Deterministic fixture — no LLM'],
      })),
      diagnosisBlocks: env.issues.map(iss => ({
        issueId: iss.issueId,
        ruleId: iss.ruleId,
        columnId: iss.columnId || null,
        scope: iss.scope || 'column',
        observation: `${iss.ruleName || iss.ruleId}: ${iss.count} affected`,
        recommendation: 'Review this issue',
      })),
      limitations: ['Deterministic fixture — no model inference'],
      generatedAt: new Date().toISOString(),
    },
    metrics: { latencyMs: 0, tokensGenerated: 0, model: 'fixture', provider: 'test', isLocal: true },
    promptHash: 'h-fix', evidenceEnvelopeRef: pp.evidenceEnvelopeRef, promptVersion: '1', rawResponseHash: 'r-fix',
    remediationContext: ctx,
  };

  const plan = buildRemediationPlanV2(diagExec);
  return { diagExec, plan };
}

describe('RemediationPlanV2 — integration', () => {
  it('produces valid plan from fixture', () => {
    const { diagExec, plan } = buildFixture();
    const v = validateRemediationPlanV2(plan, diagExec);
    expect(v.valid).toBe(true);
  });

  it('deterministic: same input → same planId', () => {
    const { diagExec, plan } = buildFixture();
    const p2 = buildRemediationPlanV2(diagExec);
    expect(plan.planId).toBe(p2.planId);
  });

  it('planId altered fails validation', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = { ...plan, planId: 'plan:TAMPERED' };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.message.includes('planId altered'))).toBe(true);
  });

  it('params altered without updating planId fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = {
      ...plan,
      plan: plan.plan.map(a =>
        a.actionType === 'trim_whitespace'
          ? { ...a, parameters: { ...a.parameters as object, trimEdges: false } }
          : a
      ),
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
  });

  it('evidenceRefs altered fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = {
      ...plan,
      plan: plan.plan.map(a => a.actionType === 'trim_whitespace'
        ? { ...a, evidenceRefs: ['WRONG:EVIDENCE'] }
        : a
      ),
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path.includes('evidenceRefs'))).toBe(true);
  });

  it('actionabilityMap altered fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = {
      ...plan,
      actionabilityMap: {
        ...plan.actionabilityMap,
        [Object.keys(plan.actionabilityMap)[0]]: 'auto_safe' as Actionability,
      },
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.code === 'REMEDIATION_ACTIONABILITY_UPGRADE')).toBe(true);
  });

  it('exclusions altered fails', () => {
    const { diagExec, plan } = buildFixture();
    if (plan.exclusions.length === 0) return; // skip if no exclusions
    const tampered = {
      ...plan,
      exclusions: [...plan.exclusions, { issueId: plan.plan[0].issueId, reason: 'not_actionable' as const }],
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
  });

  it('no Python in plan', () => {
    const { plan } = buildFixture();
    const json = JSON.stringify(plan);
    expect(json).not.toContain('import os');
    expect(json).not.toContain('subprocess');
    expect(json).not.toContain('eval(');
    expect(json).not.toContain('__import__');
  });

  it('approvalStatus initialized as pending', () => {
    const { plan } = buildFixture();
    for (const a of plan.plan) {
      expect(a.approvalStatus).toBe('pending');
    }
  });

  it('remediationContext is mandatory', () => {
    const { diagExec } = buildFixture();
    const noCtx = { ...diagExec, remediationContext: undefined };
    const v = validateRemediationPlanV2({ ...buildFixture().plan }, noCtx);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.message.includes('remediationContext'))).toBe(true);
  });

  it('context envelopeRef mismatch fails', () => {
    const { diagExec, plan } = buildFixture();
    const mismatchedCtx = {
      ...diagExec,
      remediationContext: {
        ...diagExec.remediationContext!,
        evidenceEnvelopeRef: 'envelope:WRONG',
      },
    };
    const v = validateRemediationPlanV2(plan, mismatchedCtx);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path.includes('evidenceEnvelopeRef'))).toBe(true);
  });

  it('context vs diagnosis issue mismatch fails', () => {
    const { diagExec, plan } = buildFixture();
    const missingIssueCtx = {
      ...diagExec,
      diagnosis: {
        ...diagExec.diagnosis,
        issues: diagExec.diagnosis.issues.slice(1), // remove first issue
      },
    };
    const v = validateRemediationPlanV2(plan, missingIssueCtx);
    expect(v.valid).toBe(false);
  });

  it('exclusion of review_only issue fails', () => {
    const { diagExec, plan } = buildFixture();
    // Find a review_only action and try to also exclude it
    const reviewAction = plan.plan.find(a => a.actionability === 'review_only');
    if (!reviewAction) return; // no review_only in this fixture

    const tampered = {
      ...plan,
      exclusions: [...plan.exclusions, { issueId: reviewAction.issueId, reason: 'not_actionable' as const }],
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.message.includes('review_only'))).toBe(true);
  });

  it('duplicate exclusion fails', () => {
    const { diagExec, plan } = buildFixture();
    const notActionable = plan.exclusions[0];
    if (!notActionable) return;
    const tampered = {
      ...plan,
      exclusions: [...plan.exclusions, { issueId: notActionable.issueId, reason: 'not_actionable' as const }],
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
  });

  it('actionabilityMap value null fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = {
      ...plan,
      actionabilityMap: { ...plan.actionabilityMap, [Object.keys(plan.actionabilityMap)[0]]: null },
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
  });

  it('actionabilityMap value array fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = {
      ...plan,
      actionabilityMap: { ...plan.actionabilityMap, [Object.keys(plan.actionabilityMap)[0]]: ['auto_safe'] },
    };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
  });

  it('plan item null fails', () => {
    const { diagExec, plan } = buildFixture();
    // Keep planId correct so recomputation passes; only corrupt the item
    const tamperedPlan = [...plan.plan];
    tamperedPlan[0] = null as any;
    const tampered = { ...plan, plan: tamperedPlan };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path.includes('plan[0]'))).toBe(true);
  });

  it('plan item array fails', () => {
    const { diagExec, plan } = buildFixture();
    const tamperedPlan = [...plan.plan];
    tamperedPlan[0] = [] as any;
    const tampered = { ...plan, plan: tamperedPlan };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path.includes('plan[0]'))).toBe(true);
  });

  it('exclusions null primitive fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = { ...plan, exclusions: null as any };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
  });

  it('generatedAt not ISO 8601 fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = { ...plan, generatedAt: 'not-a-date' };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path === 'generatedAt')).toBe(true);
  });

  it('buildRemediationPlanId is exported and deterministic', () => {
    const { diagExec, plan } = buildFixture();
    const recomputed = buildRemediationPlanId(
      plan.diagnosisRef,
      plan.evidenceEnvelopeRef,
      plan.datasetFingerprint,
      plan.plan,
      plan.actionabilityMap,
      plan.exclusions,
    );
    expect(recomputed).toBe(plan.planId);
  });

  it('plan with extra top-level property fails', () => {
    const { diagExec, plan } = buildFixture();
    const tampered = { ...plan, extraField: 'INTRUSION' };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.path === 'extraField')).toBe(true);
  });

  it('plan with executable content fails', () => {
    const { diagExec, plan } = buildFixture();
    // eval() is matched by \beval\b — use 'plan:eval(' which contains 'eval(' with word boundaries
    const tampered = { ...plan, planId: 'plan:eval('.repeat(20) };
    const v = validateRemediationPlanV2(tampered, diagExec);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.message.includes('Executable content'))).toBe(true);
  });

  it('v2 plan — shared planId between builder and validator', () => {
    const { diagExec, plan } = buildFixture();
    // The validator recomputes planId using buildRemediationPlanId
    // and compares it. Since this plan was built with the same function,
    // it must match exactly.
    const v = validateRemediationPlanV2(plan, diagExec);
    expect(v.valid).toBe(true);
    // Verify planId is stable across rebuilds
    const p2 = buildRemediationPlanV2(diagExec);
    expect(p2.planId).toBe(plan.planId);
  });

  it('actionId is deterministic', () => {
    const { diagExec, plan } = buildFixture();
    const p2 = buildRemediationPlanV2(diagExec);
    expect(plan.plan.map(a => a.actionId)).toEqual(p2.plan.map(a => a.actionId));
  });

  it('computeEffectiveActionability is trust-degrading', () => {
    const { diagExec } = buildFixture();
    // review_only should stay review_only
    const reviewIssue = diagExec.remediationContext!.issues.find(i =>
      i.actionability === 'review_only'
    );
    if (reviewIssue) {
      const eff = computeEffectiveActionability(
        reviewIssue,
        diagExec.diagnosis.issues.find(di => di.issueId === reviewIssue.issueId),
        diagExec.remediationContext!.columns,
      );
      expect(eff).toBe('review_only');
    }

    // not_actionable should stay not_actionable
    const notActionableIssue = diagExec.remediationContext!.issues.find(i =>
      i.actionability === 'not_actionable'
    );
    if (notActionableIssue) {
      const eff = computeEffectiveActionability(
        notActionableIssue,
        diagExec.diagnosis.issues.find(di => di.issueId === notActionableIssue.issueId),
        diagExec.remediationContext!.columns,
      );
      expect(eff).toBe('not_actionable');
    }
  });
});
