/**
 * Remediation HITL Approval v2 — Immutable state transitions.
 */
import type { RemediationPlanV2 } from './types';
import type { RemediationErrorCode } from './types';

export type ApprovalResult =
  | { success: true; plan: RemediationPlanV2 }
  | { success: false; code: RemediationErrorCode; message: string };

function clonePlan(plan: RemediationPlanV2): RemediationPlanV2 {
  return {
    ...plan,
    plan: plan.plan.map(a => ({
      actionId: a.actionId,
      issueId: a.issueId,
      ruleId: a.ruleId,
      columnId: a.columnId,
      actionType: a.actionType,
      parameters: a.parameters,
      actionability: a.actionability,
      evidenceRefs: [...a.evidenceRefs],
      approvalStatus: a.approvalStatus,
    })),
    actionabilityMap: { ...plan.actionabilityMap },
    exclusions: plan.exclusions.map(e => ({ ...e })),
  };
}

function findActionIndex(plan: RemediationPlanV2, actionId: string): number {
  return plan.plan.findIndex(a => a.actionId === actionId);
}

export function approveRemediationActionV2(plan: RemediationPlanV2, actionId: string): ApprovalResult {
  const idx = findActionIndex(plan, actionId);
  if (idx === -1) {
    return { success: false, code: 'REMEDIATION_REFERENCE_INVALID', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'approved' as const };
  return { success: true, plan: cloned };
}

export function rejectRemediationActionV2(plan: RemediationPlanV2, actionId: string): ApprovalResult {
  const idx = findActionIndex(plan, actionId);
  if (idx === -1) {
    return { success: false, code: 'REMEDIATION_REFERENCE_INVALID', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'rejected' as const };
  return { success: true, plan: cloned };
}

export function resetRemediationActionV2(plan: RemediationPlanV2, actionId: string): ApprovalResult {
  const idx = findActionIndex(plan, actionId);
  if (idx === -1) {
    return { success: false, code: 'REMEDIATION_REFERENCE_INVALID', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'pending' as const };
  return { success: true, plan: cloned };
}
