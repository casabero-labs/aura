/**
 * Validators — Phase 1B.
 *
 * Fail-closed: every check that fails prevents the envelope from being valid.
 * No LLM. Pure structural + referential integrity + privacy + budget.
 */

import type {
  ColumnRef,
  EvidenceEnvelopeV2,
  EvidenceIssueV2,
  EvidenceSampleV2,
  Actionability,
  IssueScope,
  ValidationErrorV2,
  ValidationResultV2,
  PrivacyPolicyV2,
  TokenBudgetV2,
  ExclusionReason,
} from './types';

const VALID_ACTIONABILITIES: Set<Actionability> = new Set(['auto_safe', 'review_only', 'not_actionable']);
const VALID_SCOPES: Set<IssueScope> = new Set(['dataset', 'column']);

// ── Top-level ──

export function validateEnvelope(envelope: EvidenceEnvelopeV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (envelope.contractId !== 'aura.evidence.v2') {
    errors.push(err('contractId', `Expected aura.evidence.v2, got ${envelope.contractId}`));
  }
  if (envelope.contractVersion !== '2.0.0') {
    errors.push(err('contractVersion', `Expected 2.0.0, got ${envelope.contractVersion}`));
  }
  if (envelope.untrustedContent !== true) {
    errors.push(err('untrustedContent', 'MUST be true'));
  }

  // Columns non-empty
  if (!envelope.columns || envelope.columns.length === 0) {
    errors.push(err('columns', 'Must contain at least one column'));
  } else {
    // Unique columnIds
    const colIds = envelope.columns.map(c => c.columnId);
    const dupCols = findDuplicates(colIds);
    for (const dup of dupCols) {
      errors.push(err('columns.columnId', `Duplicate columnId: ${dup}`));
    }
  }

  // Validate each column
  const columnIds = new Set(envelope.columns.map(c => c.columnId));
  for (let i = 0; i < envelope.columns.length; i++) {
    const colResult = validateColumnRef(envelope.columns[i], i);
    errors.push(...colResult.errors);
    warnings.push(...colResult.warnings);
  }

  // Issues
  const issueIds = new Set<string>();
  for (const issue of envelope.issues) {
    // Unique issueIds
    if (issueIds.has(issue.issueId)) {
      errors.push(err(`issues.${issue.issueId}.issueId`, 'Duplicate issueId'));
    }
    issueIds.add(issue.issueId);

    // Issue validation
    const iResult = validateIssue(issue, envelope.columns);
    errors.push(...iResult.errors);
    warnings.push(...iResult.warnings);

    // Scope: dataset issues must have columnId=null
    if (issue.scope === 'dataset' && issue.columnId !== null) {
      errors.push(err(`issues.${issue.issueId}.columnId`, 'dataset-scoped issue must have columnId=null'));
    }
    // Scope: column issues must have valid columnId
    if (issue.scope === 'column') {
      if (!issue.columnId) {
        errors.push(err(`issues.${issue.issueId}.columnId`, 'column-scoped issue must have a non-null columnId'));
      } else if (!columnIds.has(issue.columnId)) {
        errors.push(err(`issues.${issue.issueId}.columnId`, `ColumnId ${issue.columnId} not found in columns registry`));
      }
    }

    // No col:unknown
    if (issue.columnId === 'col:unknown') {
      errors.push(err(`issues.${issue.issueId}.columnId`, 'Must not be col:unknown'));
    }
  }

  // Evidence samples
  const evidenceRefs = new Set<string>();
  for (const sample of envelope.evidence.samples) {
    // Unique evidenceRefs
    if (evidenceRefs.has(sample.evidenceRef)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}`, 'Duplicate evidenceRef'));
    }
    evidenceRefs.add(sample.evidenceRef);

    // sample.issueId must exist
    if (!issueIds.has(sample.issueId)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.issueId`, `IssueId ${sample.issueId} not found`));
    }

    // sample.columnId must exist in columns (if non-null)
    if (sample.columnId && !columnIds.has(sample.columnId)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.columnId`, `ColumnId ${sample.columnId} not found`));
    }

    // sample.columnId must match its issue's columnId
    const issue = envelope.issues.find(i => i.issueId === sample.issueId);
    if (issue && sample.columnId !== issue.columnId) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.columnId`, `columnId ${sample.columnId} does not match issue columnId ${issue.columnId}`));
    }
  }

  // evidenceRefs in issues must all exist (error, not warning)
  for (const issue of envelope.issues) {
    for (const ref of issue.evidenceRefs) {
      if (!evidenceRefs.has(ref)) {
        errors.push(err(`issues.${issue.issueId}.evidenceRefs`, `EvidenceRef ${ref} does not exist in evidence.samples`));
      }
    }
  }

  // columnStats keys must match columnIds
  for (const colId of Object.keys(envelope.evidence.columnStats)) {
    if (!columnIds.has(colId)) {
      errors.push(err(`evidence.columnStats.${colId}`, `ColumnId ${colId} not found in columns registry`));
    }
  }

  // Privacy compliance on final envelope
  const privResult = validatePrivacyCompliance(envelope);
  errors.push(...privResult.errors);

  return { valid: errors.length === 0, errors, warnings };
}

// ── Individual validators ──

export function validateIssue(issue: EvidenceIssueV2, colRegistry: ColumnRef[]): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (!issue.issueId || typeof issue.issueId !== 'string') errors.push(err('issueId', 'Must be non-empty string'));
  if (!issue.ruleId || typeof issue.ruleId !== 'string') errors.push(err('ruleId', 'Must be non-empty string'));
  if (!issue.ruleName || typeof issue.ruleName !== 'string') errors.push(err('ruleName', 'Must be non-empty string'));

  if (!VALID_SCOPES.has(issue.scope)) {
    errors.push(err('scope', `Invalid scope: ${issue.scope}. Must be dataset or column`));
  }

  if (issue.scope === 'column' && issue.columnId) {
    if (!colRegistry.some(c => c.columnId === issue.columnId)) {
      errors.push(err('columnId', `ColumnId ${issue.columnId} not found in registry`));
    }
  }

  if (!VALID_ACTIONABILITIES.has(issue.actionability)) {
    errors.push(err('actionability', `Invalid: ${issue.actionability}`));
  }

  if (issue.count < 0) errors.push(err('count', 'Must be >= 0'));
  if (issue.affectedPercentage < 0 || issue.affectedPercentage > 100) errors.push(err('affectedPercentage', 'Must be 0-100'));

  return { valid: errors.length === 0, errors, warnings };
}

export function validateColumnRef(col: ColumnRef, index: number): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (!col.columnId || !col.columnId.startsWith('col:')) {
    errors.push(err(`columns[${index}].columnId`, `Invalid format: ${col.columnId}`));
  }
  if (!col.name || typeof col.name !== 'string') errors.push(err(`columns[${index}].name`, 'Must be non-empty string'));
  if (col.position < 0) errors.push(err(`columns[${index}].position`, 'Must be >= 0'));
  if (col.duplicateOrdinal < 0) errors.push(err(`columns[${index}].duplicateOrdinal`, 'Must be >= 0'));

  if (col.isAmbiguous) warnings.push(warn(`columns[${index}]`, `Ambiguous column '${col.name}' requires human review`));
  if (col.isReservedWord) warnings.push(warn(`columns[${index}]`, `Reserved word: '${col.name}'`));
  if (col.isDuplicate) warnings.push(warn(`columns[${index}]`, `Duplicate name: '${col.name}' cannot be auto-resolved`));

  return { valid: errors.length === 0, errors, warnings };
}

// ── Privacy compliance ──

export function validatePrivacyCompliance(envelope: EvidenceEnvelopeV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const policy = envelope.privacyPolicy;

  if (policy.level === 'cloud_no_samples') {
    if (envelope.evidence.samples.length > 0) {
      errors.push(err('evidence.samples', 'cloud_no_samples policy requires samples=[]'));
    }
    for (const colId of Object.keys(envelope.evidence.columnStats)) {
      if ((envelope.evidence.columnStats[colId]?.topValues?.length || 0) > 0) {
        errors.push(err(`evidence.columnStats.${colId}.topValues`, 'cloud_no_samples policy requires topValues=[]'));
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Privacy policy structural ──

export function validatePrivacyPolicy(policy: PrivacyPolicyV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const validLevels = ['local_full', 'cloud_minimized', 'cloud_no_samples'];

  if (!validLevels.includes(policy.level)) {
    errors.push(err('privacyPolicy.level', `Invalid: ${policy.level}`));
  }
  for (const rule of policy.rules) {
    if (!['redact', 'hash', 'omit', 'limit'].includes(rule.type)) {
      errors.push(err('rule.type', `Invalid: ${rule.type}`));
    }
    if (!['column', 'issue', 'sample', 'value'].includes(rule.target)) {
      errors.push(err('rule.target', `Invalid: ${rule.target}`));
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Token budget ──

export function validateTokenBudget(budget: TokenBudgetV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  if (budget.maxColumns < 1) errors.push(err('maxColumns', 'Must be >= 1'));
  if (budget.maxIssues < 1) errors.push(err('maxIssues', 'Must be >= 1'));
  if (budget.maxSamplesPerIssue < 0) errors.push(err('maxSamplesPerIssue', 'Must be >= 0'));
  if (budget.maxTopValues < 0) errors.push(err('maxTopValues', 'Must be >= 0'));
  if (budget.maxCharacters < 0) errors.push(err('maxCharacters', 'Must be >= 0'));
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Evidence refs ──

export function validateEvidenceRefs(refs: string[], samples: EvidenceSampleV2[]): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const sampleRefs = new Set(samples.map(s => s.evidenceRef));
  for (const ref of refs) {
    if (!sampleRefs.has(ref)) {
      errors.push(err('evidenceRefs', `EvidenceRef ${ref} does not exist in evidence.samples`));
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Helpers ──

function err(path: string, message: string): ValidationErrorV2 {
  return { path, message, value: undefined };
}

function warn(path: string, message: string): ValidationErrorV2 {
  return { path, message, value: undefined };
}

function findDuplicates(arr: string[]): string[] {
  const seen = new Map<string, number>();
  const dups: string[] = [];
  for (const item of arr) {
    const count = (seen.get(item) || 0) + 1;
    seen.set(item, count);
    if (count === 2) dups.push(item);
  }
  return dups;
}

export function aggregateResults(results: ValidationResultV2[]): ValidationResultV2 {
  const allErrors: ValidationErrorV2[] = [];
  const allWarnings: ValidationErrorV2[] = [];
  for (const r of results) {
    allErrors.push(...r.errors);
    allWarnings.push(...r.warnings);
  }
  return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
}
