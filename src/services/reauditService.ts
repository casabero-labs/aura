// ── Phase 5 Loop 4: Reaudit Service ──
// Imports external Python output (including historical controlled Colab fixtures) and runs
// reaudit before/after to produce ReauditSummaryV1.
//
// Does NOT execute Python directly. Does NOT compute HealthDelta.
// Does NOT modify contracts v2.

import Papa from 'papaparse';
import { sha256hex } from '../contracts/llm/hash';
import { runAudit } from './auditEngine';
import type { AuditReport, HealthDelta } from '../types';
import type { ReauditEvidenceV1 } from './benchmark/experimentTypes';

export interface ReauditSummaryV1 {
  beforeEvidenceEnvelopeRef: string;
  afterEvidenceEnvelopeRef: string;
  beforeIssueCount: number;
  afterIssueCount: number;
  rulesCompared: string[];
}

export interface OutputDatasetSummaryV1 {
  rowCountBefore: number;
  rowCountAfter: number;
  columnCountBefore: number;
  columnCountAfter: number;
  outputFingerprint: string;
  changedCellsEstimate: number | null;
  exportedCsvRef: string | null;
}

export interface ImportedCsvOutput {
  data: Record<string, any>[];
  fields: string[];
  fingerprint: string;
  rowCount: number;
  colCount: number;
  delimiter: string;
  rawCsv: string;
}

export interface ReauditOptions {
  delimiter?: string;
  beforeEvidenceRef?: string;
  afterEvidenceRef?: string;
  datasetName?: string;
}

export interface ReauditResult {
  summary: ReauditSummaryV1;
  output: OutputDatasetSummaryV1;
  beforeReport: AuditReport;
  afterReport: AuditReport;
  beforeOutput: ImportedCsvOutput;
  afterOutput: ImportedCsvOutput;
}

/** @deprecated Historical name retained for Laboratorio/Colab compatibility. */
export type ColabOutput = ImportedCsvOutput;

export function parseCsvString(csvString: string, forcedDelimiter?: string): {
  data: Record<string, any>[];
  fields: string[];
  delimiter: string;
} {
  if (!csvString || !csvString.trim()) {
    return { data: [], fields: [], delimiter: ',' };
  }

  const result = Papa.parse<Record<string, any>>(csvString, {
    header: true,
    skipEmptyLines: true,
    delimiter: forcedDelimiter || '',
    dynamicTyping: false,
  });

  const fatalErrors = result.errors.filter((error) => error.type === 'Quotes');
  if (fatalErrors.length > 0) {
    throw new Error(`CSV_PARSE_FAILED: ${fatalErrors.map((error) => error.code).join(', ')}`);
  }

  return {
    data: result.data as Record<string, any>[],
    fields: result.meta.fields || [],
    delimiter: result.meta.delimiter || ',',
  };
}

export function computeCsvFingerprint(csvString: string): string {
  return sha256hex(csvString.trim());
}

/** Exact byte-equivalent text fingerprint for formal imported artifacts. */
export function computeExactCsvFingerprint(csvString: string): string {
  return sha256hex(csvString);
}

export function buildEnvelopeRef(fingerprint: string, prefix = 'env'): string {
  return `${prefix}:${sha256hex(fingerprint).slice(0, 16)}`;
}

export function importExternalPythonOutput(
  csvString: string,
  options?: { delimiter?: string; datasetName?: string },
): ImportedCsvOutput {
  if (!csvString || !csvString.trim()) {
    throw new Error('importExternalPythonOutput: csvString is empty or null');
  }

  const { data, fields, delimiter } = parseCsvString(csvString, options?.delimiter);
  const fingerprint = computeCsvFingerprint(csvString);

  return {
    data,
    fields,
    fingerprint,
    rowCount: data.length,
    colCount: fields.length,
    delimiter,
    rawCsv: csvString,
  };
}

/** @deprecated Historical name retained for real Laboratorio/Colab routes. */
export const importColabOutput = importExternalPythonOutput;

export function computeChangedCellsEstimate(
  beforeOutput: ImportedCsvOutput,
  afterOutput: ImportedCsvOutput,
): number | null {
  if (beforeOutput.data.length !== afterOutput.data.length) {
    return null;
  }
  if (beforeOutput.fields.length !== afterOutput.fields.length) {
    return null;
  }

  const sameColumns = beforeOutput.fields.every(f => afterOutput.fields.includes(f));
  if (!sameColumns) return null;

  let changed = 0;
  const minRows = Math.min(beforeOutput.data.length, afterOutput.data.length);

  for (let i = 0; i < minRows; i++) {
    for (const field of beforeOutput.fields) {
      const beforeVal = String(beforeOutput.data[i][field] ?? '');
      const afterVal = String(afterOutput.data[i][field] ?? '');
      if (beforeVal !== afterVal) changed++;
    }
  }

  return changed;
}

export function runReaudit(
  beforeCsv: string,
  afterCsv: string,
  beforeEvidenceRef: string,
  options?: ReauditOptions,
): ReauditResult {
  const startedAt = new Date().toISOString();
  const logs: string[] = [];

  logs.push(`[${startedAt}] reaudit started`);
  logs.push(`beforeEvidenceRef: ${beforeEvidenceRef}`);

  // ── Import external Python outputs ──
  let beforeOutput: ImportedCsvOutput;
  let afterOutput: ImportedCsvOutput;

  try {
    beforeOutput = importExternalPythonOutput(beforeCsv, { delimiter: options?.delimiter });
    logs.push(`before: ${beforeOutput.rowCount} rows, ${beforeOutput.colCount} cols, fp: ${beforeOutput.fingerprint.slice(0, 16)}...`);
  } catch (err) {
    throw new Error(`beforeCsv import failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    afterOutput = importExternalPythonOutput(afterCsv);
    logs.push(`after: ${afterOutput.rowCount} rows, ${afterOutput.colCount} cols, fp: ${afterOutput.fingerprint.slice(0, 16)}...`);
  } catch (err) {
    throw new Error(`afterCsv import failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Run audits ──
  logs.push('running before audit...');
  const beforeReport = runAudit(beforeOutput.data, beforeOutput.fields, beforeOutput.delimiter);
  logs.push(`before report: score=${beforeReport.score}, issues=${beforeReport.issues.length}`);

  logs.push('running after audit...');
  const afterReport = runAudit(afterOutput.data, afterOutput.fields, afterOutput.delimiter);
  logs.push(`after report: score=${afterReport.score}, issues=${afterReport.issues.length}`);

  // ── Build envelope refs ──
  const afterEvidenceRef = options?.afterEvidenceRef ?? buildEnvelopeRef(afterOutput.fingerprint);

  // ── Compute rules compared ──
  const beforeRuleIds = new Set(beforeReport.issues.map(i => i.ruleId));
  const afterRuleIds = new Set(afterReport.issues.map(i => i.ruleId));
  const rulesCompared = [...new Set([...beforeRuleIds, ...afterRuleIds])].sort();

  // ── Compute changed cells ──
  const changedCellsEstimate = computeChangedCellsEstimate(beforeOutput, afterOutput);
  logs.push(`changed cells estimate: ${changedCellsEstimate}`);

  // ── Build summaries ──
  const summary: ReauditSummaryV1 = {
    beforeEvidenceEnvelopeRef: beforeEvidenceRef,
    afterEvidenceEnvelopeRef: afterEvidenceRef,
    beforeIssueCount: beforeReport.issues.length,
    afterIssueCount: afterReport.issues.length,
    rulesCompared,
  };

  const output: OutputDatasetSummaryV1 = {
    rowCountBefore: beforeOutput.rowCount,
    rowCountAfter: afterOutput.rowCount,
    columnCountBefore: beforeOutput.colCount,
    columnCountAfter: afterOutput.colCount,
    outputFingerprint: afterOutput.fingerprint,
    changedCellsEstimate,
    exportedCsvRef: `output:${afterEvidenceRef}`,
  };

  const finishedAt = new Date().toISOString();
  logs.push(`[${finishedAt}] reaudit completed`);
  logs.push(`issue delta: ${beforeReport.issues.length} → ${afterReport.issues.length}`);

  return { summary, output, beforeReport, afterReport, beforeOutput, afterOutput };
}

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export function buildReauditEvidence(
  result: ReauditResult,
  delta: HealthDelta,
): ReauditEvidenceV1 {
  const beforeRules = new Set(result.beforeReport.issues.map((issue) => issue.ruleId));
  const afterRules = new Set(result.afterReport.issues.map((issue) => issue.ruleId));
  const resolvedRuleIds = uniqueSorted([...beforeRules].filter((ruleId) => !afterRules.has(ruleId)));
  const persistentRuleIds = uniqueSorted([...beforeRules].filter((ruleId) => afterRules.has(ruleId)));
  const newRuleIds = uniqueSorted([...afterRules].filter((ruleId) => !beforeRules.has(ruleId)));

  let outcome: ReauditEvidenceV1['outcome'];
  const scoreImproved = delta.afterScore > delta.beforeScore;
  const issuesImproved = delta.afterIssueCount < delta.beforeIssueCount;
  const scoreWorsened = delta.afterScore < delta.beforeScore;
  const issuesWorsened = delta.afterIssueCount > delta.beforeIssueCount;
  if ((scoreImproved || issuesImproved) && !scoreWorsened && !issuesWorsened) {
    outcome = 'improved';
  } else if ((scoreWorsened || issuesWorsened) && !scoreImproved && !issuesImproved) {
    outcome = 'worsened';
  } else if (!scoreImproved && !issuesImproved && !scoreWorsened && !issuesWorsened) {
    outcome = 'unchanged';
  } else {
    outcome = 'inconclusive';
  }

  return {
    beforeScore: delta.beforeScore,
    afterScore: delta.afterScore,
    beforeIssueCount: delta.beforeIssueCount,
    afterIssueCount: delta.afterIssueCount,
    beforeRows: result.output.rowCountBefore,
    afterRows: result.output.rowCountAfter,
    beforeColumns: result.output.columnCountBefore,
    afterColumns: result.output.columnCountAfter,
    estimatedCellsModified: result.output.changedCellsEstimate,
    resolvedRuleIds,
    persistentRuleIds,
    newRuleIds,
    outcome,
  };
}
