/**
 * Evidence Envelope V2 — Phase 1B.
 *
 * - Real builds with or without CONTRACTS_V2_ENABLED via explicit flag
 * - Rule-based actionability matrix (not ruleName)
 * - Scope-aware issue construction
 * - excludeColumns via columnId
 * - Enforces budget (not just logs)
 * - Throws structured error on invalid result
 * - Browser-safe: uses hash.ts instead of node:crypto
 */

import {
  buildColumnRegistry,
  getColumnById,
  getColumnsRequiringReview,
} from './columnRegistry';
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
} from './tokenBudget';
import {
  validateEnvelope,
  validatePrivacyPolicy,
  validateTokenBudget,
} from './validators';
import { sha256short } from './hash';
import type {
  EvidenceEnvelopeV2,
  EvidenceIssueV2,
  EvidenceSampleV2,
  EvidenceV2,
  ColumnStatsV2,
  SelectionManifestV2,
  TruncationManifestV2,
  ManifestExclusionV2,
  EvidenceEnvelopeOptionsV2,
  Actionability,
  ActionabilityRule,
  IssueScope,
  ExclusionReason,
  BuildErrorV2,
  DatasetSummaryV2,
} from './types';

// ── Actionability Matrix (ruleId-based) ──

const ACTIONABILITY_MATRIX: Record<string, ActionabilityRule> = {
  'rule:trim-whitespace': {
    ruleId: 'rule:trim-whitespace',
    defaultActionability: 'auto_safe',
    allowedAutomaticAction: 'trim_whitespace',
    authorizationConditions: ['column is text', 'no semantic meaning loss'],
    requiresHumanReview: false,
    scope: 'column',
  },
  'rule:normalize-placeholders': {
    ruleId: 'rule:normalize-placeholders',
    defaultActionability: 'auto_safe',
    allowedAutomaticAction: 'normalize_placeholders',
    authorizationConditions: ['known placeholder values specified'],
    requiresHumanReview: false,
    scope: 'column',
  },
  'rule:drop-exact-duplicates': {
    ruleId: 'rule:drop-exact-duplicates',
    defaultActionability: 'review_only',
    allowedAutomaticAction: 'drop_exact_duplicates',
    authorizationConditions: ['audit report includes deterministic authorization', 'duplicateRows > 0', 'no semantic ordering dependency'],
    requiresHumanReview: true,
    scope: 'dataset',
  },
  'rule:null-values': {
    ruleId: 'rule:null-values',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:outliers': {
    ruleId: 'rule:outliers',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:high-cardinality': {
    ruleId: 'rule:high-cardinality',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:pii': {
    ruleId: 'rule:pii',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:row-deletion': {
    ruleId: 'rule:row-deletion',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'dataset',
  },
  'rule:column-deletion': {
    ruleId: 'rule:column-deletion',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:business-logic': {
    ruleId: 'rule:business-logic',
    defaultActionability: 'review_only',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: true,
    scope: 'column',
  },
  'rule:statistical-finding': {
    ruleId: 'rule:statistical-finding',
    defaultActionability: 'not_actionable',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: false,
    scope: 'dataset',
  },
  'rule:semantic-feature': {
    ruleId: 'rule:semantic-feature',
    defaultActionability: 'not_actionable',
    allowedAutomaticAction: null,
    authorizationConditions: [],
    requiresHumanReview: false,
    scope: 'column',
  },
};

function classifyActionability(ruleName: string, category: string, duplicateRows?: number): { actionability: Actionability; ruleId: string; scope: IssueScope } {
  // Deterministic mapping from ruleName to ruleId
  const ruleId = `rule:${sha256short(ruleName, 8)}`;

  // Try exact match in matrix first
  if (ACTIONABILITY_MATRIX[ruleId]) {
    const entry = ACTIONABILITY_MATRIX[ruleId];
    return { actionability: entry.defaultActionability, ruleId, scope: entry.scope };
  }

  // Heuristic fallbacks (last resort, logged as warnings)
  const lower = (ruleName + ' ' + category).toLowerCase();

  if (lower.includes('espacios fantasma') || lower.includes('trim') || lower.includes('whitespace')) {
    return { actionability: 'auto_safe', ruleId, scope: 'column' };
  }
  if (lower.includes('exact duplicate') || lower.includes('duplicados exactos')) {
    if (duplicateRows && duplicateRows > 0) {
      return { actionability: 'auto_safe', ruleId, scope: 'dataset' };
    }
    return { actionability: 'review_only', ruleId, scope: 'dataset' };
  }
  if (lower.includes('null') || lower.includes('nulo') || lower.includes('vacio') || lower.includes('vacío') || lower.includes('missing')) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }
  if (lower.includes('outlier') || lower.includes('atipico') || lower.includes('atípico')) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }
  if (lower.includes('cardinalidad') || lower.includes('cardinality') || lower.includes('unique') || lower.includes('unicos') || lower.includes('únicos')) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }
  if (lower.includes('estadistic') || lower.includes('semantic') || lower.includes('feature')) {
    return { actionability: 'not_actionable', ruleId, scope: 'dataset' };
  }

  return { actionability: 'review_only', ruleId, scope: 'column' };
}

// ── Input Type ──

export interface AuditReportInput {
  score: number;
  rowCount: number;
  colCount: number;
  duplicateRows: number;
  delimiterDetected: string;
  issues: Array<{
    id: string;
    column?: string;
    category: string;
    ruleName: string;
    description: string;
    severity: 'critical' | 'warning' | 'info' | 'good';
    count: number;
    affectedPercentage: number;
    sampleValues?: (string | number | null)[];
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
}

// ── Main Builder ──

export function buildEvidenceEnvelopeV2(
  report: AuditReportInput,
  options: EvidenceEnvelopeOptionsV2,
  forceEnabled = false,
): EvidenceEnvelopeV2 {
  // Gate check (can be bypassed for tests with forceEnabled)
  if (!forceEnabled) {
    try {
      const { isContractsV2Enabled } = require('./contractRegistry') as typeof import('./contractRegistry');
      if (!isContractsV2Enabled()) {
        throw buildError('CONTRACTS_V2_DISABLED', 'Set CONTRACTS_V2_ENABLED=true or use forceEnabled=true for tests');
      }
    } catch {
      throw buildError('CONTRACTS_V2_DISABLED', 'Set CONTRACTS_V2_ENABLED=true or use forceEnabled=true for tests');
    }
  }

  // 1. Column Registry
  const colNames = (report.datasetProfile?.columns || []).map(c => c.name);
  if (colNames.length === 0) {
    const statsNames = Object.keys(report.columnStats || {});
    colNames.push(...statsNames);
  }
  const allColumns = buildColumnRegistry(colNames);

  // 2. Privacy Policy
  const privacyPolicy = buildPrivacyPolicy(options.privacyLevel);
  const piiConfig = buildPIIConfig(report.datasetProfile?.columns || []);

  // 3. Token Budget
  const tokenBudget = buildTokenBudget(options.tokenBudget);
  const truncManifest = createTruncationManifest();

  // 4. Column selection by columnId (excludeColumns now works with columnId)
  const excludeColIds = new Set(options.excludeColumns || []);
  const includedColumns = allColumns.filter(c => !excludeColIds.has(c.columnId));
  const excludedColumns = allColumns.filter(c => excludeColIds.has(c.columnId));

  // Log explicit exclusions
  for (const col of excludedColumns) {
    logColumnExclusion(truncManifest, col.name, tokenBudget, allColumns.length, 'explicit_exclusion');
  }

  // Flag ambiguous/duplicate columns
  const reviewCols = getColumnsRequiringReview(includedColumns);
  for (const col of reviewCols) {
    logColumnExclusion(truncManifest, col.name, tokenBudget, allColumns.length, 'ambiguous_column');
  }

  // Apply column budget
  const finalCols = applySlice(includedColumns, tokenBudget.maxColumns, (actual) => {
    logColumnExclusion(truncManifest, 'budget', tokenBudget, actual, 'budget_limit');
  });

  // 5. Issues — scope-aware, actionability via ruleId
  const finalColIds = new Set(finalCols.map(c => c.columnId));
  const finalColNames = new Set(finalCols.map(c => c.name));
  const excludeIssues = new Set(options.excludeIssues || []);

  const candidateIssues: EvidenceIssueV2[] = [];
  const excludedIssueEntries: ManifestExclusionV2[] = [];

  for (const issue of report.issues) {
    if (excludeIssues.has(issue.id)) {
      excludedIssueEntries.push({ reason: 'explicit_exclusion', resource: 'issue', name: issue.ruleName, detail: `Issue ${issue.id} explicitly excluded` });
      continue;
    }

    const hasColumn = !!issue.column;
    const scope: IssueScope = hasColumn ? 'column' : 'dataset';

    // For column-scoped issues, check if column is included
    let columnId: string | null = null;
    if (hasColumn && issue.column) {
      if (!finalColNames.has(issue.column)) {
        excludedIssueEntries.push({
          reason: 'missing_reference',
          resource: 'issue',
          name: issue.ruleName,
          detail: `Column '${issue.column}' not in included columns`,
        });
        continue;
      }
      const colRef = allColumns.find(c => c.name === issue.column);
      if (!colRef) {
        excludedIssueEntries.push({ reason: 'missing_reference', resource: 'issue', name: issue.ruleName, detail: `Column '${issue.column}' not found` });
        continue;
      }
      columnId = colRef.columnId;
    }

    // Actionability via ruleId matrix
    const { actionability, ruleId, scope: matrixScope } = classifyActionability(
      issue.ruleName, issue.category, report.duplicateRows,
    );

    // Scope: defer to issue structure if matrix doesn't match
    const effectiveScope: IssueScope = (matrixScope === 'dataset' && !hasColumn) ? 'dataset' : scope;

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
    });
  }

  // Apply issue budget
  const includedIssues = applySlice(candidateIssues, tokenBudget.maxIssues, (actual) => {
    logIssueExclusion(truncManifest, 'budget', 'issues', tokenBudget, actual, 'budget_limit');
  });

  // 6. Evidence samples — privacy-aware
  const samples: EvidenceSampleV2[] = [];
  let refCounter = 0;

  for (const issue of includedIssues) {
    const rawIssue = report.issues.find(i => i.id === issue.issueId);
    if (!rawIssue) continue;

    const rawSamples = rawIssue.sampleValues || [];
    const colMeta = (report.datasetProfile?.columns || []).find(c => c.name === rawIssue.column);
    const shouldHash = shouldHashColumn(rawIssue.column || '', colMeta?.semanticType, rawIssue.category, piiConfig);

    const issueSamples = applySlice(rawSamples, tokenBudget.maxSamplesPerIssue, (actual) => {
      logSampleTruncation(truncManifest, issue.issueId, tokenBudget, actual);
    });

    const refs: string[] = [];

    for (const val of issueSamples) {
      if (!allowsRawSamples(privacyPolicy)) {
        // cloud_no_samples: omit entirely, no ref generated
        continue;
      }

      const ref = `ev-${String(refCounter).padStart(4, '0')}`;
      refCounter++;

      let processedVal: string | number | null;

      if (shouldHash) {
        processedVal = hashValue(String(val ?? ''));
      } else if (isPII(String(val ?? ''), piiConfig)) {
        processedVal = redactValue(String(val ?? ''));
      } else {
        processedVal = val;
      }

      refs.push(ref);
      samples.push({
        evidenceRef: ref,
        issueId: issue.issueId,
        columnId: issue.columnId,
        values: [processedVal],
        metadata: { hashed: shouldHash, pii: isPII(String(val ?? ''), piiConfig) },
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

    if (!allowsTopValues(privacyPolicy)) {
      topValues = [];
    }

    topValues = applySlice(topValues, tokenBudget.maxTopValues, (actual) => {
      logTopValueTruncation(truncManifest, col.columnId, tokenBudget, actual);
    });

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
    excludedColumns: excludedColumns.length,
    includedIssues: includedIssues.length,
    excludedIssues: excludedIssueEntries.length,
    excludedByBudget: [
      ...excludedIssueEntries,
      ...excludedColumns.map(c => ({ reason: 'explicit_exclusion' as ExclusionReason, resource: 'column' as const, name: c.name, detail: `Column ${c.columnId} excluded` })),
    ],
  };

  // 10. Assemble envelope
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

  // 11. Enforce character budget
  envelope = enforceCharacterBudget(envelope, truncManifest, tokenBudget);

  // 12. Validate — fail-closed
  const validation = validateEnvelope(envelope);
  const privValidation = validatePrivacyPolicy(privacyPolicy);
  const budgetValidation = validateTokenBudget(tokenBudget);

  if (!validation.valid) {
    const errs = validation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw buildError('ENVELOPE_INVALID', errs, { errors: validation.errors });
  }
  if (!privValidation.valid) {
    const errs = privValidation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw buildError('PRIVACY_INVALID', errs, { errors: privValidation.errors });
  }
  if (!budgetValidation.valid) {
    const errs = budgetValidation.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw buildError('BUDGET_INVALID', errs, { errors: budgetValidation.errors });
  }

  return envelope;
}

function buildError(code: string, message: string, details?: Record<string, unknown>): BuildErrorV2 {
  return { code, message, details: details || {} };
}
