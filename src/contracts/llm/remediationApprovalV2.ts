/**
 * Remediation HITL Approval v2 — Immutable state transitions.
 *
 * approve/reject/reset actions. Only approvalStatus changes.
 * No parameter/actionability/issueId modifications.
 */

import type { RemediationPlanV2, RemediationActionV2 } from './types';

export type ApprovalResult =
  | { success: true; plan: RemediationPlanV2 }
  | { success: false; code: 'ACTION_NOT_FOUND'; message: string };

function clonePlan(plan: RemediationPlanV2): RemediationPlanV2 {
  return {
    ...plan,
    plan: plan.plan.map(a => ({ ...a, parameters: { ...a.parameters } })),
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
    return { success: false, code: 'ACTION_NOT_FOUND', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'approved' as const };
  return { success: true, plan: cloned };
}

export function rejectRemediationActionV2(plan: RemediationPlanV2, actionId: string): ApprovalResult {
  const idx = findActionIndex(plan, actionId);
  if (idx === -1) {
    return { success: false, code: 'ACTION_NOT_FOUND', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'rejected' as const };
  return { success: true, plan: cloned };
}

export function resetRemediationActionV2(plan: RemediationPlanV2, actionId: string): ApprovalResult {
  const idx = findActionIndex(plan, actionId);
  if (idx === -1) {
    return { success: false, code: 'ACTION_NOT_FOUND', message: `Action ${actionId} not found` };
  }
  const cloned = clonePlan(plan);
  cloned.plan[idx] = { ...cloned.plan[idx], approvalStatus: 'pending' as const };
  return { success: true, plan: cloned };
}
