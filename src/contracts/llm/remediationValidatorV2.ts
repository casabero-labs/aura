/**
 * Remediation Validator v2 — Closed, no-throwing, typed codes.
 */
import type {
  RemediationPlanV2,
  DiagnosisExecutionResult,
  ValidationResultV2,
  ValidationErrorV2,
  RemediationErrorCode,
} from './types';
import { buildDiagnosisRef } from './remediationContextV2';
import { lookupRemediationAction } from './remediationPolicyV2';
import { computeEffectiveActionability } from './remediationBuilderV2';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex, sha256short } from './hash';

function verr(code: RemediationErrorCode, path: string, message: string): ValidationErrorV2 {
  return { code, path, message, value: undefined };
}

function computeExpectedActionId(diagnosisRef: string, issueId: string, ruleId: string, columnId: string | null, actionType: string): string {
  const payload = { diagnosisRef, issueId, ruleId, columnId, actionType };
  const hash = sha256hex(canonicalJson(payload));
  return `act:${sha256short(hash)}`;
}

function validateParams(actionType: string, params: unknown): string[] {
  const e: string[] = [];
  const p = params as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    e.push('Parameters must be a non-null object');
    return e;
  }

  switch (actionType) {
    case 'trim_whitespace': {
      if (p.trimEdges !== true) e.push('trimEdges must be true');
      if (typeof p.collapseInternalWhitespace !== 'boolean') e.push('collapseInternalWhitespace must be boolean');
      const known = ['trimEdges', 'collapseInternalWhitespace'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    case 'drop_exact_duplicates': {
      if (p.keep !== 'first') e.push('keep must be "first"');
      const known = ['keep'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    case 'normalize_placeholders': {
      if (p.strategy !== 'controlled_vocabulary') e.push('strategy must be controlled_vocabulary');
      if (p.replacement !== null) e.push('replacement must be null');
      const known = ['strategy', 'replacement'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    case 'normalize_casing': {
      if (p.strategy !== 'title_case' && p.strategy !== 'lowercase') e.push('strategy must be title_case or lowercase');
      const known = ['strategy'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    case 'convert_disguised_numbers': {
      if (p.decimalSeparator !== 'auto') e.push('decimalSeparator must be auto');
      if (p.errors !== 'coerce') e.push('errors must be coerce');
      const known = ['decimalSeparator', 'errors'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    case 'requires_human_review': {
      const valid = ['unknown_rule', 'ambiguous_column', 'review_only_rule', 'diagnosis_requires_review', 'authorization_missing', 'no_safe_transform'];
      if (!valid.includes(p.reasonCode as string)) e.push(`Invalid reasonCode: ${p.reasonCode}`);
      const known = ['reasonCode'];
      for (const k of Object.keys(p)) { if (!known.includes(k)) e.push(`Unknown parameter: ${k}`); }
      break;
    }
    default:
      e.push(`Unknown action type: ${actionType}`);
  }
  return e;
}

export function validateRemediationPlanV2(
  plan: unknown,
  diagnosisExecution: DiagnosisExecutionResult,
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  // Malformed input
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'Plan must be a non-null object'));
    return { valid: false, errors, warnings };
  }
  const p = plan as Record<string, unknown>;

  // Contract identity
  if (p.contractId !== 'aura.remediation.v2') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'contractId', `Expected aura.remediation.v2, got ${p.contractId}`));
  if (p.contractVersion !== '2.0.0') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'contractVersion', `Expected 2.0.0, got ${p.contractVersion}`));

  // Diagnosis ref
  const expectedDiagRef = buildDiagnosisRef(diagnosisExecution.diagnosis);
  if (p.diagnosisRef !== expectedDiagRef) errors.push(verr('REMEDIATION_DIAGNOSIS_MISMATCH', 'diagnosisRef', 'Does not match diagnosis'));

  // Envelope ref & fingerprint
  if (p.evidenceEnvelopeRef !== diagnosisExecution.evidenceEnvelopeRef) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'evidenceEnvelopeRef', 'Does not match'));
  const ctx = diagnosisExecution.remediationContext;
  if (!ctx) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'remediationContext required'));
    return { valid: false, errors, warnings };
  }
  if (p.datasetFingerprint !== ctx.datasetFingerprint) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'datasetFingerprint', 'Does not match context'));

  // Schema: planId, generatedAt
  if (!p.planId || typeof p.planId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'planId', 'Required'));
  if (!p.generatedAt || typeof p.generatedAt !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'generatedAt', 'Required'));
  if (p.generatedAt) {
    const d = new Date(p.generatedAt as string);
    if (isNaN(d.getTime())) errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'generatedAt', 'Must be valid ISO 8601'));
  }

  // Plan array
  if (!Array.isArray(p.plan)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'plan', 'Must be array'));
    return { valid: false, errors, warnings };
  }

  // ActionabilityMap
  if (typeof p.actionabilityMap !== 'object' || !p.actionabilityMap) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'actionabilityMap', 'Required'));
  }

  // Exclusions
  if (!Array.isArray(p.exclusions)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'exclusions', 'Must be array'));

  const issueIds = new Set(ctx.issues.map(i => i.issueId));
  const actionIds = new Set<string>();
  const issueActions = new Map<string, number>();
  const diagIssueMap = new Map(diagnosisExecution.diagnosis.issues.map(di => [di.issueId, di]));
  const amKeys = new Set<string>();

  // Check actionabilityMap keys match context issues exactly
  const amap = (p.actionabilityMap || {}) as Record<string, unknown>;
  for (const k of Object.keys(amap)) {
    if (!issueIds.has(k)) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `actionabilityMap.${k}`, 'Issue not in context'));
    amKeys.add(k);
  }
  for (const id of issueIds) {
    if (!amKeys.has(id)) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `actionabilityMap.${id}`, 'Missing in actionabilityMap'));
  }

  // Validate actions
  for (let i = 0; i < p.plan.length; i++) {
    const a = p.plan[i] as Record<string, unknown>;
    const base = `plan[${i}]`;

    if (!a || typeof a !== 'object') { errors.push(verr('REMEDIATION_SCHEMA_INVALID', base, 'Not an object')); continue; }

    // Required fields
    if (!a.actionId || typeof a.actionId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionId`, 'Required'));
    if (!a.issueId || typeof a.issueId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.issueId`, 'Required'));
    if (!a.ruleId || typeof a.ruleId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.ruleId`, 'Required'));
    if (a.columnId !== null && typeof a.columnId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.columnId`, 'Must be string or null'));
    if (!a.actionType || typeof a.actionType !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionType`, 'Required'));
    if (!a.actionability || typeof a.actionability !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionability`, 'Required'));
    if (!a.parameters || typeof a.parameters !== 'object') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.parameters`, 'Required'));
    if (!Array.isArray(a.evidenceRefs)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.evidenceRefs`, 'Must be array'));
    const validApproval = ['pending', 'approved', 'rejected'];
    if (!validApproval.includes(a.approvalStatus as string)) errors.push(verr('REMEDIATION_APPROVAL_INVALID', `${base}.approvalStatus`, `Expected pending/approved/rejected, got ${a.approvalStatus}`));

    const aid = a.actionId as string;
    if (actionIds.has(aid)) errors.push(verr('REMEDIATION_ACTION_ID_INVALID', `${base}.actionId`, 'Duplicate'));
    actionIds.add(aid);

    // ActionId correctness
    const expectedId = computeExpectedActionId(expectedDiagRef, a.issueId as string, a.ruleId as string, a.columnId as string | null, a.actionType as string);
    if (aid !== expectedId) errors.push(verr('REMEDIATION_ACTION_ID_INVALID', `${base}.actionId`, `Expected ${expectedId}`));

    // Reference checks
    if (!issueIds.has(a.issueId as string)) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.issueId`, 'Unknown'));

    const ctxIssue = ctx.issues.find(iss => iss.issueId === a.issueId);
    if (ctxIssue) {
      if (a.ruleId !== ctxIssue.ruleId) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.ruleId`, 'Mismatch'));
      if (a.columnId !== ctxIssue.columnId) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.columnId`, 'Mismatch'));
      const expectedRefs = [...ctxIssue.evidenceRefs].sort().join(',');
      const actualRefs = [...(a.evidenceRefs as string[] || [])].sort().join(',');
      if (expectedRefs !== actualRefs) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.evidenceRefs`, 'Mismatch'));

      const expectedActionType = lookupRemediationAction(a.ruleId as string);
      if (a.actionType !== expectedActionType) errors.push(verr('REMEDIATION_ACTION_NOT_ALLOWED', `${base}.actionType`, `Expected ${expectedActionType}`));

      const diagIssue = diagIssueMap.get(a.issueId as string);
      const expectedEff = computeEffectiveActionability(ctxIssue, diagIssue, ctx.columns);
      if (a.actionability !== expectedEff) errors.push(verr('REMEDIATION_ACTIONABILITY_UPGRADE', `${base}.actionability`, `Expected ${expectedEff}, got ${a.actionability}`));
    }

    const paramErrs = validateParams(a.actionType as string, a.parameters);
    for (const pe of paramErrs) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.parameters`, pe));

    // Extra properties in action
    const knownActionProps = ['actionId', 'issueId', 'ruleId', 'columnId', 'actionType', 'parameters', 'actionability', 'evidenceRefs', 'approvalStatus'];
    for (const k of Object.keys(a)) { if (!knownActionProps.includes(k)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.${k}`, 'Unknown property')); }

    const cnt = (issueActions.get(a.issueId as string) ?? 0) + 1;
    issueActions.set(a.issueId as string, cnt);
    if (cnt > 1) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `${base}.issueId`, 'Multiple actions'));
  }

  // Exclusions validation
  const excludedIds = new Set<string>();
  const exs = (p.exclusions as any[] | undefined) || [];
  for (let i = 0; i < exs.length; i++) {
    const ex = exs[i] as Record<string, unknown>;
    if (!ex.issueId || !issueIds.has(ex.issueId as string)) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `exclusions[${i}].issueId`, 'Unknown'));
    if (ex.reason !== 'not_actionable') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `exclusions[${i}].reason`, 'Must be not_actionable'));
    if (excludedIds.has(ex.issueId as string)) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions[${i}].issueId`, 'Duplicate exclusion'));
    excludedIds.add(ex.issueId as string);

    // No action + exclusion for same issue
    if (issueActions.has(ex.issueId as string)) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions[${i}].issueId`, 'Has both action and exclusion'));
  }

  // Coverage: every issue has action OR exclusion (not both, not neither)
  for (const id of issueIds) {
    const hasAction = issueActions.has(id);
    const hasExclusion = excludedIds.has(id);
    if (!hasAction && !hasExclusion) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `issue.${id}`, 'Not covered'));
  }

  // Top-level extra properties
  const topKeys = ['contractId', 'contractVersion', 'planId', 'diagnosisRef', 'evidenceEnvelopeRef', 'datasetFingerprint', 'plan', 'actionabilityMap', 'exclusions', 'generatedAt'];
  for (const k of Object.keys(p)) { if (!topKeys.includes(k)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', k, 'Unknown top-level property')); }

  // Executable content check
  const json = JSON.stringify(plan);
  const suspicious = [/\beval\b/, /\bexec\b/, /\bos\.system\b/, /\bsubprocess\b/, /\b__import__\b/];
  for (const pattern of suspicious) {
    if (pattern.test(json)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'Executable content detected'));
  }

  return { valid: errors.length === 0, errors, warnings };
}
