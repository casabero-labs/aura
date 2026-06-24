/**
 * Validators — Fase 1.
 *
 * Deterministic validators for Contracts v2 payloads.
 * No LLM involvement. Pure structural and referential integrity checks.
 */

import type {
  ColumnRef,
  EvidenceEnvelopeV2,
  EvidenceIssueV2,
  EvidenceSampleV2,
  Actionability,
  ValidationErrorV2,
  ValidationResultV2,
  PrivacyPolicyV2,
  TokenBudgetV2,
} from './types';

const VALID_ACTIONABILITIES: Set<Actionability> = new Set(['auto_safe', 'review_only', 'not_actionable']);

// ── Top-level envelope validators ──

export function validateEnvelope(envelope: EvidenceEnvelopeV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  // contractId
  if (envelope.contractId !== 'aura.evidence.v2') {
    errors.push(err('contractId', `Expected aura.evidence.v2, got ${envelope.contractId}`));
  }

  // contractVersion
  if (envelope.contractVersion !== '2.0.0') {
    errors.push(err('contractVersion', `Expected 2.0.0, got ${envelope.contractVersion}`));
  }

  // untrustedContent MUST be true
  if (envelope.untrustedContent !== true) {
    errors.push(err('untrustedContent', 'MUST be true in Contracts v2'));
  }

  // columns must be non-empty
  if (!envelope.columns || envelope.columns.length === 0) {
    errors.push(err('columns', 'Must contain at least one column'));
  }

  // Validate columnIds exist for all issues
  const columnIds = new Set(envelope.columns.map(c => c.columnId));
  for (const issue of envelope.issues) {
    if (!columnIds.has(issue.columnId)) {
      errors.push(err(`issues.${issue.issueId}.columnId`, `ColumnId ${issue.columnId} not found in columns registry`));
    }
  }

  // Validate evidenceRefs in samples point to real issues
  const issueIds = new Set(envelope.issues.map(i => i.issueId));
  for (const sample of envelope.evidence.samples) {
    if (!issueIds.has(sample.issueId)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.issueId`, `IssueId ${sample.issueId} not found`));
    }
  }

  // Validate evidenceRefs in issues point to real samples
  const evidenceRefs = new Set(envelope.evidence.samples.map(s => s.evidenceRef));
  for (const issue of envelope.issues) {
    for (const ref of issue.evidenceRefs) {
      if (!evidenceRefs.has(ref)) {
        warnings.push(warn(`issues.${issue.issueId}.evidenceRefs`, `EvidenceRef ${ref} has no matching sample`));
      }
    }
  }

  // Validate columnStats keys match columnIds
  for (const colId of Object.keys(envelope.evidence.columnStats)) {
    if (!columnIds.has(colId)) {
      errors.push(err(`evidence.columnStats.${colId}`, `ColumnId ${colId} not found in columns registry`));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Issue validators ──

export function validateIssue(
  issue: EvidenceIssueV2,
  columnRegistry: ColumnRef[],
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (!issue.issueId || typeof issue.issueId !== 'string') {
    errors.push(err('issueId', 'Must be a non-empty string'));
  }

  if (!issue.ruleId || typeof issue.ruleId !== 'string') {
    errors.push(err('ruleId', 'Must be a non-empty string'));
  }

  if (!issue.ruleName || typeof issue.ruleName !== 'string') {
    errors.push(err('ruleName', 'Must be a non-empty string'));
  }

  if (!issue.columnId || typeof issue.columnId !== 'string') {
    errors.push(err('columnId', 'Must be a non-empty string'));
  } else if (!columnRegistry.some(c => c.columnId === issue.columnId)) {
    errors.push(err('columnId', `ColumnId ${issue.columnId} not found in registry`));
  }

  if (!VALID_ACTIONABILITIES.has(issue.actionability)) {
    errors.push(err('actionability', `Invalid: ${issue.actionability}. Must be one of: auto_safe, review_only, not_actionable`));
  }

  if (issue.count < 0) {
    errors.push(err('count', 'Must be >= 0'));
  }

  if (issue.affectedPercentage < 0 || issue.affectedPercentage > 100) {
    errors.push(err('affectedPercentage', 'Must be between 0 and 100'));
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Column validators ──

export function validateColumnRef(col: ColumnRef, index: number): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (!col.columnId || !col.columnId.startsWith('col:')) {
    errors.push(err(`columns[${index}].columnId`, `Invalid format: ${col.columnId}`));
  }

  if (!col.name || typeof col.name !== 'string') {
    errors.push(err(`columns[${index}].name`, 'Must be a non-empty string'));
  }

  if (col.position < 0) {
    errors.push(err(`columns[${index}].position`, 'Must be >= 0'));
  }

  if (col.duplicateOrdinal < 0) {
    errors.push(err(`columns[${index}].duplicateOrdinal`, 'Must be >= 0'));
  }

  if (col.isAmbiguous) {
    warnings.push(warn(`columns[${index}].isAmbiguous`, `Column '${col.name}' is ambiguous and requires human review`));
  }

  if (col.isReservedWord) {
    warnings.push(warn(`columns[${index}].isReservedWord`, `Column '${col.name}' is a Python reserved word`));
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Reference validators ──

export function validateEvidenceRefs(
  refs: string[],
  samples: EvidenceSampleV2[],
): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];
  const sampleRefs = new Set(samples.map(s => s.evidenceRef));

  for (const ref of refs) {
    if (!sampleRefs.has(ref)) {
      errors.push(err('evidenceRefs', `EvidenceRef ${ref} does not exist in evidence.samples`));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Privacy validators ──

export function validatePrivacyPolicy(policy: PrivacyPolicyV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const validLevels = ['local_full', 'cloud_minimized', 'cloud_no_samples'];

  if (!validLevels.includes(policy.level)) {
    errors.push(err('privacyPolicy.level', `Invalid level: ${policy.level}`));
  }

  for (const rule of policy.rules) {
    if (!['redact', 'hash', 'omit', 'limit'].includes(rule.type)) {
      errors.push(err('privacyPolicy.rule.type', `Invalid rule type: ${rule.type}`));
    }
    if (!['column', 'issue', 'sample', 'value'].includes(rule.target)) {
      errors.push(err('privacyPolicy.rule.target', `Invalid rule target: ${rule.target}`));
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Budget validators ──

export function validateTokenBudget(budget: TokenBudgetV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];

  if (budget.maxColumns < 1) errors.push(err('maxColumns', 'Must be >= 1'));
  if (budget.maxIssues < 1) errors.push(err('maxIssues', 'Must be >= 1'));
  if (budget.maxSamplesPerIssue < 0) errors.push(err('maxSamplesPerIssue', 'Must be >= 0'));
  if (budget.maxTopValues < 0) errors.push(err('maxTopValues', 'Must be >= 0'));
  if (budget.maxCharacters < 0) errors.push(err('maxCharacters', 'Must be >= 0'));

  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Helpers ──

function err(path: string, message: string): ValidationErrorV2 {
  return { path, message, value: undefined };
}

function warn(path: string, message: string): ValidationErrorV2 {
  return { path, message, value: undefined };
}

/**
 * Aggregate multiple validation results into one.
 */
export function aggregateResults(results: ValidationResultV2[]): ValidationResultV2 {
  const allErrors: ValidationErrorV2[] = [];
  const allWarnings: ValidationErrorV2[] = [];
  for (const r of results) {
    allErrors.push(...r.errors);
    allWarnings.push(...r.warnings);
  }
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}
