/**
 * Remediation Validator v2 — Closed, no-throwing, typed codes.
 *
 * Validates:
 * 1. Shared planId correctness (buildRemediationPlanId recomputation)
 * 2. RemediationContext vs Diagnosis correspondence (issues, evidenceRefs, blocks)
 * 3. ActionabilityMap values match computeEffectiveActionability
 * 4. Exclusions are not_actionable-only, not in plan, no duplicates
 * 5. No-throwing guards for all malformed inputs
 * 6. Strict ISO 8601 for generatedAt
 */
import type {
  RemediationPlanV2,
  DiagnosisExecutionResult,
  ValidationResultV2,
  ValidationErrorV2,
  RemediationErrorCode,
  Actionability,
  RemediationActionV2,
} from './types';
import { buildDiagnosisRef } from './remediationContextV2';
import { lookupRemediationAction } from './remediationPolicyV2';
import { computeEffectiveActionability, buildRemediationPlanId } from './remediationBuilderV2';
import { canonicalJson } from './diagnosisPromptV2';
import { sha256hex, sha256short } from './hash';

const VALID_ACTIONABILITIES: Actionability[] = ['auto_safe', 'review_only', 'not_actionable'];

function verr(code: RemediationErrorCode, path: string, message: string, value?: unknown): ValidationErrorV2 {
  return { code, path, message, value };
}

function computeExpectedActionId(
  diagnosisRef: string,
  issueId: string,
  ruleId: string,
  columnId: string | null,
  actionType: string,
): string {
  const payload = { diagnosisRef, issueId, ruleId, columnId, actionType };
  const hash = sha256hex(canonicalJson(payload));
  return `act:${sha256short(hash)}`;
}

function isValidIso8601(value: string): boolean {
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.toISOString() === value;
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

  // ── Guard: malformed input ──
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'Plan must be a non-null object'));
    return { valid: false, errors, warnings };
  }
  const p = plan as Record<string, unknown>;

  // ── Guard: remediationContext required ──
  const ctx = diagnosisExecution.remediationContext;
  if (!ctx) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'remediationContext required in DiagnosisExecutionResult'));
    return { valid: false, errors, warnings };
  }

  // ── Contract identity ──
  if (p.contractId !== 'aura.remediation.v2') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'contractId', `Expected aura.remediation.v2, got ${p.contractId}`));
  if (p.contractVersion !== '2.0.0') errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'contractVersion', `Expected 2.0.0, got ${p.contractVersion}`));

  const expectedDiagRef = buildDiagnosisRef(diagnosisExecution.diagnosis);

  // ── Diagnosis ref ──
  if (p.diagnosisRef !== expectedDiagRef) errors.push(verr('REMEDIATION_DIAGNOSIS_MISMATCH', 'diagnosisRef', 'Does not match computed diagnosisRef'));

  // ── Envelope ref: context vs diagnosis vs execution ──
  if (p.evidenceEnvelopeRef !== ctx.evidenceEnvelopeRef) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'evidenceEnvelopeRef', 'Does not match context.evidenceEnvelopeRef'));
  if (ctx.evidenceEnvelopeRef !== diagnosisExecution.diagnosis.evidenceEnvelopeRef) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'context.evidenceEnvelopeRef', 'Does not match diagnosis.evidenceEnvelopeRef'));
  if (p.evidenceEnvelopeRef !== diagnosisExecution.evidenceEnvelopeRef) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'evidenceEnvelopeRef', 'Does not match diagnosisExecution.evidenceEnvelopeRef'));

  // ── Fingerprint ──
  if (p.datasetFingerprint !== ctx.datasetFingerprint) errors.push(verr('REMEDIATION_REFERENCE_INVALID', 'datasetFingerprint', 'Does not match context.datasetFingerprint'));

  // ── generatedAt: strict ISO 8601 ──
  if (!p.generatedAt || typeof p.generatedAt !== 'string') {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'generatedAt', 'Required string'));
  } else if (!isValidIso8601(p.generatedAt as string)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'generatedAt', 'Must be valid ISO 8601 (e.g. 2026-06-24T00:00:00.000Z)'));
  }

  // ── planId: required + correctness ──
  if (!p.planId || typeof p.planId !== 'string') {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'planId', 'Required string'));
  } else {
    // Recompute planId and compare
    const planArray = (p.plan as unknown) as RemediationActionV2[] | undefined;
    const amapVal = (p.actionabilityMap as unknown) as Record<string, Actionability> | undefined;
    const exclusionsVal = (p.exclusions as unknown) as Array<{ issueId: string; reason: 'not_actionable' }> | undefined;

    if (Array.isArray(planArray) && amapVal && Array.isArray(exclusionsVal)) {
      try {
        const expectedPlanId = buildRemediationPlanId(
          expectedDiagRef,
          ctx.evidenceEnvelopeRef,
          ctx.datasetFingerprint,
          planArray,
          amapVal,
          exclusionsVal,
        );
        if (p.planId !== expectedPlanId) {
          errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'planId', `planId altered or incorrectly computed. Expected ${expectedPlanId}`));
        }
      } catch {
        errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'planId', 'planId altered or cannot be recomputed (malformed plan items)'));
      }
    }
  }

  // ── Plan array guard ──
  if (!Array.isArray(p.plan)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'plan', 'Must be array'));
    return { valid: false, errors, warnings };
  }

  // ── ActionabilityMap guard ──
  if (typeof p.actionabilityMap !== 'object' || p.actionabilityMap === null || Array.isArray(p.actionabilityMap)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'actionabilityMap', 'Must be a non-null object'));
    return { valid: false, errors, warnings };
  }

  // ── Exclusions guard ──
  if (!Array.isArray(p.exclusions)) {
    errors.push(verr('REMEDIATION_SCHEMA_INVALID', 'exclusions', 'Must be array'));
  }

  // ─────────────────────────────────────────────────────────────
  // ITEM 2: Validate RemediationContext vs Diagnosis
  // ─────────────────────────────────────────────────────────────

  const ctxIssueIds = new Set(ctx.issues.map(i => i.issueId));
  const diagIssues = diagnosisExecution.diagnosis.issues ?? [];
  const diagIssueIds = new Set(diagIssues.map(di => di.issueId));
  const diagBlocks = diagnosisExecution.diagnosis.diagnosisBlocks ?? [];

  // Every diagnosis issue must exist in context
  for (const di of diagIssues) {
    if (!ctxIssueIds.has(di.issueId)) {
      errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues[?]`, `Diagnosis issue ${di.issueId} not found in remediationContext`));
    }
  }

  // Every context issue must exist in diagnosis
  for (const ci of ctx.issues) {
    if (!diagIssueIds.has(ci.issueId)) {
      errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues[?]`, `Context issue ${ci.issueId} not found in diagnosis`));
    }
  }

  // No duplicate issueIds in context
  const ctxIssueIdList: string[] = [];
  for (const ci of ctx.issues) {
    if (ctxIssueIdList.includes(ci.issueId)) {
      errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues`, `Duplicate issueId in context: ${ci.issueId}`));
    }
    ctxIssueIdList.push(ci.issueId);
  }

  // evidenceRefs must match exactly between context and diagnosis
  for (const di of diagIssues) {
    const ci = ctx.issues.find(c => c.issueId === di.issueId);
    if (ci) {
      const ctxRefs = [...ci.evidenceRefs].sort().join(',');
      const diagRefs = [...di.evidenceRefs].sort().join(',');
      if (ctxRefs !== diagRefs) {
        errors.push(verr('REMEDIATION_REFERENCE_INVALID', `diagnosis.issues[?].evidenceRefs`, `Mismatch for issueId ${di.issueId}: context has [${ctxRefs}], diagnosis has [${diagRefs}]`));
      }
    }
  }

  // ruleId, columnId, scope must match DiagnosisBlockV2
  for (const block of diagBlocks) {
    const ci = ctx.issues.find(c => c.issueId === block.issueId);
    if (ci) {
      if (ci.ruleId !== block.ruleId) {
        errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues[?].ruleId`, `Mismatch for issueId ${block.issueId}: context has ${ci.ruleId}, diagnosisBlock has ${block.ruleId}`));
      }
      if (ci.columnId !== block.columnId) {
        errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues[?].columnId`, `Mismatch for issueId ${block.issueId}: context has ${ci.columnId}, diagnosisBlock has ${block.columnId}`));
      }
      if (ci.scope !== block.scope) {
        errors.push(verr('REMEDIATION_REFERENCE_INVALID', `context.issues[?].scope`, `Mismatch for issueId ${block.issueId}: context has ${ci.scope}, diagnosisBlock has ${block.scope}`));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Build maps for subsequent validation
  // ─────────────────────────────────────────────────────────────

  const diagIssueMap = new Map(diagIssues.map(di => [di.issueId, di]));
  const diagBlockMap = new Map(diagBlocks.map(b => [b.issueId, b]));
  const ctxIssueMap = new Map(ctx.issues.map(ci => [ci.issueId, ci]));

  const issueIds = new Set(ctx.issues.map(i => i.issueId));
  const actionIds = new Set<string>();
  const issueActions = new Map<string, number>();
  const amKeys = new Set<string>();

  // ─────────────────────────────────────────────────────────────
  // ITEM 3: ActionabilityMap — keys + values
  // ─────────────────────────────────────────────────────────────

  const amap = p.actionabilityMap as Record<string, unknown>;

  // Keys: must match context issues exactly
  for (const k of Object.keys(amap)) {
    if (!issueIds.has(k)) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `actionabilityMap.${k}`, 'Issue not in context'));
    amKeys.add(k);
  }
  for (const id of issueIds) {
    if (!amKeys.has(id)) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `actionabilityMap.${id}`, 'Missing from actionabilityMap'));
  }

  // Values: must match computeEffectiveActionability
  for (const [issueId, actionability] of Object.entries(amap)) {
    // Guard: value must be a known actionability string
    if (typeof actionability !== 'string' || !VALID_ACTIONABILITIES.includes(actionability as Actionability)) {
      errors.push(verr('REMEDIATION_ACTIONABILITY_UPGRADE', `actionabilityMap.${issueId}`, `Invalid actionability value: ${JSON.stringify(actionability)}. Must be one of: ${VALID_ACTIONABILITIES.join(', ')}`));
      continue;
    }

    // Guard: array or null
    if (Array.isArray(actionability) || actionability === null) {
      errors.push(verr('REMEDIATION_ACTIONABILITY_UPGRADE', `actionabilityMap.${issueId}`, `Actionability must be string, got ${typeof actionability}`));
      continue;
    }

    const ctxIssue = ctxIssueMap.get(issueId);
    const diagIssue = diagIssueMap.get(issueId);
    if (ctxIssue) {
      const expectedEff = computeEffectiveActionability(ctxIssue, diagIssue, ctx.columns);
      if (actionability !== expectedEff) {
        errors.push(verr('REMEDIATION_ACTIONABILITY_UPGRADE', `actionabilityMap.${issueId}`, `Actionability mismatch: computed ${expectedEff}, got ${actionability}`));
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ITEM 4: Exclusions — stricter validation
  // ─────────────────────────────────────────────────────────────

  const excludedIds = new Set<string>();
  const exs = (p.exclusions as unknown[] | undefined) ?? [];

  for (let i = 0; i < exs.length; i++) {
    const ex = exs[i] as Record<string, unknown> | null;

    // Guard: must be object, not null, not array, not primitive
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', `exclusions[${i}]`, 'Must be a non-null object'));
      continue;
    }

    const exKeys = Object.keys(ex);
    if (!exKeys.includes('issueId') || !exKeys.includes('reason')) {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', `exclusions[${i}]`, 'Must contain only issueId and reason'));
    }
    if (exKeys.length > 2) {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', `exclusions[${i}]`, `Unknown properties: ${exKeys.filter(k => k !== 'issueId' && k !== 'reason').join(', ')}`));
    }

    const exIssueId = ex.issueId as string;
    const exReason = ex.reason as string;

    if (!exIssueId || typeof exIssueId !== 'string') {
      errors.push(verr('REMEDIATION_REFERENCE_INVALID', `exclusions[${i}].issueId`, 'Required string'));
    } else if (!issueIds.has(exIssueId)) {
      errors.push(verr('REMEDIATION_REFERENCE_INVALID', `exclusions[${i}].issueId`, `Unknown issueId: ${exIssueId}`));
    }

    if (exReason !== 'not_actionable') {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', `exclusions[${i}].reason`, 'Must be "not_actionable"'));
    }

    if (exIssueId && typeof exIssueId === 'string' && issueIds.has(exIssueId)) {
      // review_only cannot be excluded
      const amVal = amap[exIssueId];
      if (amVal === 'review_only') {
        errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions[${i}].issueId`, `Cannot exclude review_only issue: ${exIssueId}`));
      }

      // exclusion must correspond to not_actionable
      if (amVal === 'auto_safe') {
        errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions[${i}].issueId`, `Cannot exclude auto_safe issue: ${exIssueId}`));
      }
    }

    if (excludedIds.has(exIssueId)) {
      errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions[${i}].issueId`, `Duplicate exclusion: ${exIssueId}`));
    }
    excludedIds.add(exIssueId);
  }

  // ─────────────────────────────────────────────────────────────
  // ITEM 5: Validate actions
  // ─────────────────────────────────────────────────────────────

  const planArr = p.plan as unknown[];
  for (let i = 0; i < planArr.length; i++) {
    const rawA = planArr[i];
    const base = `plan[${i}]`;

    // Guard: each item must be object, not null, not array
    if (rawA === null || typeof rawA !== 'object' || Array.isArray(rawA)) {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', base, 'Must be a non-null object'));
      continue;
    }
    const a = rawA as Record<string, unknown>;

    // Required fields
    if (!a.actionId || typeof a.actionId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionId`, 'Required string'));
    if (!a.issueId || typeof a.issueId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.issueId`, 'Required string'));
    if (!a.ruleId || typeof a.ruleId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.ruleId`, 'Required string'));
    if (a.columnId !== null && typeof a.columnId !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.columnId`, 'Must be string or null'));
    if (!a.actionType || typeof a.actionType !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionType`, 'Required string'));
    if (!a.actionability || typeof a.actionability !== 'string') errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.actionability`, 'Required string'));
    if (!a.parameters || typeof a.parameters !== 'object' || a.parameters === null || Array.isArray(a.parameters)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.parameters`, 'Required non-null object'));

    // evidenceRefs: guard array with non-string values
    if (!Array.isArray(a.evidenceRefs)) {
      errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.evidenceRefs`, 'Must be array'));
    } else {
      for (let j = 0; j < (a.evidenceRefs as unknown[]).length; j++) {
        if (typeof (a.evidenceRefs as unknown[])[j] !== 'string') {
          errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.evidenceRefs[${j}]`, 'Must be string'));
        }
      }
    }

    const validApproval = ['pending', 'approved', 'rejected'];
    if (!validApproval.includes(a.approvalStatus as string)) errors.push(verr('REMEDIATION_APPROVAL_INVALID', `${base}.approvalStatus`, `Expected pending/approved/rejected, got ${a.approvalStatus}`));

    const aid = a.actionId as string;
    if (aid) {
      if (actionIds.has(aid)) errors.push(verr('REMEDIATION_ACTION_ID_INVALID', `${base}.actionId`, 'Duplicate actionId'));
      actionIds.add(aid);

      // ActionId correctness
      const expectedId = computeExpectedActionId(expectedDiagRef, a.issueId as string ?? '', a.ruleId as string ?? '', a.columnId as string | null, a.actionType as string ?? '');
      if (aid !== expectedId) errors.push(verr('REMEDIATION_ACTION_ID_INVALID', `${base}.actionId`, `Expected ${expectedId}`));
    }

    const aIssueId = a.issueId as string;
    if (aIssueId) {
      if (!issueIds.has(aIssueId)) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.issueId`, 'Unknown issueId'));

      const ctxIssue = ctxIssueMap.get(aIssueId);
      if (ctxIssue) {
        if (a.ruleId !== ctxIssue.ruleId) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.ruleId`, 'Mismatch with context'));
        if (a.columnId !== ctxIssue.columnId) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.columnId`, 'Mismatch with context'));

        // evidenceRefs must match context exactly
        const expectedRefs = [...ctxIssue.evidenceRefs].sort().join(',');
        const actualRefs = [...(a.evidenceRefs as string[] ?? [])].sort().join(',');
        if (expectedRefs !== actualRefs) errors.push(verr('REMEDIATION_REFERENCE_INVALID', `${base}.evidenceRefs`, 'Mismatch with context'));

        const expectedActionType = lookupRemediationAction(a.ruleId as string ?? '');
        if (a.actionType !== expectedActionType) errors.push(verr('REMEDIATION_ACTION_NOT_ALLOWED', `${base}.actionType`, `Expected ${expectedActionType}`));

        const diagIssue = diagIssueMap.get(aIssueId);
        const expectedEff = computeEffectiveActionability(ctxIssue, diagIssue, ctx.columns);
        if (a.actionability !== expectedEff) errors.push(verr('REMEDIATION_ACTIONABILITY_UPGRADE', `${base}.actionability`, `Expected ${expectedEff}, got ${a.actionability}`));
      }
    }

    if (a.actionType && typeof a.actionType === 'string') {
      const paramErrs = validateParams(a.actionType, a.parameters);
      for (const pe of paramErrs) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.parameters`, pe));
    }

    // Extra properties in action
    const knownActionProps = ['actionId', 'issueId', 'ruleId', 'columnId', 'actionType', 'parameters', 'actionability', 'evidenceRefs', 'approvalStatus'];
    for (const k of Object.keys(a)) { if (!knownActionProps.includes(k)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', `${base}.${k}`, 'Unknown property')); }

    if (aIssueId) {
      const cnt = (issueActions.get(aIssueId) ?? 0) + 1;
      issueActions.set(aIssueId, cnt);
      if (cnt > 1) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `${base}.issueId`, 'Multiple actions for same issue'));
    }
  }

  // No action + exclusion for same issue
  for (const exId of excludedIds) {
    if (issueActions.has(exId)) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `exclusions`, `Issue ${exId} has both action and exclusion`));
  }

  // Coverage: every issue has action OR exclusion (not both, not neither)
  for (const id of issueIds) {
    const hasAction = issueActions.has(id);
    const hasExclusion = excludedIds.has(id);
    if (!hasAction && !hasExclusion) errors.push(verr('REMEDIATION_COVERAGE_INVALID', `issue.${id}`, 'Not covered by action or exclusion'));
  }

  // ─────────────────────────────────────────────────────────────
  // Top-level extra properties
  // ─────────────────────────────────────────────────────────────
  const topKeys = ['contractId', 'contractVersion', 'planId', 'diagnosisRef', 'evidenceEnvelopeRef', 'datasetFingerprint', 'plan', 'actionabilityMap', 'exclusions', 'generatedAt'];
  for (const k of Object.keys(p)) { if (!topKeys.includes(k)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', k, 'Unknown top-level property')); }

  // ─────────────────────────────────────────────────────────────
  // Executable content check
  // ─────────────────────────────────────────────────────────────
  const json = JSON.stringify(plan);
  const suspicious = [/\beval\b/, /\bexec\b/, /\bos\.system\b/, /\bsubprocess\b/, /\b__import__\b/];
  for (const pattern of suspicious) {
    if (pattern.test(json)) errors.push(verr('REMEDIATION_SCHEMA_INVALID', '', 'Executable content detected'));
  }

  return { valid: errors.length === 0, errors, warnings };
}
