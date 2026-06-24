/**
 * Remediation Validator v2 — Deterministic, schema-coverage-action-id validation.
 */
import type {
  RemediationPlanV2,
  RemediationActionV2,
  DiagnosisExecutionResult,
  ValidationResultV2,
  ValidationErrorV2,
} from './types';
import { buildDiagnosisRef } from './remediationContextV2';
import { lookupRemediationAction } from './remediationPolicyV2';
import { computeEffectiveActionability } from './remediationBuilderV2';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex, sha256short } from './hash';

function verr(path: string, message: string): ValidationErrorV2 {
  return { code: 'REMEDIATION_SCHEMA_INVALID', path, message, value: undefined };
}

function computeExpectedActionId(diagnosisRef: string, action: RemediationActionV2): string {
  const payload = {
    diagnosisRef,
    issueId: action.issueId,
    ruleId: action.ruleId,
    columnId: action.columnId,
    actionType: action.actionType,
  };
  const hash = sha256hex(canonicalJson(payload));
  return `act:${sha256short(hash)}`;
}

function validateParameters(action: RemediationActionV2): string[] {
  const errors: string[] = [];
  const p = action.parameters as unknown as Record<string, unknown>;
  switch (action.actionType) {
    case 'trim_whitespace':
      if (p.trimEdges !== true) errors.push('trim_whitespace: trimEdges must be true');
      if (typeof p.collapseInternalWhitespace !== 'boolean') errors.push('trim_whitespace: collapseInternalWhitespace must be boolean');
      break;
    case 'drop_exact_duplicates':
      if (p.keep !== 'first') errors.push('drop_exact_duplicates: keep must be "first"');
      break;
    case 'normalize_placeholders':
      if (p.strategy !== 'controlled_vocabulary') errors.push('normalize_placeholders: strategy must be controlled_vocabulary');
      if (p.replacement !== null) errors.push('normalize_placeholders: replacement must be null');
      break;
    case 'normalize_casing':
      if (p.strategy !== 'title_case' && p.strategy !== 'lowercase') errors.push('normalize_casing: strategy must be title_case or lowercase');
      break;
    case 'convert_disguised_numbers':
      if (p.decimalSeparator !== 'auto') errors.push('convert_disguised_numbers: decimalSeparator must be auto');
      if (p.errors !== 'coerce') errors.push('convert_disguised_numbers: errors must be coerce');
      break;
    case 'requires_human_review': {
      const validReasons = ['unknown_rule', 'ambiguous_column', 'review_only_rule', 'diagnosis_requires_review', 'authorization_missing', 'no_safe_transform'];
      if (!validReasons.includes(p.reasonCode as string)) errors.push(`requires_human_review: invalid reasonCode: ${p.reasonCode}`);
      break;
    }
  }
  return errors;
}

export function validateRemediationPlanV2(
  plan: RemediationPlanV2,
  diagnosisExecution: DiagnosisExecutionResult,
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (plan.contractId !== 'aura.remediation.v2')
    errors.push(verr('contractId', 'Must be aura.remediation.v2'));
  if (plan.contractVersion !== '2.0.0')
    errors.push(verr('contractVersion', 'Must be 2.0.0'));

  const expectedDiagRef = buildDiagnosisRef(diagnosisExecution.diagnosis);
  if (plan.diagnosisRef !== expectedDiagRef)
    errors.push(verr('diagnosisRef', 'DiagnosisRef does not match'));
  if (plan.evidenceEnvelopeRef !== diagnosisExecution.evidenceEnvelopeRef)
    errors.push(verr('evidenceEnvelopeRef', 'EvidenceEnvelopeRef does not match'));
  if (!plan.planId) errors.push(verr('planId', 'Must be non-empty'));
  if (!plan.datasetFingerprint) errors.push(verr('datasetFingerprint', 'Must be non-empty'));
  if (!plan.generatedAt) errors.push(verr('generatedAt', 'Must be non-empty'));

  const ctx = diagnosisExecution.remediationContext;
  if (!ctx) {
    errors.push(verr('', 'remediationContext required'));
    return { valid: false, errors, warnings };
  }

  const issueIds = new Set(ctx.issues.map(i => i.issueId));
  const actionIds = new Set<string>();
  const issueActions = new Map<string, number>();
  const diagIssueMap = new Map(diagnosisExecution.diagnosis.issues.map(di => [di.issueId, di]));

  for (let i = 0; i < plan.plan.length; i++) {
    const action = plan.plan[i];
    const base = `plan[${i}]`;

    if (!['pending', 'approved', 'rejected'].includes(action.approvalStatus))
      errors.push(verr(`${base}.approvalStatus`, `Invalid: ${action.approvalStatus}`));

    if (actionIds.has(action.actionId))
      errors.push(verr(`${base}.actionId`, 'Duplicate'));
    actionIds.add(action.actionId);

    const expectedId = computeExpectedActionId(expectedDiagRef, action);
    if (action.actionId !== expectedId)
      errors.push(verr(`${base}.actionId`, `Expected ${expectedId}`));

    if (!issueIds.has(action.issueId))
      errors.push(verr(`${base}.issueId`, 'Unknown issueId'));

    const ctxIssue = ctx.issues.find(iss => iss.issueId === action.issueId);
    if (ctxIssue) {
      if (action.ruleId !== ctxIssue.ruleId)
        errors.push(verr(`${base}.ruleId`, 'ruleId mismatch'));
      if (action.columnId !== ctxIssue.columnId)
        errors.push(verr(`${base}.columnId`, 'columnId mismatch'));

      const expectedRefs = [...ctxIssue.evidenceRefs].sort().join(',');
      const actualRefs = [...action.evidenceRefs].sort().join(',');
      if (expectedRefs !== actualRefs)
        errors.push(verr(`${base}.evidenceRefs`, 'evidenceRefs mismatch'));

      const expectedActionType = lookupRemediationAction(action.ruleId);
      if (action.actionType !== expectedActionType)
        errors.push(verr(`${base}.actionType`, `Expected ${expectedActionType}`));

      const diagIssue = diagIssueMap.get(action.issueId);
      const expectedEff = computeEffectiveActionability(ctxIssue, diagIssue, ctx.columns);
      if (action.actionability !== expectedEff)
        errors.push(verr(`${base}.actionability`, `Expected ${expectedEff}`));
    }

    const paramErrors = validateParameters(action);
    for (const pe of paramErrors)
      errors.push(verr(`${base}.parameters`, pe));

    const count = (issueActions.get(action.issueId) ?? 0) + 1;
    issueActions.set(action.issueId, count);
    if (count > 1)
      errors.push(verr(`${base}.issueId`, 'Multiple actions'));
  }

  const excludedIds = new Set(plan.exclusions.map(e => e.issueId));
  for (const issueId of issueIds) {
    if (!issueActions.has(issueId) && !excludedIds.has(issueId))
      errors.push(verr(`issue.${issueId}`, 'Not covered'));
  }

  for (const ex of plan.exclusions) {
    if (ex.reason !== 'not_actionable')
      errors.push(verr(`exclusions.${ex.issueId}`, 'Reason must be not_actionable'));
    if (!issueIds.has(ex.issueId))
      errors.push(verr(`exclusions.${ex.issueId}`, 'Unknown issueId'));
  }

  return { valid: errors.length === 0, errors, warnings };
}
