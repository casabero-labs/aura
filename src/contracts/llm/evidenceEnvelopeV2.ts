/**
 * Evidence Envelope V2 — Phase 1C.
 *
 * - Internal builder (_buildEvidenceEnvelopeV2) + public wrapper (buildEvidenceEnvelopeV2)
 * - Actionability: ruleId → defaultActionability lookup. BANNED: regex, heuristic, fabrication
 * - auto_safe only when automaticAuthorization.authorized === true
 * - ruleId and automaticAuthorization copied from engine-issued QualityIssue
 * - cloud_minimized: preserves real minimized samples (redacted/hashed)
 * - maxCharacters: throws BUDGET_UNSATISFIABLE if cannot comply
 * - Duplicate columns: columnId+position, NEVER rawName lookup
 */

import {
  buildColumnRegistry,
  getColumnById,
  resolveColumn,
} from './columnRegistry';
import type { AmbiguousLookupError } from './columnRegistry';
import {
  buildPrivacyPolicy,
  shouldHashColumn,
  isPII,
  redactValue,
  hashValue,
  allowsRawSamples,
  allowsTopValues,
  buildPIIConfig,
} from './privacyPolicy';
import {
  buildTokenBudget,
  createTruncationManifest,
  logColumnExclusion,
  logIssueExclusion,
  logSampleTruncation,
  logTopValueTruncation,
  enforceCharacterBudget,
  applySlice,
  logCharacterTruncation,
} from './tokenBudget';
import {
  validateEnvelope,
  validatePrivacyPolicy,
  validateTokenBudget,
} from './validators';
import type {
  EvidenceEnvelopeV2,
  EvidenceIssueV2,
  EvidenceSampleV2,
  EvidenceV2,
  ColumnStatsV2,
  SelectionManifestV2,
  ManifestExclusionV2,
  EvidenceEnvelopeOptionsV2,
  Actionability,
  IssueScope,
  ExclusionReason,
  AutomaticAuthorization,
  BuildErrorV2,
  DatasetSummaryV2,
  PrivacyPolicyV2,
  TokenBudgetV2,
  TruncationManifestV2,
} from './types';

// ── RuleId → defaultActionability lookup (deterministic, no regex) ──

const RULE_POLICY: Record<string, { defaultActionability: Actionability; scope: IssueScope }> = {
  'rule:trim-whitespace':            { defaultActionability: 'auto_safe',       scope: 'column' },
  'rule:exact-duplicates':           { defaultActionability: 'auto_safe',       scope: 'dataset' },
  'rule:null-values':                { defaultActionability: 'review_only',     scope: 'column' },
  'rule:constant-column':            { defaultActionability: 'review_only',     scope: 'column' },
  'rule:mixed-types':                { defaultActionability: 'review_only',     scope: 'column' },
  'rule:header-verbose':             { defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:mojibake':                   { defaultActionability: 'review_only',     scope: 'column' },
  'rule:toxic-placeholders':         { defaultActionability: 'review_only',     scope: 'column' },
  'rule:mixed-date-formats':         { defaultActionability: 'review_only',     scope: 'column' },
  'rule:capitalization-chaos':       { defaultActionability: 'review_only',     scope: 'column' },
  'rule:semantic-variants':          { defaultActionability: 'review_only',     scope: 'column' },
  'rule:long-tail-categorical':      { defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:double-spaces':              { defaultActionability: 'review_only',     scope: 'column' },
  'rule:suspicious-symbols':         { defaultActionability: 'review_only',     scope: 'column' },
  'rule:malformed-urls':             { defaultActionability: 'review_only',     scope: 'column' },
  'rule:text-overflow':              { defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:disguised-numbers':          { defaultActionability: 'review_only',     scope: 'column' },
  'rule:hidden-dates':               { defaultActionability: 'review_only',     scope: 'column' },
  'rule:corrupt-ids':                { defaultActionability: 'review_only',     scope: 'column' },
  'rule:redundant-time':             { defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:burned-demographic-ranges':  { defaultActionability: 'review_only',     scope: 'column' },
  'rule:impossible-negatives':       { defaultActionability: 'review_only',     scope: 'column' },
  'rule:extreme-outliers':           { defaultActionability: 'review_only',     scope: 'column' },
  'rule:mild-outliers':              { defaultActionability: 'review_only',     scope: 'column' },
  'rule:invalid-email':              { defaultActionability: 'review_only',     scope: 'column' },
  'rule:variable-phone-length':      { defaultActionability: 'review_only',     scope: 'column' },
  'rule:pii-detected':              { defaultActionability: 'review_only',     scope: 'column' },
  'rule:future-dates':              { defaultActionability: 'review_only',     scope: 'column' },
  'rule:temporal-inconsistency':     { defaultActionability: 'review_only',     scope: 'dataset' },
  'rule:temporal-redundancy':       { defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:semantic-column-duplication':{ defaultActionability: 'not_actionable',  scope: 'column' },
  'rule:id-semantic-contamination': { defaultActionability: 'review_only',     scope: 'column' },
};

const DEFAULT_ACTIONABILITY: Actionability = 'review_only';
const DEFAULT_SCOPE: IssueScope = 'column';

// ── Input types ──

export interface AuditReportInput {
  score: number;
  rowCount: number;
  colCount: number;
  duplicateRows: number;
  delimiterDetected: string;
  issues: Array<{
    id: string;
    column?: string;
    ruleName: string;
    ruleId: string;
    category: string;
    description: string;
    severity: 'critical' | 'warning' | 'info' | 'good';
    count: number;
    affectedPercentage: number;
    sampleValues?: (string | number | null)[];
    automaticAuthorization?: AutomaticAuthorization;
  }>;
  columnStats?: Record<string, {
    inferredType?: string;
    semanticType?: string;
    distinctCount?: number;
    nullCount?: number;
    nullPercentage?: number;
    topValues?: Array<{ value: string; count: number; percentage: number }>;
    stats?: Record<string, number>;
  }>;
  datasetProfile?: {
    columns?: Array<{
      name: string;
      inferredType?: string;
      semanticType?: string;
      cardinality?: number;
    }>;
  };
  scoreBreakdown?: Array<{ reason: string; points: number; category: string; severity: string; ruleId: string }>;
}

// ── Internal builder (no gate, no side effects) ──

export function _buildEvidenceEnvelopeV2(
  report: AuditReportInput,
  options: EvidenceEnvelopeOptionsV2,
): EvidenceEnvelopeV2 {
  // 1. Columns
  const colNames = (report.datasetProfile?.columns || []).map(c => c.name);
  const allColumns = buildColumnRegistry(colNames.length > 0 ? colNames : Object.keys(report.columnStats || {}));

  // 2. Privacy
  const privacyPolicy: PrivacyPolicyV2 = buildPrivacyPolicy(options.privacyLevel);
  const piiConfig = buildPIIConfig(report.datasetProfile?.columns || []);

  // 3. Budget
  const tokenBudget: TokenBudgetV2 = buildTokenBudget(options.tokenBudget);
  const truncManifest: TruncationManifestV2 = createTruncationManifest();

  // 4. Column selection by columnId
  const excludeColIds = new Set(options.excludeColumns || []);
  const includedColumns = allColumns.filter(c => !excludeColIds.has(c.columnId));
  for (const c of allColumns.filter(c => excludeColIds.has(c.columnId))) {
    logColumnExclusion(truncManifest, c.name, tokenBudget, allColumns.length, 'explicit_exclusion');
  }

  // Flag ambiguous/duplicate columns
  for (const c of includedColumns) {
    if (c.isAmbiguous || c.isDuplicate || c.isReservedWord) {
      logColumnExclusion(truncManifest, c.name, tokenBudget, allColumns.length, 'ambiguous_column');
    }
  }

  const finalCols = applySlice(includedColumns, tokenBudget.maxColumns, (actual) =>
    logColumnExclusion(truncManifest, 'budget', tokenBudget, actual, 'budget_limit'));

  // 5. Issues — scope-aware, actionability via deduction
  const finalColIds = new Set(finalCols.map(c => c.columnId));
  const excludeIssues = new Set(options.excludeIssues || []);
  const candidateIssues: EvidenceIssueV2[] = [];
  const excludedIssueEntries: ManifestExclusionV2[] = [];

  for (const issue of report.issues) {
    if (excludeIssues.has(issue.id)) {
      excludedIssueEntries.push({ reason: 'explicit_exclusion', resource: 'issue', name: issue.ruleName, detail: `Excluded` });
      continue;
    }

    const hasColumn = !!issue.column;
    const datasetScope: IssueScope = hasColumn ? 'column' : 'dataset';

    // Resolve column via columnId+position, NOT rawName
    let columnId: string | null = null;
    if (hasColumn && issue.column) {
      const matches = allColumns.filter(c => c.name === issue.column);
      if (matches.length === 0) {
        excludedIssueEntries.push({ reason: 'missing_reference', resource: 'issue', name: issue.ruleName, detail: `Column '${issue.column}' not found` });
        continue;
      }
      if (matches.length > 1) {
        excludedIssueEntries.push({ reason: 'ambiguous_column', resource: 'issue', name: issue.ruleName, detail: `Duplicate column '${issue.column}' — requires HITL` });
        continue;
      }
      const colRef = matches[0];
      if (!finalColIds.has(colRef.columnId)) {
        excludedIssueEntries.push({ reason: 'missing_reference', resource: 'issue', name: issue.ruleName, detail: `Column '${issue.column}' not in final columns` });
        continue;
      }
      columnId = colRef.columnId;
    }

    // Copy ruleId directly from issue (engine-provided, never fabricated)
    const ruleId = issue.ruleId;

    // Determine actionability: use RULE_POLICY lookup, upgrade to auto_safe only if authorized
    const policy = RULE_POLICY[ruleId];
    const defaultActionability: Actionability = policy?.defaultActionability ?? DEFAULT_ACTIONABILITY;
    const effectiveScope: IssueScope = policy?.scope ?? datasetScope;

    let actionability: Actionability = defaultActionability;
    if (defaultActionability === 'auto_safe') {
      // Only honor auto_safe when engine explicitly authorized it
      if (!issue.automaticAuthorization?.authorized) {
        actionability = 'review_only';
      }
    }

    // Copy automaticAuthorization from engine (never fabricate)
    const automaticAuthorization: AutomaticAuthorization = issue.automaticAuthorization ?? {
      actionType: 'none',
      authorized: false,
      conditionsMet: [],
      reason: 'No automaticAuthorization provided by engine',
    };

    candidateIssues.push({
      issueId: issue.id,
      ruleId,
      ruleName: issue.ruleName,
      columnId,
      scope: effectiveScope,
      category: issue.category,
      severity: issue.severity,
      count: issue.count,
      affectedPercentage: issue.affectedPercentage,
      evidenceRefs: [],
      actionability,
      automaticAuthorization,
    });
  }

  const includedIssues = applySlice(candidateIssues, tokenBudget.maxIssues, (actual) =>
    logIssueExclusion(truncManifest, 'budget', 'issues', tokenBudget, actual, 'budget_limit'));

  // 6. Evidence samples — privacy-aware
  const samples: EvidenceSampleV2[] = [];
  let refCounter = 0;

  for (const issue of includedIssues) {
    const rawIssue = report.issues.find(i => i.id === issue.issueId);
    if (!rawIssue) continue;

    const rawSamples = rawIssue.sampleValues || [];
    const colMeta = (report.datasetProfile?.columns || []).find(c => c.name === rawIssue.column);
    const colStats = report.columnStats?.[rawIssue.column || ''];
    const semanticType = colMeta?.semanticType || colStats?.semanticType;
    const shouldHash = shouldHashColumn(rawIssue.column || '', semanticType, rawIssue.category, piiConfig);

    const issueSamples = applySlice(rawSamples, tokenBudget.maxSamplesPerIssue, (actual) =>
      logSampleTruncation(truncManifest, issue.issueId, tokenBudget, actual));

    const refs: string[] = [];

    for (const val of issueSamples) {
      if (privacyPolicy.level === 'cloud_no_samples') continue;

      const ref = `ev-${String(refCounter).padStart(4, '0')}`;
      refCounter++;

      let processedVal: string | number | null;
      const valStr = String(val ?? '');

      if (shouldHash) {
        processedVal = hashValue(valStr);
      } else if (isPII(valStr, piiConfig)) {
        processedVal = redactValue(valStr);
      } else {
        processedVal = val;
      }

      refs.push(ref);
      samples.push({
        evidenceRef: ref,
        issueId: issue.issueId,
        columnId: issue.columnId,
        values: [processedVal],
        metadata: { hashed: shouldHash, pii: isPII(valStr, piiConfig) },
      });
    }
    issue.evidenceRefs = refs;
  }

  // 7. Column stats
  const columnStats: Record<string, ColumnStatsV2> = {};
  for (const col of finalCols) {
    const rawStats = report.columnStats?.[col.name];
    if (!rawStats) continue;
    const colMeta = (report.datasetProfile?.columns || []).find(c => c.name === col.name);
    const shouldHash = shouldHashColumn(col.name, colMeta?.semanticType, undefined, piiConfig);

    let topValues = (rawStats.topValues || []).map(tv => ({
      value: shouldHash ? hashValue(String(tv.value)) : isPII(String(tv.value), piiConfig) ? redactValue(String(tv.value)) : String(tv.value),
      count: tv.count,
      percentage: tv.percentage,
    }));

    if (!allowsTopValues(privacyPolicy)) topValues = [];
    topValues = applySlice(topValues, tokenBudget.maxTopValues, (actual) =>
      logTopValueTruncation(truncManifest, col.columnId, tokenBudget, actual));

    columnStats[col.columnId] = {
      columnId: col.columnId,
      inferredType: rawStats.inferredType || 'unknown',
      semanticType: rawStats.semanticType || 'unknown',
      distinctCount: rawStats.distinctCount || 0,
      nullCount: rawStats.nullCount || 0,
      nullPercentage: rawStats.nullPercentage || 0,
      topValues,
      stats: rawStats.stats || {},
    };
  }

  // 8. Evidence
  const evidence: EvidenceV2 = { samples, columnStats };

  // 9. Selection manifest
  const selectionManifest: SelectionManifestV2 = {
    rationale: `Privacy: ${privacyPolicy.level}. Budget: ${tokenBudget.budgetId}`,
    includedColumns: finalCols.length,
    excludedColumns: allColumns.filter(c => excludeColIds.has(c.columnId)).length,
    includedIssues: includedIssues.length,
    excludedIssues: excludedIssueEntries.length,
    excludedByBudget: [
      ...excludedIssueEntries,
      ...allColumns.filter(c => excludeColIds.has(c.columnId)).map(c =>
        ({ reason: 'explicit_exclusion' as ExclusionReason, resource: 'column' as const, name: c.name, detail: `Excluded` })),
    ],
  };

  // 10. Assemble
  let envelope: EvidenceEnvelopeV2 = {
    contractId: 'aura.evidence.v2',
    contractVersion: '2.0.0',
    untrustedContent: true,
    datasetFingerprint: {
      sha256: options.datasetSha256,
      rowCount: report.rowCount,
      colCount: report.colCount,
      delimiter: report.delimiterDetected,
      generatedAt: new Date().toISOString(),
    },
    privacyPolicy,
    datasetSummary: {
      rowCount: report.rowCount,
      colCount: report.colCount,
      delimiter: report.delimiterDetected,
      duplicateRows: report.duplicateRows,
      score: report.score,
    } satisfies DatasetSummaryV2,
    columns: finalCols,
    issues: includedIssues,
    evidence,
    selectionManifest,
    truncationManifest: truncManifest,
  };

  // 11. Character budget — STRICT
  const charCount = JSON.stringify(envelope).length;
  if (charCount > tokenBudget.maxCharacters) {
    // Try reduction
    envelope = enforceCharacterBudget(envelope, truncManifest, tokenBudget);
    const afterCount = JSON.stringify(envelope).length;
    if (afterCount > tokenBudget.maxCharacters) {
      logCharacterTruncation(truncManifest, 'envelope', 'full', tokenBudget, afterCount, 'budget_limit');
      throw buildError('BUDGET_UNSATISFIABLE',
        `Cannot reduce envelope to ${tokenBudget.maxCharacters} chars (actual: ${afterCount})`,
        { budget: tokenBudget.maxCharacters, actual: afterCount });
    }
  }

  // 12. Validate
  const validation = validateEnvelope(envelope);
  const privValidation = validatePrivacyPolicy(privacyPolicy);
  const budgetValidation = validateTokenBudget(tokenBudget);

  if (!validation.valid) {
    throw buildError('ENVELOPE_INVALID', validation.errors.map(e => `${e.path}: ${e.message}`).join('; '), { errors: validation.errors });
  }
  if (!privValidation.valid) {
    throw buildError('PRIVACY_INVALID', privValidation.errors.map(e => `${e.path}: ${e.message}`).join('; '), {});
  }
  if (!budgetValidation.valid) {
    throw buildError('BUDGET_INVALID', budgetValidation.errors.map(e => `${e.path}: ${e.message}`).join('; '), {});
  }

  return envelope;
}

// ── Public wrapper (gated by CONTRACTS_V2_ENABLED) ──

export function buildEvidenceEnvelopeV2(
  report: AuditReportInput,
  options: EvidenceEnvelopeOptionsV2,
): EvidenceEnvelopeV2 {
  let enabled = false;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      enabled = import.meta.env.VITE_CONTRACTS_V2_ENABLED === 'true';
    }
  } catch { /* not Vite */ }
  try {
    if (process.env.CONTRACTS_V2_ENABLED === 'true') enabled = true;
  } catch { /* not Node */ }

  if (!enabled) {
    throw buildError('CONTRACTS_V2_DISABLED', 'Set CONTRACTS_V2_ENABLED=true');
  }

  return _buildEvidenceEnvelopeV2(report, options);
}

function buildError(code: string, message: string, details?: Record<string, unknown>): ContractsV2Error {
  const err = new Error(message) as ContractsV2Error;
  err.code = code;
  err.details = details || {};
  err.name = 'ContractsV2Error';
  return err;
}

export class ContractsV2Error extends Error {
  code!: string;
  details!: Record<string, unknown>;
}
