import type { RemediationVerificationResultV1 } from './remediationVerification';
import type {
  PythonExecutionBundleV1,
  PythonExecutionReceiptV1,
} from './pythonExecutionContract';

export type RemediationExecutionStatus =
  | 'not_run'
  | 'prepared'
  | 'invalid'
  | 'verified'
  | 'reaudited';

export interface CorrectedDatasetExportV1 {
  sha256: string;
  rowCount: number;
  columnCount: number;
  includedInEvidenceArchive: boolean;
}

export interface RemediationExecutionExportV1 {
  status: RemediationExecutionStatus;
  executionBundle: PythonExecutionBundleV1 | null;
  pythonReceipt: PythonExecutionReceiptV1 | null;
  verification: RemediationVerificationResultV1 | null;
  correctedDataset: CorrectedDatasetExportV1 | null;
  limitations: string[];
}

export const NOT_RUN_REMEDIATION_LIMITATION =
  'El análisis fue completado, pero no se ejecutó una remediación sobre el dataset';

export const buildNotRunRemediationExecution = (): RemediationExecutionExportV1 => ({
  status: 'not_run',
  executionBundle: null,
  pythonReceipt: null,
  verification: null,
  correctedDataset: null,
  limitations: [NOT_RUN_REMEDIATION_LIMITATION],
});
