/**
 * Remediation Builder v2 — Deterministic plan construction.
 *
 * NO LLM. NO recommendation/hypothesis-based decisions. NO Python/SQL generation.
 */

import type {
  DiagnosisExecutionResult,
  DiagnosisResponseV2,
  RemediationActionTypeV2,
  RemediationActionV2,
  RemediationContextV2,
  RemediationContextIssueV2,
  RemediationParametersV2,
  RemediationPlanV2,
  Actionability,
  RequiresHumanReviewParams,
} from './types';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex, sha256short } from './hash';
import { buildDiagnosisRef } from './remediationContextV2';
import { lookupRemediationAction } from './remediationPolicyV2';
import type { ColumnRef } from './types';

// ── Effective Actionability ──

export function computeEffectiveActionability(
  ctxIssue: RemediationContextIssueV2,
  diagnosisIssue: DiagnosisResponseV2['issues'][number] | undefined,
  columns: RemediationContextV2['columns'],
): Actionability {
  const trusted = ctxIssue.actionability;
  const auth = ctxIssue.automaticAuthorization;

  // 1. trusted not_actionable → not_actionable
  if (trusted === 'not_actionable') return 'not_actionable';

  // 2. trusted review_only → review_only
  if (trusted === 'review_only') return 'review_only';

  // 3. auto_safe but authorization not true → review_only
  if (trusted === 'auto_safe' && !auth.authorized) return 'review_only';

  // 4. auto_safe but diagnosis requires human review → review_only
  if (trusted === 'auto_safe' && diagnosisIssue?.requiresHumanReview) return 'review_only';

  // 5. column ambiguous or duplicate → review_only
  if (ctxIssue.columnId) {
    const col = columns.find(c => c.columnId === ctxIssue.columnId);
    if (col && (col.isAmbiguous || col.isDuplicate)) return 'review_only';
  }

  // 6. auto_safe only when all conditions satisfied
  if (
    trusted === 'auto_safe' &&
    auth.authorized
  ) {
    return 'auto_safe';
  }

  // Fallback (should not reach here)
  return 'review_only';
}

// ── Standard Parameters (not proposed by model) ──

function standardParams(actionType: RemediationActionTypeV2, ctxIssue: RemediationContextIssueV2, columns: RemediationContextV2['columns']): RemediationParametersV2 {
  switch (actionType) {
    case 'trim_whitespace':
      return { trimEdges: true, collapseInternalWhitespace: false };
    case 'drop_exact_duplicates':
      return { keep: 'first' };
    case 'normalize_placeholders':
      return { strategy: 'controlled_vocabulary', replacement: null };
    case 'normalize_casing':
      return { strategy: 'lowercase' };
    case 'convert_disguised_numbers':
      return { decimalSeparator: 'auto', errors: 'coerce' };
    case 'requires_human_review': {
      let reasonCode: RequiresHumanReviewParams['reasonCode'];
      if (ctxIssue.actionability === 'not_actionable') {
        reasonCode = 'no_safe_transform';
      } else if (ctxIssue.actionability === 'review_only') {
        reasonCode = 'review_only_rule';
      } else if (!ctxIssue.automaticAuthorization.authorized) {
        reasonCode = 'authorization_missing';
      } else {
        const col = ctxIssue.columnId ? columns.find(c => c.columnId === ctxIssue.columnId) : null;
        reasonCode = col?.isAmbiguous ? 'ambiguous_column' : 'unknown_rule';
      }
      return { reasonCode };
    }
  }
}

// ── ActionId: act:<sha256(canonical {...})> ──

function buildActionId(
  diagnosisRef: string,
  issueId: string,
  ruleId: string,
  columnId: string | null,
  actionType: RemediationActionTypeV2,
): string {
  const payload = {
    diagnosisRef,
    issueId,
    ruleId,
    columnId,
    actionType,
  };
  const hash = sha256hex(canonicalJson(payload));
  return `act:${sha256short(hash)}`;
}

// ── PlanId: plan:<sha256(diagnosisRef + all actionIds)> ──

function buildPlanId(diagnosisRef: string, actionIds: string[]): string {
  const sorted = [...actionIds].sort();
  const payload = { diagnosisRef, actionIds: sorted };
  const hash = sha256hex(canonicalJson(payload));
  return `plan:${sha256short(hash)}`;
}

// ── Builder ──

export function buildRemediationPlanV2(
  diagnosisExecution: DiagnosisExecutionResult,
  context?: RemediationContextV2,
): RemediationPlanV2 {
  const ctx = context ?? diagnosisExecution.remediationContext;
  if (!ctx) {
    throw new Error('remediationContext is required for buildRemediationPlanV2');
  }

  const diagnosisRef = buildDiagnosisRef(diagnosisExecution.diagnosis);
  const columns = ctx.columns;
  const actions: RemediationActionV2[] = [];
  const exclusions: RemediationPlanV2['exclusions'] = [];

  const actionabilityMap: Record<string, Actionability> = {};
  const diagnosisIssues = diagnosisExecution.diagnosis.issues ?? [];
  const diagIssueMap = new Map(diagnosisIssues.map(di => [di.issueId, di]));

  for (const ctxIssue of ctx.issues) {
    const diagIssue = diagIssueMap.get(ctxIssue.issueId);
    const effectiveActionability = computeEffectiveActionability(ctxIssue, diagIssue, columns);

    actionabilityMap[ctxIssue.issueId] = effectiveActionability;

    if (effectiveActionability === 'not_actionable') {
      exclusions.push({
        issueId: ctxIssue.issueId,
        reason: 'not_actionable',
      });
      continue;
    }

    const actionType = lookupRemediationAction(ctxIssue.ruleId);

    const actionId = buildActionId(
      diagnosisRef,
      ctxIssue.issueId,
      ctxIssue.ruleId,
      ctxIssue.columnId,
      actionType,
    );

    const parameters = standardParams(actionType, ctxIssue, columns);

    actions.push({
      actionId,
      issueId: ctxIssue.issueId,
      ruleId: ctxIssue.ruleId,
      columnId: ctxIssue.columnId,
      actionType,
      parameters,
      actionability: effectiveActionability,
      evidenceRefs: [...ctxIssue.evidenceRefs],
      approvalStatus: 'pending',
    });
  }

  const planId = buildPlanId(diagnosisRef, actions.map(a => a.actionId));

  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId,
    diagnosisRef,
    evidenceEnvelopeRef: diagnosisExecution.evidenceEnvelopeRef,
    datasetFingerprint: ctx.datasetFingerprint,
    plan: actions,
    actionabilityMap,
    exclusions,
    generatedAt: new Date().toISOString(),
  };
}
