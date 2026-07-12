/**
 * Remediation Builder v2 — Deterministic plan construction.
 *
 * NO LLM. NO recommendation/hypothesis-based decisions. NO Python/SQL generation.
 */

import type {
  DiagnosisExecutionResult,
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

// ── Effective Actionability (trust-degrading, closed) ──

export function computeEffectiveActionability(
  ctxIssue: RemediationContextIssueV2,
  diagnosisIssue: { requiresHumanReview: boolean } | undefined,
  columns: RemediationContextV2['columns'],
): Actionability {
  const trusted = ctxIssue.actionability;
  const auth = ctxIssue.automaticAuthorization;

  // Rule 1: trusted not_actionable → not_actionable (no upgrade)
  if (trusted === 'not_actionable') return 'not_actionable';

  // Rule 2: trusted review_only → review_only (no upgrade)
  if (trusted === 'review_only') return 'review_only';

  // Rule 3: missing diagnosis issue → review_only
  if (!diagnosisIssue) return 'review_only';

  // Rule 4: authorization.actionType mismatch with registry → review_only
  const mappedActionType = lookupRemediationAction(ctxIssue.ruleId);
  if (auth.actionType !== mappedActionType && mappedActionType !== 'requires_human_review') return 'review_only';

  // Rule 5: authorization.authorized === false → review_only
  if (!auth.authorized) return 'review_only';

  // Rule 6: ambiguous or duplicate column → review_only
  if (ctxIssue.columnId) {
    const col = columns.find(c => c.columnId === ctxIssue.columnId);
    if (col && (col.isAmbiguous || col.isDuplicate)) return 'review_only';
  }

  // Rule 7: diagnosis requiresHumanReview → review_only
  if (diagnosisIssue.requiresHumanReview) return 'review_only';

  // Rule 8: auto_safe only with exact match of rule, action, authorization
  if (
    trusted === 'auto_safe' &&
    auth.authorized &&
    mappedActionType !== 'requires_human_review' &&
    auth.actionType === mappedActionType
  ) {
    return 'auto_safe';
  }

  // Fallback (unknown rule or unmatched condition) → review_only
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

export function buildRemediationPlanId(
  diagnosisRef: string,
  evidenceEnvelopeRef: string,
  datasetFingerprint: string,
  plan: RemediationActionV2[],
  actionabilityMap: Record<string, Actionability>,
  exclusions: Array<{ issueId: string; reason: 'not_actionable' }>,
): string {
  const planWithoutHitl = plan
    .map(a => {
      const { approvalStatus, ...rest } = a;
      return rest;
    })
    .sort((a, b) => a.actionId.localeCompare(b.actionId));

  const sortedActionabilityKeys = Object.keys(actionabilityMap).sort();
  const sortedActionability: Record<string, string> = {};
  for (const k of sortedActionabilityKeys) {
    sortedActionability[k] = actionabilityMap[k];
  }

  const sortedExclusions = [...exclusions].sort((a, b) => a.issueId.localeCompare(b.issueId));

  const payload = {
    diagnosisRef,
    evidenceEnvelopeRef,
    datasetFingerprint,
    plan: planWithoutHitl,
    actionabilityMap: sortedActionability,
    exclusions: sortedExclusions,
  };
  const hash = sha256hex(canonicalJson(payload));
  return `plan:${sha256short(hash)}`;
}

// ── Builder ──

export function buildRemediationPlanV2(
  diagnosisExecution: DiagnosisExecutionResult,
): RemediationPlanV2 {
  const ctx = diagnosisExecution.remediationContext;
  if (!ctx) {
    throw new Error('remediationContext is required in DiagnosisExecutionResult for buildRemediationPlanV2');
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

  const planId = buildRemediationPlanId(diagnosisRef, ctx.evidenceEnvelopeRef, ctx.datasetFingerprint, actions, actionabilityMap, exclusions);

  return {
    contractId: 'aura.remediation.v2',
    contractVersion: '2.0.0',
    planId,
    diagnosisRef,
    evidenceEnvelopeRef: diagnosisExecution.evidenceEnvelopeRef,
    inputReceiptRef: ctx.inputReceiptRef,
    inputTrace: diagnosisExecution.inputMode && diagnosisExecution.inputHash ? {
      inputMode: diagnosisExecution.inputMode,
      promptHash: diagnosisExecution.promptHash,
      inputHash: diagnosisExecution.inputHash,
      evidenceEnvelopeRef: diagnosisExecution.evidenceEnvelopeRef,
    } : undefined,
    datasetFingerprint: ctx.datasetFingerprint,
    plan: actions,
    actionabilityMap,
    exclusions,
    generatedAt: new Date().toISOString(),
  };
}
