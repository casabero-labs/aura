import type { DiagnosisExecutionResult, DiagnosisFailureEvidenceV2 } from '../contracts/llm';

export type DiagnosisExportStatus = 'valid' | 'invalid' | 'not_run';

interface DiagnosisExportStateInput {
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  failureEvidence?: DiagnosisFailureEvidenceV2 | null;
}

export const deriveDiagnosisExportStatus = ({
  structuredDiagnosis,
  failureEvidence,
}: DiagnosisExportStateInput): DiagnosisExportStatus => {
  if (structuredDiagnosis) return 'valid';
  if (failureEvidence) return 'invalid';
  return 'not_run';
};
