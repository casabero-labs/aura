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

export interface IngestionEvidenceParams {
  fileName?: string;
  fileSize?: number;
  datasetFingerprint: string;
  startedAt: string;
  completedAt: string;
  parseDurationMs: number;
  rowsProcessed: number;
  columnsProcessed: number;
  delimiter: string;
  truncated: boolean;
  ingestionStatus: 'success' | 'error';
  ingestionError?: string;
}

export interface BuildAuditEvidenceParams extends IngestionEvidenceParams {
  auditDurationMs: number;
  report: AuditReport;
  trace: ExecutionTraceEvent[];
}

export const buildIngestionEvidence = (params: IngestionEvidenceParams): Omit<AuditExecutionEvidence, 'id' | 'auditDurationMs' | 'totalDurationMs' | 'issueCount' | 'score' | 'trace'> & { id: string } => ({
  id: `ingest-${Date.now()}`,
  fileName: params.fileName,
  fileSize: params.fileSize,
  datasetFingerprint: params.datasetFingerprint,
  startedAt: params.startedAt,
  completedAt: params.completedAt,
  parseDurationMs: params.parseDurationMs,
  rowsProcessed: params.rowsProcessed,
  columnsProcessed: params.columnsProcessed,
  delimiter: params.delimiter,
  truncated: params.truncated,
  ingestionStatus: params.ingestionStatus,
  ingestionError: params.ingestionError,
});

export const buildAuditEvidence = (params: BuildAuditEvidenceParams): AuditExecutionEvidence => ({
  id: `audit-${Date.now()}`,
  fileName: params.fileName,
  fileSize: params.fileSize,
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
  ingestionStatus: params.ingestionStatus,
  ingestionError: params.ingestionError,
  issueCount: params.report.issues.length,
  score: params.report.score,
  trace: params.trace,
});
