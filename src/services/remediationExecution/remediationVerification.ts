import type { AuditReport, QualityIssue } from '../../types';
import { sha256BytesHex } from '../../contracts/llm/hash';
import { runReaudit, type ReauditResult } from '../reauditService';
import {
  validatePythonExecutionChain,
  type PythonExecutionBundleV1,
  type PythonExecutionReceiptV1,
} from './pythonExecutionContract';

export type RemediationVerificationOutcome =
  | 'improved'
  | 'unchanged'
  | 'worsened'
  | 'inconclusive';

export interface FindingRef {
  identityKey: string;
  id: string;
  ruleId: string;
  column: string | null;
  severity: QualityIssue['severity'];
  count: number;
  affectedPercentage: number;
}

export interface PersistentFindingRef {
  identityKey: string;
  before: FindingRef;
  after: FindingRef;
}

export interface FindingComparison {
  resolved: FindingRef[];
  persistent: PersistentFindingRef[];
  new: FindingRef[];
}

export interface RemediationVerificationResultV1 {
  contractId: 'aura.remediation-verification.v1';
  contractVersion: '1.0.0';
  executionId: string;
  diagnosisReceiptHash: string;
  evidenceEnvelopeRef: string;
  sourceDatasetSha256: string;
  correctedDatasetSha256: string;
  approvedScriptHash: string;
  executionBundleHash: string;
  pythonReceiptHash: string;
  executedAt: string;
  before: { score: number; issueCount: number; rowCount: number; columnCount: number };
  after: { score: number; issueCount: number; rowCount: number; columnCount: number };
  findings: FindingComparison;
  estimatedCellsModified: number | null;
  outcome: RemediationVerificationOutcome;
  limitations: string[];
}

export interface BuildRemediationVerificationInput {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  sourceCsv: Uint8Array;
  correctedCsv: Uint8Array;
  evidenceEnvelopeRef: string;
  delimiter?: string;
}

export interface RemediationVerificationBuildEvidence {
  result: RemediationVerificationResultV1;
  reaudit: ReauditResult;
}

export interface DeriveVerificationOutcomeInput {
  beforeScore: number;
  afterScore: number;
  beforeIssueCount: number;
  afterIssueCount: number;
  resolvedCount: number;
  newCount: number;
}

const compareNumber = (after: number, before: number): -1 | 0 | 1 =>
  after === before ? 0 : after > before ? 1 : -1;

const findingIdentity = (finding: QualityIssue): string => {
  const id = finding.id.trim() || '__missing_id__';
  const column = finding.column?.trim() || '__dataset__';
  return `id:${id}|rule:${finding.ruleId}|column:${column}`;
};

const toFindingRef = (finding: QualityIssue): FindingRef => ({
  identityKey: findingIdentity(finding),
  id: finding.id,
  ruleId: finding.ruleId,
  column: finding.column ?? null,
  severity: finding.severity,
  count: finding.count,
  affectedPercentage: finding.affectedPercentage,
});

const byIdentity = (left: FindingRef, right: FindingRef): number =>
  left.identityKey.localeCompare(right.identityKey);

const indexFindings = (report: AuditReport, stage: 'before' | 'after'): Map<string, FindingRef> => {
  const indexed = new Map<string, FindingRef>();
  for (const finding of report.issues) {
    const ref = toFindingRef(finding);
    if (indexed.has(ref.identityKey)) {
      throw new Error(`REMEDIATION_FINDING_IDENTITY_COLLISION:${stage}:${ref.identityKey}`);
    }
    indexed.set(ref.identityKey, ref);
  }
  return indexed;
};

/**
 * Uses deterministic QualityIssue ids plus rule and column scope, preventing
 * equal rules in separate columns from collapsing into one finding.
 */
export function compareQualityFindings(
  beforeReport: AuditReport,
  afterReport: AuditReport,
): FindingComparison {
  const before = indexFindings(beforeReport, 'before');
  const after = indexFindings(afterReport, 'after');

  const resolved = [...before.entries()]
    .filter(([identityKey]) => !after.has(identityKey))
    .map(([, finding]) => finding)
    .sort(byIdentity);
  const persistent = [...before.entries()]
    .filter(([identityKey]) => after.has(identityKey))
    .map(([identityKey, beforeFinding]) => ({
      identityKey,
      before: beforeFinding,
      after: after.get(identityKey)!,
    }))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
  const newFindings = [...after.entries()]
    .filter(([identityKey]) => !before.has(identityKey))
    .map(([, finding]) => finding)
    .sort(byIdentity);

  return { resolved, persistent, new: newFindings };
}

export function deriveVerificationOutcome(
  input: DeriveVerificationOutcomeInput,
): RemediationVerificationOutcome {
  const scoreSignal = compareNumber(input.afterScore, input.beforeScore);
  // Fewer issues is positive, so reverse the usual after/before comparison.
  const issueSignal = compareNumber(input.beforeIssueCount, input.afterIssueCount);

  // Any real churn that both resolves and introduces findings is ambiguous:
  // aggregate score/count improvements cannot prove the new finding is safe.
  if (input.resolvedCount > 0 && input.newCount > 0) {
    return 'inconclusive';
  }
  if ((scoreSignal > 0 && issueSignal < 0) || (scoreSignal < 0 && issueSignal > 0)) {
    return 'inconclusive';
  }
  if (scoreSignal > 0 || issueSignal > 0) return 'improved';
  if (scoreSignal < 0 || issueSignal < 0) return 'worsened';
  return 'unchanged';
}

const requireTrustReferences = (input: BuildRemediationVerificationInput): void => {
  if (!input.bundle.bundleHash) throw new Error('REMEDIATION_VERIFICATION_BUNDLE_HASH_REQUIRED');
  if (!input.bundle.inputReceiptRef) throw new Error('REMEDIATION_VERIFICATION_DIAGNOSIS_RECEIPT_REQUIRED');
  if (!input.bundle.evidenceEnvelopeRef) throw new Error('REMEDIATION_VERIFICATION_EVIDENCE_ENVELOPE_REQUIRED');
  if (input.evidenceEnvelopeRef !== input.bundle.evidenceEnvelopeRef) {
    throw new Error('REMEDIATION_VERIFICATION_EVIDENCE_ENVELOPE_MISMATCH');
  }
};

/**
 * Fail-closed bridge from a validated Python execution to the deterministic
 * AURA reaudit. The chain is checked again here so callers cannot bypass UI
 * validation and fabricate a verification result.
 */
export function buildRemediationVerificationWithReaudit(
  input: BuildRemediationVerificationInput,
): RemediationVerificationBuildEvidence {
  requireTrustReferences(input);
  const chainErrors = validatePythonExecutionChain({
    bundle: input.bundle,
    receipt: input.receipt,
    sourceCsv: input.sourceCsv,
    outputCsv: input.correctedCsv,
  });
  if (chainErrors.length > 0) {
    throw new Error(`REMEDIATION_VERIFICATION_CHAIN_INVALID: ${chainErrors.join('; ')}`);
  }
  if (input.receipt.syntax.status !== 'passed' || input.receipt.execution.status !== 'passed') {
    throw new Error('REMEDIATION_VERIFICATION_EXECUTION_NOT_PASSED');
  }

  let sourceCsv: string;
  let correctedCsv: string;
  try {
    sourceCsv = new TextDecoder('utf-8', { fatal: true }).decode(input.sourceCsv);
  } catch {
    throw new Error('REMEDIATION_VERIFICATION_SOURCE_CSV_DECODE_FAILED');
  }
  try {
    correctedCsv = new TextDecoder('utf-8', { fatal: true }).decode(input.correctedCsv);
  } catch {
    throw new Error('REMEDIATION_VERIFICATION_CORRECTED_CSV_DECODE_FAILED');
  }
  const reaudit = runReaudit(sourceCsv, correctedCsv, input.evidenceEnvelopeRef, {
    delimiter: input.delimiter,
  });

  if (
    input.receipt.output?.rowCount !== reaudit.afterReport.rowCount
    || input.receipt.output?.columnCount !== reaudit.afterReport.colCount
  ) {
    throw new Error('REMEDIATION_VERIFICATION_OUTPUT_DIMENSIONS_MISMATCH');
  }

  const findings = compareQualityFindings(reaudit.beforeReport, reaudit.afterReport);
  const outcome = deriveVerificationOutcome({
    beforeScore: reaudit.beforeReport.score,
    afterScore: reaudit.afterReport.score,
    beforeIssueCount: reaudit.beforeReport.issues.length,
    afterIssueCount: reaudit.afterReport.issues.length,
    resolvedCount: findings.resolved.length,
    newCount: findings.new.length,
  });
  const limitations = [
    'La reauditoría usa el mismo motor determinista de AURA y no sustituye validación de dominio',
    'Una mejora del score no prueba por sí sola la corrección de negocio.',
  ];
  if (reaudit.output.changedCellsEstimate === null) {
    limitations.push('Los cambios de celdas no se estiman cuando cambia la estructura o el número de filas.');
  }

  const result: RemediationVerificationResultV1 = {
    contractId: 'aura.remediation-verification.v1',
    contractVersion: '1.0.0',
    executionId: input.bundle.runId,
    diagnosisReceiptHash: input.bundle.inputReceiptRef,
    evidenceEnvelopeRef: input.bundle.evidenceEnvelopeRef,
    sourceDatasetSha256: sha256BytesHex(input.sourceCsv),
    correctedDatasetSha256: sha256BytesHex(input.correctedCsv),
    approvedScriptHash: input.bundle.approvedScriptHash,
    executionBundleHash: input.bundle.bundleHash,
    pythonReceiptHash: input.receipt.receiptHash,
    executedAt: input.receipt.execution.completedAt,
    before: {
      score: reaudit.beforeReport.score,
      issueCount: reaudit.beforeReport.issues.length,
      rowCount: reaudit.beforeReport.rowCount,
      columnCount: reaudit.beforeReport.colCount,
    },
    after: {
      score: reaudit.afterReport.score,
      issueCount: reaudit.afterReport.issues.length,
      rowCount: reaudit.afterReport.rowCount,
      columnCount: reaudit.afterReport.colCount,
    },
    findings,
    estimatedCellsModified: reaudit.output.changedCellsEstimate,
    outcome,
    limitations,
  };
  return { result, reaudit };
}

export function buildRemediationVerification(
  input: BuildRemediationVerificationInput,
): RemediationVerificationResultV1 {
  return buildRemediationVerificationWithReaudit(input).result;
}
