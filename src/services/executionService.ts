// ── Phase 5 Loop 3: Execution Service ──
// Integrates preflight, sandbox, and Colab notebook generation to prepare
// a clean_dataset(df) execution on a controlled fixture copy.
// Does NOT execute Python directly. Delegates to external Colab runtime.
// Does NOT modify contracts v2. Does NOT compute HealthDelta.

import { preflightCheck } from './preflightCheck';
import type { PreflightResult } from './preflightCheck';
import { executeSandboxed, createDefaultSandboxConfig } from './runtimeSandbox';
import type { SandboxConfig, SandboxExecutionResult } from './runtimeSandbox';
import { buildColabNotebookJSON } from './colabExporter';
import type { ColabNotebookParams } from './colabExporter';
import type { ScriptContractV2, RemediationPlanV2, ScriptBuildContextV2 } from '../contracts/llm/types';

export interface ExecutionSummaryV1 {
  runtime: 'colab_notebook' | 'pyodide' | 'other';
  runtimeVersion: string;
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  sandbox: {
    networkDisabled: boolean;
    filesystemRestricted: boolean;
    timeoutMs: number;
    memoryLimitMb: number | null;
    allowedImports: string[];
  };
  notebook?: {
    generated: boolean;
    json?: string;
    error?: string;
  };
}

export interface ControlledExecutionResult {
  execution: ExecutionSummaryV1;
  preflightBlocked: boolean;
  sandboxBlocked: boolean;
  fixtureApplied: boolean;
  datasetOriginalIntact: boolean;
  gates: {
    preflight: PreflightResult;
    sandbox: SandboxExecutionResult | null;
  };
}

export const RUNTIME_VERSION = '1.0.0';

interface ExecutionOptions {
  sandboxConfig?: SandboxConfig;
  fixtureCsv?: string;
  datasetName?: string;
  auditSummary?: ColabNotebookParams['auditSummary'];
}

function detectCsvColumns(csv: string): string[] {
  const header = csv.split('\n')[0] || '';
  return header.split(',').map(c => c.trim()).filter(Boolean);
}

function countCsvRows(csv: string): number {
  const lines = csv.split('\n').filter(l => l.trim());
  const headerCount = 1;
  return Math.max(0, lines.length - headerCount);
}

export function executeControlledRun(
  contract: ScriptContractV2,
  remediationPlan: RemediationPlanV2,
  buildContext: ScriptBuildContextV2,
  currentDatasetFingerprint: string,
  options?: ExecutionOptions,
): ControlledExecutionResult {
  const sandboxConfig = options?.sandboxConfig ?? createDefaultSandboxConfig();
  const startedAt = new Date().toISOString();
  const logs: string[] = [];
  const fixtureCsv = options?.fixtureCsv ?? '';
  const datasetName = options?.datasetName ?? 'fixture';

  logs.push(`[${startedAt}] controlled execution started`);
  logs.push(`dataset: ${datasetName}, fingerprint: ${currentDatasetFingerprint.slice(0, 16)}...`);

  // ── Gate 1: Preflight ──
  const preflight = preflightCheck(contract, remediationPlan, buildContext, currentDatasetFingerprint);
  if (preflight.status !== 'ready') {
    logs.push(`preflight blocked: ${preflight.reasons.join('; ')}`);
    return {
      execution: {
        runtime: 'colab_notebook',
        runtimeVersion: RUNTIME_VERSION,
        status: 'blocked',
        startedAt,
        finishedAt: null,
        durationMs: null,
        logs,
        error: `preflight blocked: ${preflight.reasons.join('; ')}`,
        sandbox: {
          networkDisabled: sandboxConfig.networkDisabled,
          filesystemRestricted: sandboxConfig.filesystemRestricted,
          timeoutMs: sandboxConfig.timeoutMs,
          memoryLimitMb: sandboxConfig.memoryLimitMb,
          allowedImports: sandboxConfig.allowedImports,
        },
        notebook: { generated: false },
      },
      preflightBlocked: true,
      sandboxBlocked: false,
      fixtureApplied: false,
      datasetOriginalIntact: true,
      gates: { preflight, sandbox: null },
    };
  }
  logs.push('gate 1 passed: preflight ready');

  // ── Gate 2: Sandbox ──
  const sandbox = executeSandboxed(contract, preflight, sandboxConfig);
  if (sandbox.status !== 'success') {
    logs.push(`sandbox blocked: ${sandbox.error ?? 'unknown sandbox error'}`);
    return {
      execution: {
        runtime: 'colab_notebook',
        runtimeVersion: RUNTIME_VERSION,
        status: 'failed',
        startedAt,
        finishedAt: null,
        durationMs: null,
        logs,
        error: `sandbox validation failed: ${sandbox.error ?? 'unknown error'}`,
        sandbox: {
          networkDisabled: sandboxConfig.networkDisabled,
          filesystemRestricted: sandboxConfig.filesystemRestricted,
          timeoutMs: sandboxConfig.timeoutMs,
          memoryLimitMb: sandboxConfig.memoryLimitMb,
          allowedImports: sandboxConfig.allowedImports,
        },
        notebook: { generated: false },
      },
      preflightBlocked: false,
      sandboxBlocked: true,
      fixtureApplied: false,
      datasetOriginalIntact: true,
      gates: { preflight, sandbox },
    };
  }
  logs.push('gate 2 passed: sandbox safe');

  // ── Fixture: validate copy, never touch original ──
  const rowsBefore = countCsvRows(fixtureCsv);
  const columns = detectCsvColumns(fixtureCsv);
  logs.push(`fixture: ${rowsBefore} rows, ${columns.length} columns`);
  logs.push('operating on fixture copy — dataset original intact');

  // ── Notebook generation: call colabExporter ──
  logs.push('generating Colab notebook via colabExporter...');

  let notebookGenerated = false;
  let notebookJson: string | undefined;
  let notebookError: string | undefined;

  try {
    const auditSummary = options?.auditSummary ?? {
      score: 0,
      rowCount: rowsBefore,
      colCount: columns.length,
      issueCount: 0,
    };

    const colabParams: ColabNotebookParams = {
      datasetName,
      csvFields: columns,
      approvedScript: contract.scriptText,
      auditSummary,
    };

    notebookJson = buildColabNotebookJSON(colabParams);
    notebookGenerated = true;
    logs.push(`notebook generated: ${notebookJson.length} chars`);
  } catch (err) {
    notebookError = err instanceof Error ? err.message : String(err);
    logs.push(`notebook generation failed: ${notebookError}`);
  }

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  if (notebookGenerated) {
    logs.push(`[${finishedAt}] notebook prepared for Colab runtime`);
    logs.push('NOTE: clean_dataset(df) executes in Google Colab, not in AURA');
  } else {
    logs.push(`[${finishedAt}] notebook generation failed`);
  }

  return {
    execution: {
      runtime: 'colab_notebook',
      runtimeVersion: RUNTIME_VERSION,
      status: notebookGenerated ? 'success' : 'failed',
      startedAt,
      finishedAt,
      durationMs,
      logs,
      error: notebookError ?? null,
      sandbox: {
        networkDisabled: sandboxConfig.networkDisabled,
        filesystemRestricted: sandboxConfig.filesystemRestricted,
        timeoutMs: sandboxConfig.timeoutMs,
        memoryLimitMb: sandboxConfig.memoryLimitMb,
        allowedImports: sandboxConfig.allowedImports,
      },
      notebook: {
        generated: notebookGenerated,
        json: notebookJson,
        error: notebookError,
      },
    },
    preflightBlocked: false,
    sandboxBlocked: false,
    fixtureApplied: true,
    datasetOriginalIntact: true,
    gates: { preflight, sandbox },
  };
}
