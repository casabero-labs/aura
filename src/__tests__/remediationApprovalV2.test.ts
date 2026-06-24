/**
 * Remediation Approval v2 — Unit Tests.
 */
import { describe, it, expect } from 'vitest';
import { approveRemediationActionV2, rejectRemediationActionV2, resetRemediationActionV2 } from '../contracts/llm/remediationApprovalV2';
import type { RemediationPlanV2 } from '../contracts/llm';

const baseAction = {
  actionId: 'act:abc',
  issueId: 'iss-1',
  ruleId: 'rule:test',
  columnId: null,
  actionType: 'requires_human_review' as const,
  parameters: { reasonCode: 'unknown_rule' as const },
  actionability: 'review_only' as const,
  evidenceRefs: [],
  approvalStatus: 'pending' as const,
};

const basePlan: RemediationPlanV2 = {
  contractId: 'aura.remediation.v2',
  contractVersion: '2.0.0',
  planId: 'plan:test',
  diagnosisRef: 'diag:test',
  evidenceEnvelopeRef: 'env:test',
  datasetFingerprint: 'fp1',
  plan: [{ ...baseAction }],
  actionabilityMap: { 'iss-1': 'review_only' },
  exclusions: [],
  generatedAt: new Date().toISOString(),
};

describe('approveRemediationActionV2', () => {
  it('approves a pending action', () => {
    const r = approveRemediationActionV2(basePlan, 'act:abc');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.plan.plan[0].approvalStatus).toBe('approved');
    }
  });

  it('original plan is immutable', () => {
    approveRemediationActionV2(basePlan, 'act:abc');
    expect(basePlan.plan[0].approvalStatus).toBe('pending');
  });

  it('only approvalStatus changes', () => {
    const r = approveRemediationActionV2(basePlan, 'act:abc');
    if (r.success) {
      expect(r.plan.plan[0].actionType).toBe(baseAction.actionType);
      expect(r.plan.plan[0].parameters).toEqual(baseAction.parameters);
      expect(r.plan.plan[0].actionability).toBe(baseAction.actionability);
      expect(r.plan.plan[0].evidenceRefs).toEqual(baseAction.evidenceRefs);
      expect(r.plan.plan[0].ruleId).toBe(baseAction.ruleId);
    }
  });

  it('unknown actionId fails with REMEDIATION_REFERENCE_INVALID', () => {
    const r = approveRemediationActionV2(basePlan, 'act:unknown');
    expect(r.success).toBe(false);
    if (!r.success) expect((r as { success: false; code: string }).code).toBe('REMEDIATION_REFERENCE_INVALID');
  });
});

describe('rejectRemediationActionV2', () => {
  it('rejects a pending action', () => {
    const r = rejectRemediationActionV2(basePlan, 'act:abc');
    expect(r.success).toBe(true);
    if (r.success) expect(r.plan.plan[0].approvalStatus).toBe('rejected');
  });

  it('original plan is immutable', () => {
    rejectRemediationActionV2(basePlan, 'act:abc');
    expect(basePlan.plan[0].approvalStatus).toBe('pending');
  });
});

describe('resetRemediationActionV2', () => {
  it('resets an approved action to pending', () => {
    const approved = approveRemediationActionV2(basePlan, 'act:abc');
    if (approved.success) {
      const r = resetRemediationActionV2(approved.plan, 'act:abc');
      expect(r.success).toBe(true);
      if (r.success) expect(r.plan.plan[0].approvalStatus).toBe('pending');
    }
  });

  it('resets a rejected action to pending', () => {
    const rejected = rejectRemediationActionV2(basePlan, 'act:abc');
    if (rejected.success) {
      const r = resetRemediationActionV2(rejected.plan, 'act:abc');
      expect(r.success).toBe(true);
      if (r.success) expect(r.plan.plan[0].approvalStatus).toBe('pending');
    }
  });
});
