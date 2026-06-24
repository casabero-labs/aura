/**
 * Evidence Envelope V2 — Fase 1.
 *
 * buildEvidenceEnvelopeV2(report, options) produces a fully typed,
 * versioned EvidenceEnvelopeV2 payload from an AuditReport.
 *
 * Ties together: column registry, privacy policy, token budget,
 * selection manifest, and truncation manifest.
 */

import type {
  EvidenceEnvelopeV2,
  EvidenceIssueV2,
  EvidenceSampleV2,
  EvidenceV2,
  ColumnStatsV2,
  SelectionManifestV2,
  TruncationManifestV2,
  EvidenceEnvelopeOptionsV2,
  Actionability,
  DatasetSummaryV2,
  PrivacyPolicyV2,
  TokenBudgetV2,
} from './types';
import { buildColumnRegistry, getColumnById } from './columnRegistry';
import { buildPrivacyPolicy, requiresHash, allowsRawSamples, allowsTopValues } from './privacyPolicy';
import { buildTokenBudget, createTruncationManifest, applyColumnLimit, applyIssueLimit, applySampleLimit, applyTopValuesLimit, applyCharacterLimit, estimateCharCount } from './tokenBudget';
import { validateEnvelope, validatePrivacyPolicy, validateTokenBudget } from './validators';
import { isContractsV2Enabled } from './contractRegistry';
import { createHash } from 'node:crypto';

// ── Actionability classification ──

const AUTO_SAFE_RULES = new Set<string>([
  'trim_whitespace',
  'normalize_placeholders',
  'drop_exact_duplicates',
]);

const AUTO_SAFE_CATEGORIES: Record<string, string[]> = {
  'Espacios Fantasma (Trim)': ['trim_whitespace'],
  'Exact Duplicates': ['drop_exact_duplicates'],
  'Placeholder Standardization': ['normalize_placeholders'],
};

const NOT_ACTIONABLE_PATTERNS = [
  /^feature\s+/i,
  /estad[ií]stic/i,
  /sem[aá]ntic/i,
  /sin\s+acci[oó]n/i,
  /no\s+requiere\s+limpieza/i,
];

function classifyActionability(ruleName: string, category: string): Actionability {
  // Check auto_safe rules
  const autoSafe = AUTO_SAFE_CATEGORIES[ruleName];
  if (autoSafe && autoSafe.length > 0) return 'auto_safe';

  // Check not_actionable patterns
  if (NOT_ACTIONABLE_PATTERNS.some(p => p.test(ruleName) || p.test(category))) {
    return 'not_actionable';
  }

  // Default: review_only
  return 'review_only';
}

// ── Main builder ──

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
      cardinality?: number;
    }>;
  };
}

/**
 * Build the EvidenceEnvelopeV2 from an audit report.
 */
export function buildEvidenceEnvelopeV2(
  report: AuditReportInput,
  options: EvidenceEnvelopeOptionsV2,
): EvidenceEnvelopeV2 {
  if (!isContractsV2Enabled()) {
    throw new Error('Contracts v2 is not enabled. Set CONTRACTS_V2_ENABLED=true');
  }

  // 1. Column Registry
  const colNames = (report.datasetProfile?.columns || [])
    .map(c => c.name);
  if (colNames.length === 0) {
    // Fallback: extract from columnStats keys
    const statsNames = Object.keys(report.columnStats || {});
    colNames.push(...statsNames);
  }
  const columns = buildColumnRegistry(colNames);

  // 2. Privacy Policy
  const privacyPolicy: PrivacyPolicyV2 = buildPrivacyPolicy(options.privacyLevel);

  // 3. Token Budget
  const tokenBudget: TokenBudgetV2 = buildTokenBudget(options.tokenBudget);
  const truncManifest: TruncationManifestV2 = createTruncationManifest();

  // 4. Selection — filter by exclude lists and budget
  const excludeCols = new Set(options.excludeColumns || []);
  const excludeIssues = new Set(options.excludeIssues || []);
  const includedColumns = columns.filter(c => !excludeCols.has(c.name));
  const excludedColumns = columns.filter(c => excludeCols.has(c.name));

  // Apply column budget
  if (includedColumns.length > tokenBudget.maxColumns) {
    const over = includedColumns.splice(tokenBudget.maxColumns);
    excludedColumns.push(...over);
  }
  applyColumnLimit(
    truncManifest, tokenBudget, columns.length,
    includedColumns.map(c => c.name),
    excludedColumns.map(c => c.name),
  );

  // 5. Issues — filter, classify actionability, apply budget
  const includedColNames = new Set(includedColumns.map(c => c.name));
  const rawIssues: EvidenceIssueV2[] = [];
  const excludedIssueEntries: { id: string; name: string }[] = [];

  for (const issue of report.issues) {
    if (excludeIssues.has(issue.id)) {
      excludedIssueEntries.push({ id: issue.id, name: issue.ruleName });
      continue;
    }
    const colName = issue.column || '';
    if (colName && !includedColNames.has(colName)) {
      excludedIssueEntries.push({ id: issue.id, name: issue.ruleName });
      continue;
    }

    const colRef = colName ? columns.find(c => c.name === colName) : columns[0];
    const columnId = colRef?.columnId || 'col:unknown';
    const ruleId = `rule:${createHash('sha256').update(issue.ruleName).digest('hex').slice(0, 8)}`;

    rawIssues.push({
      issueId: issue.id,
      ruleId,
      ruleName: issue.ruleName,
      columnId,
      category: issue.category,
      severity: issue.severity,
      count: issue.count,
      affectedPercentage: issue.affectedPercentage,
      evidenceRefs: [],
      actionability: classifyActionability(issue.ruleName, issue.category),
    });
  }

  // Apply issue budget
  let includedIssues = rawIssues;
  if (includedIssues.length > tokenBudget.maxIssues) {
    const over = includedIssues.splice(tokenBudget.maxIssues);
    for (const i of over) {
      excludedIssueEntries.push({ id: i.issueId, name: i.ruleName });
    }
  }
  applyIssueLimit(truncManifest, tokenBudget, rawIssues.length + excludedIssueEntries.length, excludedIssueEntries);

  // 6. Evidence samples
  const samples: EvidenceSampleV2[] = [];
  let sampleRefCounter = 0;

  for (const issue of includedIssues) {
    const rawIssue = report.issues.find(i => i.id === issue.issueId);
    if (!rawIssue) continue;

    const hashed = requiresHash(privacyPolicy, rawIssue.column || '');

    let issueSamples: (string | number | null)[] = [];

    if (allowsRawSamples(privacyPolicy) && rawIssue.sampleValues) {
      const rawSamples = rawIssue.sampleValues.slice(0, tokenBudget.maxSamplesPerIssue);
      for (const val of rawSamples) {
        if (hashed) {
          issueSamples.push(createHash('sha256').update(String(val ?? '')).digest('hex'));
        } else {
          issueSamples.push(val);
        }
      }
    } else if (!allowsRawSamples(privacyPolicy)) {
      // cloud_no_samples: omit entirely
      issueSamples = [];
    } else if (allowsRawSamples(privacyPolicy) && !rawIssue.sampleValues) {
      issueSamples = [];
    }

    // Generate evidence refs
    const refs: string[] = [];
    for (const val of issueSamples) {
      const ref = `ev-${String(sampleRefCounter).padStart(4, '0')}`;
      sampleRefCounter++;
      refs.push(ref);
      samples.push({
        evidenceRef: ref,
        issueId: issue.issueId,
        columnId: issue.columnId,
        values: [val],
        metadata: { hashed },
      });
    }
    issue.evidenceRefs = refs;

    // Log sample truncation
    if (rawIssue.sampleValues && rawIssue.sampleValues.length > tokenBudget.maxSamplesPerIssue) {
      applySampleLimit(truncManifest, tokenBudget, issue.issueId, rawIssue.sampleValues.length);
    }
  }

  // 7. Column stats
  const columnStats: Record<string, ColumnStatsV2> = {};
  for (const col of includedColumns) {
    const rawStats = report.columnStats?.[col.name];
    const colRef = getColumnById(columns, col.columnId);
    if (!colRef) continue;

    let topValues = (rawStats?.topValues || []).map(tv => ({
      value: requiresHash(privacyPolicy, col.name)
        ? createHash('sha256').update(String(tv.value)).digest('hex')
        : String(tv.value),
      count: tv.count,
      percentage: tv.percentage,
    }));

    if (!allowsTopValues(privacyPolicy)) {
      topValues = [];
    }

    // Apply top values budget
    if (topValues.length > tokenBudget.maxTopValues) {
      applyTopValuesLimit(truncManifest, tokenBudget, col.columnId, topValues.length);
      topValues = topValues.slice(0, tokenBudget.maxTopValues);
    }

    columnStats[col.columnId] = {
      columnId: col.columnId,
      inferredType: rawStats?.inferredType || 'unknown',
      semanticType: rawStats?.semanticType || 'unknown',
      distinctCount: rawStats?.distinctCount || 0,
      nullCount: rawStats?.nullCount || 0,
      nullPercentage: rawStats?.nullPercentage || 0,
      topValues,
      stats: rawStats?.stats || {},
    };
  }

  // 8. Build evidence
  const evidence: EvidenceV2 = { samples, columnStats };

  // 9. Selection manifest
  const selectionManifest: SelectionManifestV2 = {
    rationale: `Privacy level: ${options.privacyLevel}. Budget: ${tokenBudget.budgetId}`,
    includedColumns: includedColumns.length,
    excludedColumns: excludedColumns.length,
    includedIssues: includedIssues.length,
    excludedIssues: excludedIssueEntries.length,
    excludedByBudget: excludedIssueEntries.map(e => ({
      reason: 'budget_limit',
      resource: 'issue',
      name: e.name,
      detail: `Issue ${e.id} excluded due to budget constraints`,
    })),
  };

  // 10. Character budget check
  const envelope: Omit<EvidenceEnvelopeV2, 'truncationManifest'> = {
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
    columns,
    issues: includedIssues,
    evidence,
    selectionManifest,
    truncationManifest: truncManifest,
  };

  // Check character limits
  applyCharacterLimit(truncManifest, tokenBudget, 'full-envelope', estimateCharCount(envelope));

  // 11. Validate
  const validation = validateEnvelope(envelope as EvidenceEnvelopeV2);
  const privacyValidation = validatePrivacyPolicy(privacyPolicy);
  const budgetValidation = validateTokenBudget(tokenBudget);

  if (!validation.valid) {
    console.warn('[Contracts v2] Envelope validation warnings:', validation.errors);
  }
  if (!privacyValidation.valid) {
    console.warn('[Contracts v2] Privacy validation warnings:', privacyValidation.errors);
  }
  if (!budgetValidation.valid) {
    console.warn('[Contracts v2] Budget validation warnings:', budgetValidation.errors);
  }

  return envelope as EvidenceEnvelopeV2;
}
