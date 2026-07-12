import type { AuditExecutionEvidence, AuditReport } from '../types';
import type { DiagnosticReport } from './diagnosticReport';
import { canonicalJson, sha256hex } from '../contracts/llm';

export interface ExportArtifactIdentity {
  runId: string;
  reportId: string;
  datasetSha256: string | null;
  diagnosisReceiptHash: string | null;
  reportContentHash: string;
}

interface BuildExportArtifactIdentityInput {
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  diagnosticReport?: DiagnosticReport | null;
  diagnosisReceiptHash?: string | null;
}

export const buildExportArtifactIdentity = ({
  report,
  auditEvidence = null,
  diagnosticReport = null,
  diagnosisReceiptHash = null,
}: BuildExportArtifactIdentityInput): ExportArtifactIdentity => {
  const reportContentHash = sha256hex(canonicalJson(diagnosticReport ?? report));
  const reportId = diagnosticReport?.metadata.reportId ?? `diag-report-${reportContentHash.slice(0, 12)}`;

  return {
    runId: auditEvidence?.id ?? `run-${reportId}`,
    reportId,
    datasetSha256: auditEvidence?.datasetSha256 ?? null,
    diagnosisReceiptHash,
    reportContentHash,
  };
};
