import diagnosticOracleJson from './oracles/diagnostic-oracle.v1.json';
import type { DiagnosisResponseV2, EvidenceEnvelopeV2 } from '../../contracts/llm/types';
import type { AutomaticEvaluationV1, ExperimentRunV1 } from './experimentTypes';
import {
  evaluateDiagnosticOracle,
  type DiagnosticOracleV1,
  type PredictedDiagnosticFinding,
} from './diagnosticOracleEvaluator';
import { extractFormalDiagnosisEvidence } from './formalDiagnosisEvidence';

const oracle = diagnosticOracleJson as DiagnosticOracleV1;

export const evaluateFormalDiagnosisRun = (
  run: ExperimentRunV1,
  envelope: EvidenceEnvelopeV2,
  evaluatedAt = new Date().toISOString(),
): AutomaticEvaluationV1 => {
  if (run.diagnosis?.status !== 'completed') throw new Error('No se puede evaluar un diagnóstico incompleto.');
  const diagnosis = run.diagnosis.parsedOutput as DiagnosisResponseV2;
  const evidence = extractFormalDiagnosisEvidence(diagnosis, envelope, run, run.executionReceipt ?? null);
  const issueById = new Map(diagnosis.issues.map((issue) => [issue.issueId, issue]));
  const columnNameById = new Map(envelope.columns.map((column) => [column.columnId, column.name]));

  const predictions: PredictedDiagnosticFinding[] = diagnosis.diagnosisBlocks.map((block) => ({
    ruleId: block.ruleId,
    columnId: block.columnId === null ? null : columnNameById.get(block.columnId) ?? block.columnId,
    scope: block.scope,
    issueId: block.issueId,
    evidenceRefs: evidence.anchors.anchoredEvidenceRefs.filter((ref) => {
      const issue = issueById.get(block.issueId);
      return issue?.evidenceRefs.includes(ref) ?? false;
    }),
    badSampleRefs: evidence.anchors.anchoredBadSampleRefs.filter((ref) => {
      const issue = issueById.get(block.issueId);
      return issue?.evidenceRefs.includes(ref) ?? false;
    }),
  }));

  const evaluation = evaluateDiagnosticOracle({
    oracle,
    inputMode: run.inputMode,
    knownColumns: envelope.columns.flatMap((column) => [column.columnId, column.name]),
    predictions,
    contractCompliant: evidence.contract.contractCompliant,
    contractErrors: evidence.contract.contractErrors,
    unsupportedClaims: evidence.unsupportedClaims.map((c) => `${c.field}: ${c.text}`),
  });

  return {
    contractId: 'aura.automatic-evaluation.v1',
    evaluatedAt,
    diagnosis: {
      primary: evaluation.primary,
      engineCoverage: evaluation.engineCoverage,
      evidenceFidelity: evaluation.evidenceFidelity,
      extendedDiscoveryKeys: evaluation.extendedDiscoveryKeys,
      contractCompliant: evaluation.contract.compliant,
      contractErrors: evidence.contract.contractErrors,
      inventedColumns: evaluation.hallucinations.inventedColumns,
      unsupportedClaims: evaluation.hallucinations.unsupportedClaims,
      anchoredEvidenceRefs: evidence.anchors.anchoredEvidenceRefs,
      anchoredBadSampleRefs: evidence.anchors.anchoredBadSampleRefs,
      anchoringScore: evaluation.anchoring.score,
    },
    script: {
      contractValid: false,
      syntaxValid: null,
      safe: false,
      coveredActions: [],
      missingActions: [],
      unsupportedActions: [],
    },
  };
};
