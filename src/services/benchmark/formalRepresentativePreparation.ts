import {
  buildEnvelopeRef,
  buildRemediationContext,
  buildRemediationPlanV2,
  buildScriptCandidateV2,
  buildScriptContext,
  finalizeScriptContractV2,
  validateScriptCandidateV2,
  type DiagnosisExecutionResult,
  type DiagnosisInputPackageV2,
  type DiagnosisResponseV2,
  type EvidenceEnvelopeV2,
} from '../../contracts/llm';
import type { ProviderMetrics } from '../../types';
import type { ExperimentRunV1 } from './experimentTypes';
import { buildReauditEvidence, computeExactCsvFingerprint, runReaudit } from '../reauditService';
import { calculateHealthDelta } from '../improvementService';

export const prepareFormalRepresentative = (
  run: ExperimentRunV1,
  envelope: EvidenceEnvelopeV2,
  generatedAt = new Date().toISOString(),
): ExperimentRunV1 => {
  if (run.status !== 'approved' || run.hitl?.status !== 'approved') {
    throw new Error('Solo un representante aprobado por HITL puede generar el script determinista.');
  }
  if (run.diagnosis?.status !== 'completed' || !run.executionReceipt) {
    throw new Error('El representante no conserva diagnóstico y recibo de ejecución completos.');
  }
  const inputSnapshot: DiagnosisInputPackageV2 = {
    contractId: 'aura.input-snapshot.v2', contractVersion: '2.0.0',
    inputMode: run.inputMode, includedSections: [...run.input.includedSections],
    systemInstruction: run.input.systemInstruction, userPayload: run.input.userPayload,
    responseSchema: run.input.responseSchema, evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
    promptVersion: run.input.promptVersion, promptHash: run.input.promptHash,
    inputHash: run.input.inputHash, responseSchemaHash: run.input.responseSchemaHash,
  };
  const stageMetrics = run.diagnosis.metrics;
  const metrics: ProviderMetrics = {
    provider: run.executionReceipt.provider,
    model: run.executionReceipt.observedModel,
    latencyMs: stageMetrics?.totalDurationMs ?? 0,
    firstTokenMs: stageMetrics?.firstTokenMs ?? 0,
    tokensGenerated: stageMetrics?.outputTokens ?? 0,
    promptTokens: stageMetrics?.promptTokens ?? undefined,
    totalDurationMs: stageMetrics?.totalDurationMs ?? undefined,
    loadDurationMs: stageMetrics?.loadDurationMs ?? undefined,
    promptEvalDurationMs: stageMetrics?.promptEvalDurationMs ?? undefined,
    evalDurationMs: stageMetrics?.evalDurationMs ?? undefined,
    reasoningTokens: stageMetrics?.reasoningTokens,
    isLocal: true,
    timestamp: run.diagnosis.completedAt,
  };
  const remediationContext = {
    ...buildRemediationContext(envelope),
    evidenceEnvelopeRef: buildEnvelopeRef(envelope),
    inputReceiptRef: run.executionReceipt.receiptHash,
  };
  const diagnosisExecution: DiagnosisExecutionResult = {
    version: 2,
    diagnosis: run.diagnosis.parsedOutput as DiagnosisResponseV2,
    metrics,
    evidenceEnvelopeRef: run.input.evidenceEnvelopeRef,
    promptHash: run.input.promptHash,
    promptVersion: run.input.promptVersion,
    rawResponseHash: run.executionReceipt.rawResponseHash,
    inputMode: run.inputMode,
    inputHash: run.input.inputHash,
    inputSnapshot,
    executionReceipt: run.executionReceipt,
    remediationContext,
  };
  const draftPlan = buildRemediationPlanV2(diagnosisExecution);
  const plan = {
    ...draftPlan,
    plan: draftPlan.plan.map((action) => ({
      ...action,
      approvalStatus: action.actionability === 'auto_safe' ? 'approved' as const : 'rejected' as const,
    })),
  };
  const columnRefs = envelope.columns.map((column) => ({
    columnId: column.columnId,
    name: column.name,
    position: column.position,
    duplicateOrdinal: column.duplicateOrdinal,
    pythonLiteral: `_c[${JSON.stringify(column.columnId)}]`,
    isAmbiguous: column.isAmbiguous,
    isDuplicate: column.isDuplicate,
    isReservedWord: column.isReservedWord,
  }));
  const buildContext = buildScriptContext(remediationContext, columnRefs, envelope.datasetFingerprint.sha256);
  const candidate = buildScriptCandidateV2(plan, buildContext, { generatedAt });
  const validation = validateScriptCandidateV2(candidate, plan, buildContext);
  if (!validation.valid) {
    throw new Error(`El script determinista no superó validación: ${validation.errors[0]?.message ?? 'error desconocido'}`);
  }
  const contract = finalizeScriptContractV2(candidate, validation);
  return {
    ...run,
    status: 'awaiting_external_output',
    updatedAt: generatedAt,
    script: {
      contractId: 'aura.llm-stage-result.v1',
      stage: 'script', status: 'completed',
      attemptId: `deterministic:${run.runId}:script`,
      startedAt: generatedAt, completedAt: generatedAt,
      rawOutput: contract.scriptText, parsedOutput: contract,
      validationErrors: [], metrics: null, error: null,
    },
    automaticEvaluation: run.automaticEvaluation ? {
      ...run.automaticEvaluation,
      script: {
        contractValid: true, syntaxValid: false, safe: true,
        coveredActions: [...contract.acceptedActionIds],
        missingActions: [], unsupportedActions: [],
      },
    } : null,
    execution: {
      contractId: 'aura.dynamic-execution-evidence.v1',
      status: 'awaiting_external_output',
      approvedScriptHash: contract.scriptHash,
      beforeDatasetSha256: run.environment.dataset.sha256,
      afterDatasetSha256: null,
      executionEnvironment: 'external-controlled-python',
      executedAt: null,
      reaudit: null,
    },
  };
};

export const importFormalRepresentativeOutput = async (
  run: ExperimentRunV1,
  beforeFile: Pick<File, 'text'>,
  afterFile: Pick<File, 'text'>,
  completedAt = new Date().toISOString(),
): Promise<ExperimentRunV1> => {
  if (
    run.status !== 'awaiting_external_output'
    || run.hitl?.status !== 'approved'
    || run.execution?.status !== 'awaiting_external_output'
  ) throw new Error('La corrida no está esperando un CSV externo aprobado.');
  const [beforeCsv, afterCsv] = await Promise.all([beforeFile.text(), afterFile.text()]);
  const beforeHash = computeExactCsvFingerprint(beforeCsv);
  if (beforeHash !== run.environment.dataset.sha256 || beforeHash !== run.execution.beforeDatasetSha256) {
    throw new Error('El CSV fuente no coincide byte a byte con el dataset congelado.');
  }
  if (!afterCsv.trim()) throw new Error('El CSV resultante está vacío.');
  const reaudit = runReaudit(beforeCsv, afterCsv, run.input.evidenceEnvelopeRef, {
    delimiter: ',',
  });
  const healthDelta = calculateHealthDelta(reaudit.beforeReport, reaudit.afterReport);
  return {
    ...run,
    status: 'reaudited',
    updatedAt: completedAt,
    automaticEvaluation: run.automaticEvaluation ? {
      ...run.automaticEvaluation,
      script: { ...run.automaticEvaluation.script, syntaxValid: true },
    } : null,
    execution: {
      ...run.execution,
      status: 'reaudited',
      afterDatasetSha256: computeExactCsvFingerprint(afterCsv),
      executionEnvironment: 'external-controlled-python',
      executedAt: completedAt,
      reaudit: buildReauditEvidence(reaudit, healthDelta),
    },
  };
};
