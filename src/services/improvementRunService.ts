// ── Phase 5 Loop 5: Improvement Run Service ──
// Orchestrates the full Phase 5 pipeline: execution → reaudit → HealthDelta.
// Produces ImprovementRunV1 with all components.
//
// Does NOT execute Python directly. Does NOT use real user datasets.

import { sha256short } from '../contracts/llm/hash';
import { executeControlledRun, type ControlledExecutionResult } from './executionService';
import type { ExecutionSummaryV1 } from './executionService';
import { importColabOutput, runReaudit, type ReauditResult, type ReauditSummaryV1, type OutputDatasetSummaryV1 } from './reauditService';
import type { ScriptContractV2, RemediationPlanV2, ScriptBuildContextV2 } from '../contracts/llm/types';

export interface HealthDeltaV1 {
  status: 'improved' | 'unchanged' | 'worsened' | 'inconclusive';
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  issueDelta: number;
  summary: string;
  caveats: string[];
}

export interface ImprovementRunV1 {
  contractId: 'aura.improvement_run.v1';
  contractVersion: '1.0.0';
  runId: string;
  createdAt: string;
  sourceDatasetFingerprint: string;
  sourceEvidenceEnvelopeRef: string;
  scriptContractRef: string;
  scriptHash: string;
  remediationPlanId: string;
  acceptedActionIds: string[];
  execution: ExecutionSummaryV1;
  outputDataset: OutputDatasetSummaryV1;
  reaudit: ReauditSummaryV1;
  healthDelta: HealthDeltaV1;
  limitations: string[];
  claims: {
    permitted: string[];
    prohibited: string[];
  };
}

export interface ImprovementRunOptions {
  beforeEvidenceRef: string;
  beforeCsv: string;
  afterCsv: string;
  datasetName?: string;
  auditSummary?: {
    score: number;
    rowCount: number;
    colCount: number;
    issueCount: number;
    truncated?: boolean;
  };
}

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `run:${ts}-${rand}`;
}

export function computeHealthDelta(reauditResult: ReauditResult): HealthDeltaV1 {
  const scoreBefore = reauditResult.beforeReport.score;
  const scoreAfter = reauditResult.afterReport.score;
  const issueBefore = reauditResult.summary.beforeIssueCount;
  const issueAfter = reauditResult.summary.afterIssueCount;

  const delta = scoreAfter - scoreBefore;
  const issueDelta = issueAfter - issueBefore;

  let status: HealthDeltaV1['status'];
  let summary: string;
  const caveats: string[] = [];

  // Determine status based on issue delta (primary signal)
  if (issueBefore === 0 && issueAfter === 0) {
    status = 'unchanged';
    summary = `Sin hallazgos antes ni después de la ejecución (score: ${scoreBefore} → ${scoreAfter}).`;
  } else if (issueAfter < issueBefore) {
    status = 'improved';
    summary = `Los hallazgos bajaron de ${issueBefore} a ${issueAfter} tras la ejecución en Colab (score: ${scoreBefore} → ${scoreAfter}, diferencia: ${delta > 0 ? '+' : ''}${delta}).`;
  } else if (issueAfter === issueBefore) {
    status = 'unchanged';
    summary = `Los hallazgos no cambiaron (${issueBefore} → ${issueAfter}) pese a la ejecución en Colab (score: ${scoreBefore} → ${scoreAfter}).`;
    if (delta !== 0) {
      caveats.push(`El score cambió ${delta > 0 ? '+' : ''}${delta} con los mismos hallazgos: el movimiento puede reflejar cambios de distribución que el conteo de hallazgos no captura.`);
    }
  } else {
    status = 'worsened';
    summary = `Los hallazgos subieron de ${issueBefore} a ${issueAfter} tras la ejecución en Colab (score: ${scoreBefore} → ${scoreAfter}, diferencia: ${delta > 0 ? '+' : ''}${delta}).`;
  }

  // Inconclusive: score and issues move in opposite directions
  if (status === 'improved' && delta < 0) {
    status = 'inconclusive';
    summary = `Los hallazgos bajaron de ${issueBefore} a ${issueAfter}, pero el score bajó de ${scoreBefore} a ${scoreAfter} (diferencia: ${delta}). Las dos señales se contradicen: el cambio de salud no es concluyente.`;
    caveats.push(`El score bajó (${delta}) aunque bajaron los hallazgos: revisar cómo se calcula el score.`);
  }

  // Inconclusive: score and issues move in opposite directions
  if (status === 'worsened' && delta > 0) {
    status = 'inconclusive';
    summary = `Los hallazgos subieron de ${issueBefore} a ${issueAfter}, pero el score subió de ${scoreBefore} a ${scoreAfter} (diferencia: ${delta}). Las dos señales se contradicen: el cambio de salud no es concluyente.`;
    caveats.push(`El score subió (${delta}) aunque subieron los hallazgos: la ponderación del score puede compensar los hallazgos nuevos.`);
  }

  // Stale score: zero delta with issues
  if (delta === 0 && issueBefore > 0 && issueAfter > 0) {
    caveats.push('La diferencia de score es 0: el score puede estar topado o la fórmula no responder a los hallazgos que quedan.');
  }

  return {
    status,
    scoreBefore,
    scoreAfter,
    delta,
    issueDelta,
    summary,
    caveats,
  };
}

export function buildImprovementRunV1(
  contract: ScriptContractV2,
  executionResult: ControlledExecutionResult,
  reauditResult: ReauditResult,
  healthDelta: HealthDeltaV1,
  options: ImprovementRunOptions,
): ImprovementRunV1 {
  const runId = generateRunId();
  const createdAt = new Date().toISOString();

  const limitations: string[] = [
    'clean_dataset(df) se ejecuta fuera de AURA, en Google Colab.',
    'La reauditoría usa el motor runAudit de AURA, el mismo de la auditoría inicial: es reproducible, no es una validación independiente.',
    'El CSV de salida se importa como dato de prueba: AURA no accede a las filas originales usadas en Colab.',
    'La diferencia de score puede no reflejar una mejora real de calidad si las operaciones del script no atacan las causas de fondo.',
    'Los cambios al script posteriores a la aprobación del contrato no se reflejan en esta ejecución.',
  ];

  if (healthDelta.status === 'worsened') {
    limitations.push('El cambio de salud empeoró: la calidad del dataset bajó tras la ejecución. No usar la salida sin revisión manual.');
  }

  if (healthDelta.status === 'inconclusive') {
    limitations.push('El cambio de salud no es concluyente: la comparación no permite afirmar mejora ni empeoramiento.');
  }

  const permitted: string[] = [
    'Afirmar que los hallazgos se compararon antes y después con el motor runAudit de AURA.',
    'Afirmar que la ejecución se preparó con executeControlledRun y pasó sus controles.',
    'Afirmar que se generó un notebook para ejecutar en Colab.',
    'Afirmar que la reauditoría es reproducible con el mismo motor de auditoría.',
    'Afirmar que AURA nunca tocó el dataset original (solo una copia de prueba).',
  ];

  if (healthDelta.status === 'improved') {
    permitted.push('Afirmar que los hallazgos bajaron tras la ejecución en Colab, según runAudit.');
    permitted.push('Afirmar que el dataset de salida se produjo en Colab y se reauditó.');
  }

  const prohibited: string[] = [
    'No afirmar que AURA ejecutó Python directamente: la ejecución se delega a Google Colab.',
    'No afirmar que el cambio de salud es una medición formal fuera del motor de auditoría de AURA.',
    'No afirmar que el dataset de salida es correcto o confiable sin revisión manual.',
    'No afirmar que subir el score equivale a mejorar la calidad de los datos sin validación de dominio.',
    'No afirmar que esta ejecución reemplaza la custodia manual de los datos ni la revisión de un experto de dominio.',
  ];

  return {
    contractId: 'aura.improvement_run.v1',
    contractVersion: '1.0.0',
    runId,
    createdAt,
    sourceDatasetFingerprint: contract.datasetFingerprint || options.beforeEvidenceRef,
    sourceEvidenceEnvelopeRef: options.beforeEvidenceRef,
    scriptContractRef: `contract:${sha256short(contract.scriptHash || contract.scriptText, 16)}`,
    scriptHash: contract.scriptHash,
    remediationPlanId: contract.remediationRef || 'unknown',
    acceptedActionIds: contract.acceptedActionIds,
    execution: executionResult.execution,
    outputDataset: reauditResult.output,
    reaudit: reauditResult.summary,
    healthDelta,
    limitations,
    claims: { permitted, prohibited },
  };
}

export interface ImprovementFlowResult {
  improvementRun: ImprovementRunV1;
  executionResult: ControlledExecutionResult;
  reauditResult: ReauditResult;
  healthDelta: HealthDeltaV1;
}

export function runImprovementFlow(
  contract: ScriptContractV2,
  remediationPlan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  options: ImprovementRunOptions,
): ImprovementFlowResult {
  const logs: string[] = [];
  const startedAt = new Date().toISOString();
  logs.push(`[${startedAt}] improvement flow started for contract ${contract.scriptHash?.slice(0, 16) ?? 'unknown'}...`);

  // ── Step 1: executeControlledRun (L3 pipeline) ──
  logs.push('step 1: executeControlledRun...');
  const executionResult = executeControlledRun(
    contract,
    remediationPlan,
    buildContext,
    contract.datasetFingerprint || options.beforeEvidenceRef,
    {
      fixtureCsv: options.beforeCsv,
      datasetName: options.datasetName,
      auditSummary: options.auditSummary,
    },
  );
  logs.push(`execution status: ${executionResult.execution.status}`);

  if (executionResult.execution.status === 'blocked' || executionResult.execution.status === 'failed') {
    logs.push('execution gate failed — returning partial result');
    throw new Error(`La ejecución no pasó sus controles: ${executionResult.execution.error ?? 'causa desconocida'}`);
  }

  // ── Step 2: Import Colab output ──
  logs.push('step 2: importColabOutput...');
  let afterOutput;
  try {
    afterOutput = importColabOutput(options.afterCsv, { datasetName: options.datasetName });
    logs.push(`after output: ${afterOutput.rowCount} rows, ${afterOutput.colCount} cols`);
  } catch (err) {
    throw new Error(`No se pudo importar la salida de Colab: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 3: Run reaudit ──
  logs.push('step 3: runReaudit...');
  let reauditResult: ReauditResult;
  try {
    reauditResult = runReaudit(options.beforeCsv, options.afterCsv, options.beforeEvidenceRef);
    logs.push(`reaudit: ${reauditResult.summary.beforeIssueCount} → ${reauditResult.summary.afterIssueCount} issues`);
  } catch (err) {
    throw new Error(`La reauditoría falló: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 4: Compute HealthDelta ──
  logs.push('step 4: computeHealthDelta...');
  const healthDelta = computeHealthDelta(reauditResult);
  logs.push(`healthDelta status: ${healthDelta.status} (score: ${healthDelta.scoreBefore} → ${healthDelta.scoreAfter}, issues: ${reauditResult.summary.beforeIssueCount} → ${reauditResult.summary.afterIssueCount})`);

  // ── Step 5: Build ImprovementRunV1 ──
  logs.push('step 5: buildImprovementRunV1...');
  const improvementRun = buildImprovementRunV1(contract, executionResult, reauditResult, healthDelta, options);
  logs.push(`improvement run ${improvementRun.runId} created`);

  const finishedAt = new Date().toISOString();
  logs.push(`[${finishedAt}] improvement flow completed`);

  return { improvementRun, executionResult, reauditResult, healthDelta };
}

// ── Type Guards ──

export function isHealthDeltaV1(x: unknown): x is HealthDeltaV1 {
  if (typeof x !== 'object' || x === null) return false;
  const h = x as Record<string, unknown>;
  return (
    typeof h.status === 'string' &&
    ['improved', 'unchanged', 'worsened', 'inconclusive'].includes(h.status as string) &&
    (typeof h.scoreBefore === 'number' || h.scoreBefore === null) &&
    (typeof h.scoreAfter === 'number' || h.scoreAfter === null) &&
    (typeof h.delta === 'number' || h.delta === null) &&
    typeof h.issueDelta === 'number' &&
    typeof h.summary === 'string' &&
    Array.isArray(h.caveats) &&
    h.caveats.every(c => typeof c === 'string')
  );
}

export function isImprovementRunV1(x: unknown): x is ImprovementRunV1 {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    r.contractId === 'aura.improvement_run.v1' &&
    r.contractVersion === '1.0.0' &&
    typeof r.runId === 'string' && r.runId.startsWith('run:') &&
    typeof r.createdAt === 'string' &&
    typeof r.sourceDatasetFingerprint === 'string' &&
    typeof r.sourceEvidenceEnvelopeRef === 'string' &&
    typeof r.scriptContractRef === 'string' &&
    typeof r.scriptHash === 'string' &&
    typeof r.remediationPlanId === 'string' &&
    Array.isArray(r.acceptedActionIds) &&
    typeof r.execution === 'object' && r.execution !== null &&
    typeof r.outputDataset === 'object' && r.outputDataset !== null &&
    typeof r.reaudit === 'object' && r.reaudit !== null &&
    isHealthDeltaV1(r.healthDelta) &&
    Array.isArray(r.limitations) &&
    typeof r.claims === 'object' && r.claims !== null &&
    Array.isArray((r.claims as Record<string, unknown>).permitted) &&
    Array.isArray((r.claims as Record<string, unknown>).prohibited)
  );
}

// ── JSON Export ──

export function exportImprovementRunJSON(run: ImprovementRunV1): string {
  if (!isImprovementRunV1(run)) {
    throw new Error('exportImprovementRunJSON: invalid ImprovementRunV1 — type guard failed');
  }
  return JSON.stringify(run, null, 2);
}
