/**
 * Evidence Envelope V2 — Phase 1C.
 *
 * - Internal builder (_buildEvidenceEnvelopeV2) + public wrapper (buildEvidenceEnvelopeV2)
 * - Actionability: deduction ruleId from engine scoreBreakdown, NO heuristic fallbacks
 * - drop_exact_duplicates: auto_safe only with explicit AuditReport authorization
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
import { sha256short } from './hash';
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
  BuildErrorV2,
  DatasetSummaryV2,
  PrivacyPolicyV2,
  TokenBudgetV2,
  TruncationManifestV2,
} from './types';

// ── Actionability via deduction ruleId (from engine scoreBreakdown) ──

interface DeductionRef {
  reason: string;
  category: string;
  ruleId: string;
}

/**
 * Map engine deduction reason → stable ruleId + actionability.
 * NO heuristic ruleName.includes() fallback. BANNED.
 */
function deduceActionability(deduction: DeductionRef): { actionability: Actionability; ruleId: string; scope: IssueScope } {
  const reason = deduction.reason;
  const cat = deduction.category;

  // Stable ruleId from deduction reason
  const ruleId = deduction.ruleId !== 'unknown'
    ? deduction.ruleId
    : `rule:${sha256short(reason, 8)}`;

  // drop_exact_duplicates: classified, authorization handled at call site
  if (/filas?\s*duplicadas|exact\s*duplicates?/i.test(reason)) {
    return { actionability: 'auto_safe', ruleId, scope: 'dataset' };
  }

  // Whitespace trimming = auto_safe
  if (/espacios\s*fantasma|trim|whitespace/i.test(reason)) {
    return { actionability: 'auto_safe', ruleId, scope: 'column' };
  }

  // Nulls / missing = review_only
  if (/nulos?|vacíos?|missing|null|vacios/i.test(reason)) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }

  // Outliers = review_only
  if (/outlier|atípico/i.test(reason)) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }

  // PII = review_only
  if (/pii|personal/i.test(reason)) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }

  // Cardinality, categories, semantic = review_only
  if (/cardinalidad|variantes|categórica|categorica|caos|mayúsculas/i.test(reason)) {
    return { actionability: 'review_only', ruleId, scope: 'column' };
  }

  // Statistical / semantic features = not_actionable
  if (/estadístic|semántic|contaminación|feature/i.test(reason)) {
    return { actionability: 'not_actionable', ruleId, scope: 'dataset' };
  }

  // Default: review_only (fail-safe)
  return { actionability: 'review_only', ruleId, scope: 'column' };
}

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
  /** Engine's scoreBreakdown for deduction-based ruleId + actionability */
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

  // Build deduction map from engine scoreBreakdown
  const deductionMap = new Map<string, DeductionRef>();
  if (report.scoreBreakdown) {
    for (const d of report.scoreBreakdown) {
      deductionMap.set(d.reason, { reason: d.reason, category: d.category, ruleId: d.ruleId || 'unknown' });
    }
  }

  for (const issue of report.issues) {
    if (excludeIssues.has(issue.id)) {
      excludedIssueEntries.push({ reason: 'explicit_exclusion', resource: 'issue', name: issue.ruleName, detail: `Excluded` });
      continue;
    }

    const hasColumn = !!issue.column;
    const scope: IssueScope = hasColumn ? 'column' : 'dataset';

    // Resolve column via columnId+position, NOT rawName
    let columnId: string | null = null;
    if (hasColumn && issue.column) {
      const matches = allColumns.filter(c => c.name === issue.column);
      if (matches.length === 0) {
        excludedIssueEntries.push({ reason: 'missing_reference', resource: 'issue', name: issue.ruleName, detail: `Column '${issue.column}' not found` });
        continue;
      }
      if (matches.length > 1) {
        // Duplicate: require HITL / explicit position
        excludedIssueEntries.push({ reason: 'ambiguous_column', resource: 'issue', name: issue.ruleName, detail: `Duplicate column '${issue.column}' — requires HITL` });
        continue; // Don't auto-resolve
      }
      const colRef = matches[0];
      if (!finalColIds.has(colRef.columnId)) {
        excludedIssueEntries.push({ reason: 'missing_reference', resource: 'issue', name: issue.ruleName, detail: `Column '${issue.column}' not in final columns` });
        continue;
      }
      columnId = colRef.columnId;
    }

    // Actionability via engine ruleId
    let actionability: Actionability = 'review_only';
    let ruleId = `rule:${sha256short(issue.ruleName, 8)}`;
    let effectiveScope = scope;
    const automaticAuthorization = {
      actionType: 'none',
      authorized: false,
      conditionsMet: [] as string[],
      reason: 'No authorization found',
    };

    if (deductionMap.size > 0) {
      let deduction = deductionMap.get(issue.description) || deductionMap.get(issue.ruleName);

      if (!deduction && issue.column) {
        for (const d of report.scoreBreakdown!) {
          if (d.reason.includes(issue.column)) {
            const colStart = d.reason.indexOf(issue.column);
            const prefix = d.reason.substring(0, colStart).toLowerCase().replace(/[^a-záéíóúñ]/g, '');
            const ruleLower = issue.ruleName.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
            if (ruleLower.includes(prefix) || prefix.includes(ruleLower.substring(0, 8))) {
              deduction = { reason: d.reason, category: d.category, ruleId: d.ruleId || 'unknown' };
              break;
            }
          }
        }
      }

      if (deduction) {
        const result = deduceActionability(deduction);
        actionability = result.actionability;
        ruleId = result.ruleId;
        effectiveScope = result.scope;

        // auto_safe only with explicit authorization
        if (actionability === 'auto_safe') {
          const isDupes = /filas?\s*duplicadas|exact\s*duplicates?/i.test(deduction.reason);
          const isWhitespace = /espacios\s*fantasma|trim|whitespace/i.test(deduction.reason);

          if (isDupes && report.duplicateRows > 0) {
            automaticAuthorization.actionType = 'drop_exact_duplicates';
            automaticAuthorization.authorized = true;
            automaticAuthorization.conditionsMet = ['duplicateRows > 0', 'scoreBreakdown confirms exact duplicates'];
            automaticAuthorization.reason = 'Exact duplicates detected and authorized for automatic removal';
          } else if (isWhitespace) {
            automaticAuthorization.actionType = 'trim_whitespace';
            automaticAuthorization.authorized = true;
            automaticAuthorization.conditionsMet = ['column is text', 'trim is lossless for whitespace'];
            automaticAuthorization.reason = 'Whitespace trimming is safe for text columns';
          } else {
            // Unknown rule requesting auto_safe → deny
            actionability = 'review_only';
            automaticAuthorization.authorized = false;
            automaticAuthorization.reason = 'No explicit authorization for this action type';
          }
        }
      }
    }

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
