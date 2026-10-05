import { AuditExecutionEvidence, AuditReport, ExecutionTraceEvent } from '../types';
import type { CsvEncoding } from './csvEncoding.mjs';

/** Text decoding applied to the original bytes; datasetSha256 stays over those bytes. */
export interface SourceEncodingEvidence {
  encoding?: CsvEncoding;
  bom?: boolean;
}

export type AuditExecutionEvidenceWithEncoding = AuditExecutionEvidence & SourceEncodingEvidence;

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

export const computeBytesSha256 = async (bytes: Uint8Array | ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const computeFileSha256 = async (file: Pick<Blob, 'arrayBuffer'>): Promise<string> =>
  computeBytesSha256(await file.arrayBuffer());

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

export interface IngestionEvidenceParams extends SourceEncodingEvidence {
  fileName?: string;
  fileSize?: number;
  datasetFingerprint: string;
  datasetSha256?: string;
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

const encodingFields = (params: SourceEncodingEvidence): SourceEncodingEvidence => ({
  ...(params.encoding === undefined ? {} : { encoding: params.encoding }),
  ...(params.bom === undefined ? {} : { bom: params.bom }),
});

export const buildIngestionEvidence = (params: IngestionEvidenceParams): Omit<AuditExecutionEvidenceWithEncoding, 'id' | 'auditDurationMs' | 'totalDurationMs' | 'issueCount' | 'score' | 'trace'> & { id: string } => ({
  id: `ingest-${Date.now()}`,
  fileName: params.fileName,
  fileSize: params.fileSize,
  datasetFingerprint: params.datasetFingerprint,
  datasetSha256: params.datasetSha256,
  startedAt: params.startedAt,
  completedAt: params.completedAt,
  parseDurationMs: params.parseDurationMs,
  rowsProcessed: params.rowsProcessed,
  columnsProcessed: params.columnsProcessed,
  delimiter: params.delimiter,
  truncated: params.truncated,
  ingestionStatus: params.ingestionStatus,
  ingestionError: params.ingestionError,
  ...encodingFields(params),
});

export const buildAuditEvidence = (params: BuildAuditEvidenceParams): AuditExecutionEvidenceWithEncoding => ({
  id: `audit-${Date.now()}`,
  fileName: params.fileName,
  fileSize: params.fileSize,
  datasetFingerprint: params.datasetFingerprint,
  datasetSha256: params.datasetSha256,
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
  ...encodingFields(params),
  issueCount: params.report.issues.length,
  score: params.report.score,
  trace: params.trace,
});
