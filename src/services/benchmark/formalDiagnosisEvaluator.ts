import diagnosticOracleJson from '../../../experiments/final-evaluation/oracles/diagnostic-oracle.v1.json';
import type { DiagnosisResponseV2, EvidenceEnvelopeV2 } from '../../contracts/llm/types';
import type { AutomaticEvaluationV1, ExperimentRunV1 } from './experimentTypes';
import {
  evaluateDiagnosticOracle,
  type DiagnosticOracleV1,
  type PredictedDiagnosticFinding,
} from './diagnosticOracleEvaluator';

const oracle = diagnosticOracleJson as DiagnosticOracleV1;

export const evaluateFormalDiagnosisRun = (
  run: ExperimentRunV1,
  envelope: EvidenceEnvelopeV2,
  evaluatedAt = new Date().toISOString(),
): AutomaticEvaluationV1 => {
  if (run.diagnosis?.status !== 'completed') throw new Error('No se puede evaluar un diagnóstico incompleto.');
  const diagnosis = run.diagnosis.parsedOutput as DiagnosisResponseV2;
  const issueById = new Map(diagnosis.issues.map((issue) => [issue.issueId, issue]));
  const columnNameById = new Map(envelope.columns.map((column) => [column.columnId, column.name]));
  const predictions: PredictedDiagnosticFinding[] = diagnosis.diagnosisBlocks.map((block) => ({
    ruleId: block.ruleId,
    columnId: block.columnId === null ? null : columnNameById.get(block.columnId) ?? block.columnId,
    scope: block.scope,
    issueId: block.issueId,
    evidenceRefs: issueById.get(block.issueId)?.evidenceRefs ?? [],
    badSampleRefs: issueById.get(block.issueId)?.evidenceRefs ?? [],
  }));
  const activeOracle: DiagnosticOracleV1 = run.inputMode === 'prompt_libre'
    ? {
        ...oracle,
        findings: oracle.findings.map((finding) => finding.primaryEligible
          ? { ...finding, visibleEvidenceModes: [...new Set([...finding.visibleEvidenceModes, 'prompt_libre' as const])] }
          : finding),
      }
    : oracle;
  const evaluation = evaluateDiagnosticOracle({
    oracle: activeOracle,
    inputMode: run.inputMode,
    knownColumns: envelope.columns.flatMap((column) => [column.columnId, column.name]),
    predictions,
    contractCompliant: true,
    contractErrors: [],
    unsupportedClaims: [],
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
      inventedColumns: evaluation.hallucinations.inventedColumns,
      unsupportedClaims: evaluation.hallucinations.unsupportedClaims,
      anchoringScore: evaluation.anchoring.score,
    },
    script: {
      contractValid: false,
      syntaxValid: false,
      safe: false,
      coveredActions: [],
      missingActions: [],
      unsupportedActions: [],
    },
  };
};
