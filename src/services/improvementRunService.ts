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
    summary = `No issues detected before or after execution (score: ${scoreBefore} → ${scoreAfter}).`;
  } else if (issueAfter < issueBefore) {
    status = 'improved';
    summary = `Issues reduced from ${issueBefore} to ${issueAfter} after Colab execution (score: ${scoreBefore} → ${scoreAfter}, delta: ${delta > 0 ? '+' : ''}${delta}).`;
  } else if (issueAfter === issueBefore) {
    status = 'unchanged';
    summary = `Issue count unchanged (${issueBefore} → ${issueAfter}) despite Colab execution (score: ${scoreBefore} → ${scoreAfter}).`;
    if (delta !== 0) {
      caveats.push(`Score changed by ${delta > 0 ? '+' : ''}${delta} despite stable issue count — score movement may reflect distribution shifts not captured by issue count.`);
    }
  } else {
    status = 'worsened';
    summary = `Issues increased from ${issueBefore} to ${issueAfter} after Colab execution (score: ${scoreBefore} → ${scoreAfter}, delta: ${delta > 0 ? '+' : ''}${delta}).`;
  }

  // Inconclusive guard: negative score delta with improved issues (unexpected)
  if (status === 'improved' && delta < 0) {
    caveats.push(`Score decreased (${delta}) despite issue reduction — investigate score computation methodology.`);
  }

  // Inconclusive guard: positive score delta with worsened issues (unexpected)
  if (status === 'worsened' && delta > 0) {
    caveats.push(`Score increased (${delta}) despite issue increase — score weighting may compensate for new issues.`);
  }

  // Inconclusive guard: zero delta with issues
  if (delta === 0 && issueBefore > 0 && issueAfter > 0) {
    caveats.push('Score delta is 0 — score may be capped or formula insensitive to remaining issues.');
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
    'clean_dataset(df) executes in Google Colab (external), not inside AURA.',
    'Reaudit uses AURA runAudit engine — same engine as initial audit (reproducible, not independent validation).',
    'Output CSV imported as fixture — no access to original dataset rows used in Colab.',
    'Score delta may not reflect true data quality improvement if script operations do not address root causes.',
    'Script modifications after contract approval are not reflected in this run.',
  ];

  if (healthDelta.status === 'worsened') {
    limitations.push('HealthDelta status is worsened — dataset quality degraded after execution. Do not use output without manual review.');
  }

  if (healthDelta.status === 'inconclusive') {
    limitations.push('HealthDelta status is inconclusive — comparison could not determine clear improvement or degradation.');
  }

  const permitted: string[] = [
    'Claim that issue counts were compared before/after using AURA runAudit engine.',
    'Claim that execution was prepared via executeControlledRun (gates passed).',
    'Claim that notebook was generated for Colab runtime.',
    'Claim that reaudit is reproducible using the same audit engine.',
    'Claim dataset original was never touched by AURA (fixture copy only).',
  ];

  if (healthDelta.status === 'improved') {
    permitted.push('Claim that issues were reduced after Colab execution (per runAudit engine).');
    permitted.push('Claim that output dataset was produced via Colab and reaudited.');
  }

  const prohibited: string[] = [
    'Do NOT claim that AURA executed Python directly — execution delegated to Google Colab.',
    'Do NOT claim that HealthDelta is a formal measurement outside the AURA audit engine.',
    'Do NOT claim the output dataset is automatically correct or trustworthy without manual review.',
    'Do NOT claim that score improvement equals data quality improvement without domain validation.',
    'Do NOT claim this run replaces manual data stewardship or domain expert review.',
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
    throw new Error(`Execution gate failed: ${executionResult.execution.error ?? 'unknown'}`);
  }

  // ── Step 2: Import Colab output ──
  logs.push('step 2: importColabOutput...');
  let afterOutput;
  try {
    afterOutput = importColabOutput(options.afterCsv, { datasetName: options.datasetName });
    logs.push(`after output: ${afterOutput.rowCount} rows, ${afterOutput.colCount} cols`);
  } catch (err) {
    throw new Error(`Failed to import Colab output: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 3: Run reaudit ──
  logs.push('step 3: runReaudit...');
  let reauditResult: ReauditResult;
  try {
    reauditResult = runReaudit(options.beforeCsv, options.afterCsv, options.beforeEvidenceRef);
    logs.push(`reaudit: ${reauditResult.summary.beforeIssueCount} → ${reauditResult.summary.afterIssueCount} issues`);
  } catch (err) {
    throw new Error(`Reaudit failed: ${err instanceof Error ? err.message : String(err)}`);
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
