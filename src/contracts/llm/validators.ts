/**
 * Validators — Phase 1C. Fail-closed. No LLM.
 * Adds: cloud_minimized post-build validation (no raw PII, valid hashes).
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
} from './types';

const VALID_ACTIONABILITIES: Set<Actionability> = new Set(['auto_safe', 'review_only', 'not_actionable']);
const VALID_SCOPES: Set<IssueScope> = new Set(['dataset', 'column']);

const RAW_PII_PATTERNS = [
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
  /^\d{3}-\d{2}-\d{4}$/,
  /^https?:\/\/[^\s]+$/i,
];

// ── Top-level ──

export function validateEnvelope(envelope: EvidenceEnvelopeV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];

  if (envelope.contractId !== 'aura.evidence.v2') errors.push(err('contractId', `Expected aura.evidence.v2`));
  if (envelope.contractVersion !== '2.0.0') errors.push(err('contractVersion', 'Expected 2.0.0'));
  if (envelope.untrustedContent !== true) errors.push(err('untrustedContent', 'MUST be true'));
  if (!envelope.columns || envelope.columns.length === 0) errors.push(err('columns', 'Must contain at least one column'));

  // Unique columnIds
  const colIds = envelope.columns.map(c => c.columnId);
  const dupCols = findDuplicates(colIds);
  for (const dup of dupCols) errors.push(err('columns.columnId', `Duplicate columnId: ${dup}`));

  const columnIds = new Set(colIds);

  // Validate each column
  for (let i = 0; i < envelope.columns.length; i++) {
    const cr = validateColumnRef(envelope.columns[i], i);
    errors.push(...cr.errors);
    warnings.push(...cr.warnings);
  }

  // Issues
  const issueIds = new Set<string>();
  for (const issue of envelope.issues) {
    if (issueIds.has(issue.issueId)) errors.push(err(`issues.${issue.issueId}.issueId`, 'Duplicate issueId'));
    issueIds.add(issue.issueId);

    const ir = validateIssue(issue, envelope.columns);
    errors.push(...ir.errors);
    warnings.push(...ir.warnings);

    if (issue.scope === 'dataset' && issue.columnId !== null) {
      errors.push(err(`issues.${issue.issueId}.columnId`, 'dataset-scoped issue must have columnId=null'));
    }
    if (issue.scope === 'column') {
      if (!issue.columnId) {
        errors.push(err(`issues.${issue.issueId}.columnId`, 'column-scoped issue must have non-null columnId'));
      } else if (!columnIds.has(issue.columnId)) {
        errors.push(err(`issues.${issue.issueId}.columnId`, `ColumnId ${issue.columnId} not found`));
      }
    }
    if (issue.columnId === 'col:unknown') errors.push(err(`issues.${issue.issueId}.columnId`, 'Must not be col:unknown'));
  }

  // Evidence samples
  const evidenceRefs = new Set<string>();
  for (const sample of envelope.evidence.samples) {
    if (evidenceRefs.has(sample.evidenceRef)) errors.push(err(`evidence.samples.${sample.evidenceRef}`, 'Duplicate evidenceRef'));
    evidenceRefs.add(sample.evidenceRef);

    if (!issueIds.has(sample.issueId)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.issueId`, `IssueId ${sample.issueId} not found`));
    }
    if (sample.columnId && !columnIds.has(sample.columnId)) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.columnId`, `ColumnId ${sample.columnId} not found`));
    }

    const issue = envelope.issues.find(i => i.issueId === sample.issueId);
    if (issue && sample.columnId !== issue.columnId) {
      errors.push(err(`evidence.samples.${sample.evidenceRef}.columnId`, `columnId ${sample.columnId} != issue columnId ${issue.columnId}`));
    }
  }

  // evidenceRefs in issues → error if missing
  for (const issue of envelope.issues) {
    for (const ref of issue.evidenceRefs) {
      if (!evidenceRefs.has(ref)) {
        errors.push(err(`issues.${issue.issueId}.evidenceRefs`, `EvidenceRef ${ref} does not exist in evidence.samples`));
      }
    }
  }

  // columnStats keys
  for (const colId of Object.keys(envelope.evidence.columnStats)) {
    if (!columnIds.has(colId)) errors.push(err(`evidence.columnStats.${colId}`, `ColumnId ${colId} not found`));
  }

  // Privacy compliance
  const priv = validatePrivacyCompliance(envelope);
  errors.push(...priv.errors);
  warnings.push(...priv.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

// ── Issue ──

export function validateIssue(issue: EvidenceIssueV2, colRegistry: ColumnRef[]): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  if (!issue.issueId) errors.push(err('issueId', 'Must be non-empty string'));
  if (!issue.ruleId) errors.push(err('ruleId', 'Must be non-empty string'));
  if (!issue.ruleName) errors.push(err('ruleName', 'Must be non-empty string'));
  if (!VALID_SCOPES.has(issue.scope)) errors.push(err('scope', `Invalid: ${issue.scope}`));
  if (!VALID_ACTIONABILITIES.has(issue.actionability)) errors.push(err('actionability', `Invalid: ${issue.actionability}`));
  if (issue.count < 0) errors.push(err('count', 'Must be >= 0'));
  if (issue.affectedPercentage < 0 || issue.affectedPercentage > 100) errors.push(err('affectedPercentage', 'Must be 0-100'));
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Column ──

export function validateColumnRef(col: ColumnRef, index: number): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];
  if (!col.columnId?.startsWith('col:')) errors.push(err(`columns[${index}].columnId`, `Invalid: ${col.columnId}`));
  if (!col.name) errors.push(err(`columns[${index}].name`, 'Must be non-empty'));
  if (col.position < 0) errors.push(err(`columns[${index}].position`, 'Must be >= 0'));
  if (col.duplicateOrdinal < 0) errors.push(err(`columns[${index}].duplicateOrdinal`, 'Must be >= 0'));
  if (col.isAmbiguous) warnings.push(warn(`columns[${index}]`, `Ambiguous: ${col.name}`));
  if (col.isReservedWord) warnings.push(warn(`columns[${index}]`, `Reserved: ${col.name}`));
  return { valid: errors.length === 0, errors, warnings };
}

// ── Privacy compliance ──

export function validatePrivacyCompliance(envelope: EvidenceEnvelopeV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const warnings: ValidationErrorV2[] = [];
  const policy = envelope.privacyPolicy;

  if (policy.level === 'cloud_no_samples') {
    if (envelope.evidence.samples.length > 0) {
      errors.push(err('evidence.samples', 'cloud_no_samples requires samples=[]'));
    }
    for (const colId of Object.keys(envelope.evidence.columnStats)) {
      if ((envelope.evidence.columnStats[colId]?.topValues?.length || 0) > 0) {
        errors.push(err(`evidence.columnStats.${colId}.topValues`, 'cloud_no_samples requires topValues=[]'));
      }
    }
  }

  if (policy.level === 'cloud_minimized') {
    validateCloudMinimizedEnvelope(envelope, errors, warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * cloud_minimized post-build:
 * - No raw PII in sample values or topValues
 * - Hashed values: sha256: prefix + 64 hex
 * - Redacted values contain ***
 */
function validateCloudMinimizedEnvelope(
  envelope: EvidenceEnvelopeV2,
  errors: ValidationErrorV2[],
  warnings: ValidationErrorV2[],
): void {
  for (const sample of envelope.evidence.samples) {
    for (const val of sample.values) {
      const s = String(val ?? '');
      if (!s.startsWith('sha256:') && !s.includes('***')) {
        for (const p of RAW_PII_PATTERNS) {
          if (p.test(s)) {
            errors.push(err(`samples.${sample.evidenceRef}`, `Raw PII in cloud_minimized: ${s.slice(0, 30)}`));
          }
        }
      }
      if (s.startsWith('sha256:') && !/^sha256:[a-f0-9]{64}$/.test(s)) {
        errors.push(err(`samples.${sample.evidenceRef}`, `Invalid hash: ${s.slice(0, 20)}`));
      }
    }
  }

  for (const colId of Object.keys(envelope.evidence.columnStats)) {
    const stats = envelope.evidence.columnStats[colId];
    if (stats?.topValues) {
      for (const tv of stats.topValues) {
        const s = String(tv.value || '');
        if (!s.startsWith('sha256:') && !s.includes('***')) {
          for (const p of RAW_PII_PATTERNS) {
            if (p.test(s)) {
              errors.push(err(`columnStats.${colId}.topValues`, `Raw PII in cloud_minimized: ${s.slice(0, 30)}`));
            }
          }
        }
      }
    }
  }
}

// ── Structural ──

export function validatePrivacyPolicy(policy: PrivacyPolicyV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  if (!['local_full', 'cloud_minimized', 'cloud_no_samples'].includes(policy.level)) {
    errors.push(err('level', `Invalid: ${policy.level}`));
  }
  for (const rule of policy.rules) {
    if (!['redact', 'hash', 'omit', 'limit'].includes(rule.type)) errors.push(err('rule.type', `Invalid: ${rule.type}`));
    if (!['column', 'issue', 'sample', 'value'].includes(rule.target)) errors.push(err('rule.target', `Invalid: ${rule.target}`));
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateTokenBudget(budget: TokenBudgetV2): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  if (budget.maxColumns < 1) errors.push(err('maxColumns', '>=1'));
  if (budget.maxIssues < 1) errors.push(err('maxIssues', '>=1'));
  if (budget.maxSamplesPerIssue < 0) errors.push(err('maxSamplesPerIssue', '>=0'));
  if (budget.maxTopValues < 0) errors.push(err('maxTopValues', '>=0'));
  if (budget.maxCharacters < 0) errors.push(err('maxCharacters', '>=0'));
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateEvidenceRefs(refs: string[], samples: EvidenceSampleV2[]): ValidationResultV2 {
  const errors: ValidationErrorV2[] = [];
  const sampleRefs = new Set(samples.map(s => s.evidenceRef));
  for (const ref of refs) {
    if (!sampleRefs.has(ref)) errors.push(err('evidenceRefs', `Ref ${ref} not found`));
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ── Helpers ──

function err(path: string, msg: string): ValidationErrorV2 { return { path, message: msg, value: undefined }; }
function warn(path: string, msg: string): ValidationErrorV2 { return { path, message: msg, value: undefined }; }

function findDuplicates(arr: string[]): string[] {
  const seen = new Map<string, number>();
  const dups: string[] = [];
  for (const item of arr) {
    const c = (seen.get(item) || 0) + 1;
    seen.set(item, c);
    if (c === 2) dups.push(item);
  }
  return dups;
}

export function aggregateResults(results: ValidationResultV2[]): ValidationResultV2 {
  const e: ValidationErrorV2[] = [], w: ValidationErrorV2[] = [];
  for (const r of results) { e.push(...r.errors); w.push(...r.warnings); }
  return { valid: e.length === 0, errors: e, warnings: w };
}
