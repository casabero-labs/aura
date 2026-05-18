import { AuditExecutionEvidence, AuditReport, ExecutionTraceEvent } from '../types';

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const fingerprintDataset = (data: Record<string, any>[], fields: string[]) => {
  const sample = data.slice(0, 25);
  const tail = data.length > 25 ? data.slice(-5) : [];
  return hashString(JSON.stringify({ rows: data.length, fields, sample, tail }));
};

export const fingerprintReport = (report: AuditReport) =>
  hashString(JSON.stringify({
    score: report.score,
    rows: report.rowCount,
    columns: report.colCount,
    delimiter: report.delimiterDetected,
    issues: report.issues.map((issue) => ({
      id: issue.id,
      ruleName: issue.ruleName,
      column: issue.column,
      count: issue.count,
      severity: issue.severity,
    })),
  }));

export const createTraceRecorder = () => {
  const startedAtMs = performance.now();
  const events: ExecutionTraceEvent[] = [];

  const mark = (stage: string, details?: ExecutionTraceEvent['details']) => {
    events.push({
      stage,
      timestamp: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - startedAtMs),
      details,
    });
  };

  return { mark, events, startedAtMs };
};

export const buildAuditEvidence = (params: {
  fileName?: string;
  datasetFingerprint: string;
  startedAt: string;
  completedAt: string;
  parseDurationMs: number;
  auditDurationMs: number;
  rowsProcessed: number;
  columnsProcessed: number;
  delimiter: string;
  truncated: boolean;
  report: AuditReport;
  trace: ExecutionTraceEvent[];
}): AuditExecutionEvidence => ({
  id: `audit-${Date.now()}`,
  fileName: params.fileName,
  datasetFingerprint: params.datasetFingerprint,
  startedAt: params.startedAt,
  completedAt: params.completedAt,
  parseDurationMs: params.parseDurationMs,
  auditDurationMs: params.auditDurationMs,
  totalDurationMs: params.parseDurationMs + params.auditDurationMs,
  rowsProcessed: params.rowsProcessed,
  columnsProcessed: params.columnsProcessed,
  delimiter: params.delimiter,
  truncated: params.truncated,
  issueCount: params.report.issues.length,
  score: params.report.score,
  trace: params.trace,
});
