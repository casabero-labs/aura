import {
  AuditReport,
  BenchmarkResult,
  EvidenceStatus,
  HealthDelta,
  HitlDecision,
  ImprovementRun,
  RemediationAction,
  ScriptValidationResult,
  AuditExecutionEvidence,
} from '../types';
import { runAudit } from './auditEngine';
import { buildDeterministicRemediationActions, simulateRemediation } from './remediationSimulator';
import { validateCleaningScript } from './scriptValidationService';

const countCritical = (report: AuditReport) =>
  report.issues.filter((issue) => issue.severity === 'critical').length;

const ruleNames = (report: AuditReport) => new Set(report.issues.map((issue) => issue.ruleName));

export const deriveEvidenceStatus = (
  result: Pick<BenchmarkResult, 'status' | 'inputMode' | 'formatCompliance' | 'contractCompliance' | 'hallucinatedColumns' | 'scriptValidation'>,
  hasGroundTruthMatch?: boolean
): EvidenceStatus => {
  const contractCompliance = result.contractCompliance ?? result.formatCompliance;
  if (result.status === 'error' || result.status === 'unavailable') return 'attempted_failed';
  if (result.status !== 'completed') return 'planned';
  if (result.inputMode === 'prompt_libre') {
    // Prompt libre is inherently less controlled → preliminary at best
    if (contractCompliance && result.hallucinatedColumns.length === 0) {
      return 'preliminary_valid';
    }
    return 'attempted_failed';
  }
  // Smart sample: stricter grading
  if (!contractCompliance || result.hallucinatedColumns.length > 0 || result.scriptValidation?.valid === false) {
    return 'attempted_failed';
  }
  // Formal valid: smart sample completed, all checks pass, AND ground truth exists
  if (hasGroundTruthMatch) return 'formal_valid';
  return 'preliminary_valid';
};

export const calculateHealthDelta = (
  before: AuditReport,
  after: AuditReport,
  skippedActions: RemediationAction[] = []
): HealthDelta => {
  const beforeRules = ruleNames(before);
  const afterRules = ruleNames(after);
  const correctedRules = Array.from(beforeRules).filter((rule) => !afterRules.has(rule));
  const unchangedRules = Array.from(beforeRules).filter((rule) => afterRules.has(rule));

  return {
    beforeScore: before.score,
    afterScore: after.score,
    scoreDelta: after.score - before.score,
    beforeCriticalIssues: countCritical(before),
    afterCriticalIssues: countCritical(after),
    criticalDelta: countCritical(after) - countCritical(before),
    beforeIssueCount: before.issues.length,
    afterIssueCount: after.issues.length,
    issueDelta: after.issues.length - before.issues.length,
    correctedRules,
    unchangedRules,
    requiresHumanReview: skippedActions.map((action) => action.description),
  };
};

const rankBenchmarkResult = (result: BenchmarkResult) => {
  if (result.evidenceStatus === 'attempted_failed' || result.status !== 'completed') return -1000;
  const scriptScore = result.scriptValidation?.valid ? 40 : 0;
  const hallucinationScore = result.hallucinatedColumns.length === 0 ? 25 : -20 * result.hallucinatedColumns.length;
  const privacyScore = (result.providerType === 'webllm_experimental' || result.providerType === 'local' || result.providerType === 'chrome' || result.providerType === 'ollama') ? 15 : 5;
  const inputScore = result.inputMode === 'smart_sample' ? 10 : -10;
  const latencyScore = result.latencyMs > 0 ? Math.max(0, 10 - result.latencyMs / 3000) : 0;
  return scriptScore + hallucinationScore + privacyScore + inputScore + latencyScore;
};

export const recommendBenchmarkResult = (results: BenchmarkResult[]) => {
  const eligible = results
    .filter((result) => result.status === 'completed')
    .filter((result) => result.evidenceStatus !== 'attempted_failed')
    .filter((result) => result.scriptValidation?.valid)
    .filter((result) => result.inputMode === 'smart_sample');

  return eligible.sort((a, b) => rankBenchmarkResult(b) - rankBenchmarkResult(a))[0];
};

export const createImprovementRun = (params: {
  fileName?: string;
  originalData: Record<string, any>[];
  fields: string[];
  delimiter: string;
  initialReport: AuditReport;
  auditEvidence?: AuditExecutionEvidence;
  benchmarkResults: BenchmarkResult[];
  generatedScript?: string;
  remediationActions?: RemediationAction[];
  scriptValidation?: ScriptValidationResult;
  hitlDecision?: HitlDecision;
}): ImprovementRun => {
  const recommendedResult = recommendBenchmarkResult(params.benchmarkResults);
  const generatedScript = params.generatedScript || '';
  const scriptValidation = params.scriptValidation || validateCleaningScript(params.initialReport, generatedScript);
  const remediationActions = params.remediationActions?.length
    ? params.remediationActions
    : buildDeterministicRemediationActions(params.initialReport);
  const simulation = simulateRemediation(params.originalData, remediationActions);
  const simulatedReport = runAudit(simulation.data, params.fields, params.delimiter);
  const healthDelta = calculateHealthDelta(params.initialReport, simulatedReport, simulation.skippedActions);
  const evidenceStatus: EvidenceStatus = params.benchmarkResults.some((result) => result.evidenceStatus === 'preliminary_valid')
    ? 'preliminary_valid'
    : params.benchmarkResults.some((result) => result.evidenceStatus === 'attempted_failed')
      ? 'attempted_failed'
      : 'planned';

  return {
    id: `improvement-${Date.now()}`,
    fileName: params.fileName,
    evidenceStatus,
    auditEvidence: params.auditEvidence,
    hitlDecision: params.hitlDecision,
    initialReport: params.initialReport,
    benchmarkResults: params.benchmarkResults.map((result) => ({
      ...result,
      recommendedForRemediation: recommendedResult?.id === result.id,
    })),
    recommendedResult,
    generatedScript,
    scriptValidation,
    remediationActions,
    simulatedData: simulation.data,
    simulatedReport,
    healthDelta,
    createdAt: new Date().toISOString(),
  };
};
