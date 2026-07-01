// ── Phase 5 Loop 2: Runtime Sandbox Mínimo ──
// Validates script safety, enforces sandbox restrictions, and prepares
// controlled execution context. Delegates actual Python execution to
// external runtime (Colab notebook or future Pyodide integration).
// Does NOT execute Python directly. Does NOT modify contracts v2.

import type { PreflightResult } from './preflightCheck';
import type { ScriptContractV2 } from '../contracts/llm/types';

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MEMORY_MB = 512;

export const DEFAULT_ALLOWED_IMPORTS = [
  'pandas',
  'numpy',
  'json',
  'csv',
  'io',
  'hashlib',
  're',
  'math',
  'datetime',
  'collections',
  'itertools',
  'typing',
];

const BANNED_IMPORT_PATTERNS = [
  /^import\s+os\b/m,
  /^from\s+os\s+/m,
  /^import\s+sys\b/m,
  /^from\s+sys\s+/m,
  /^import\s+subprocess\b/m,
  /^from\s+subprocess\s+/m,
  /^import\s+shutil\b/m,
  /^from\s+shutil\s+/m,
  /^import\s+socket\b/m,
  /^from\s+socket\s+/m,
  /^import\s+urllib\b/m,
  /^from\s+urllib\s+/m,
  /^import\s+requests\b/m,
  /^from\s+requests\s+/m,
  /^import\s+http\b/m,
  /^from\s+http\s+/m,
  /^import\s+ftplib\b/m,
  /^from\s+ftplib\s+/m,
  /^import\s+pathlib\b/m,
  /^from\s+pathlib\s+/m,
];

const NETWORK_PATTERNS = [
  /requests\./,
  /urllib\./,
  /socket\./,
  /http\.client/,
  /ftplib\./,
  /\burlopen\b/,
];

const FILESYSTEM_PATTERNS = [
  /\bopen\s*\(/,
  /\bos\.path\b/,
  /\bos\.remove\b/,
  /\bos\.unlink\b/,
  /\bos\.rename\b/,
  /\bos\.chmod\b/,
  /\bos\.mkdir\b/,
  /\bos\.rmdir\b/,
  /\bPath\s*\(/,
  /\bshutil\./,
  /\b__file__\b/,
];

const DANGEROUS_BUILTINS = [
  /\b__import__\s*\(/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bcompile\s*\(/,
  /\bglobals\s*\(/,
  /\blocals\s*\(/,
  /\bgetattr\s*\(/,
  /\bsetattr\s*\(/,
];

export interface SandboxConfig {
  timeoutMs: number;
  networkDisabled: boolean;
  filesystemRestricted: boolean;
  memoryLimitMb: number | null;
  allowedImports: string[];
}

export interface SandboxExecutionResult {
  status: 'success' | 'failed' | 'blocked' | 'timeout';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  logs: string[];
  error: string | null;
  sandbox: SandboxConfig;
  preflightBlocked: boolean;
  importViolations: string[];
  hasCleanDataset: boolean;
  networkAccessDetected: boolean;
  filesystemAccessDetected: boolean;
  dangerousBuiltinsDetected: string[];
}

export function createDefaultSandboxConfig(): SandboxConfig {
  return {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    networkDisabled: true,
    filesystemRestricted: true,
    memoryLimitMb: DEFAULT_MEMORY_MB,
    allowedImports: [...DEFAULT_ALLOWED_IMPORTS],
  };
}

export function detectCleanDatasetFunction(scriptText: string): boolean {
  return /\bdef\s+clean_dataset\s*\(/.test(scriptText);
}

export function detectNetworkAccess(scriptText: string): boolean {
  return NETWORK_PATTERNS.some(p => p.test(scriptText));
}

export function detectFilesystemAccess(scriptText: string): boolean {
  return FILESYSTEM_PATTERNS.some(p => p.test(scriptText));
}

export function detectDangerousBuiltins(scriptText: string): string[] {
  return DANGEROUS_BUILTINS
    .filter(p => p.test(scriptText))
    .map(p => {
      const match = scriptText.match(p);
      return match ? match[0].trim().replace(/\($/, '') : p.source;
    });
}

export function detectBannedImports(scriptText: string): string[] {
  return BANNED_IMPORT_PATTERNS
    .filter(p => p.test(scriptText))
    .map(p => {
      const match = scriptText.match(/\S+\s+\S+/);
      if (match) {
        const line = scriptText.split('\n').find(l => p.test(l));
        return line?.trim() ?? p.source;
      }
      return p.source;
    });
}

export function validateScriptImports(
  scriptText: string,
  allowedImports: string[],
): string[] {
  const violations: string[] = [];
  const importRegex = /^(?:import\s+(\S+)|from\s+(\S+)\s+import)/m;

  const banned = detectBannedImports(scriptText);
  violations.push(...banned.map(b => `banned import: ${b}`));

  const lines = scriptText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ') && !trimmed.startsWith('from ')) continue;

    const match = trimmed.match(importRegex);
    if (match) {
      const moduleName = (match[1] || match[2] || '').split('.')[0];
      if (moduleName && !allowedImports.includes(moduleName)) {
        const alreadyReported = violations.some(v => v.includes(moduleName));
        if (!alreadyReported) {
          violations.push(`disallowed import: ${moduleName} (not in whitelist)`);
        }
      }
    }
  }

  return violations;
}

export function executeSandboxed(
  contract: ScriptContractV2,
  preflightResult: PreflightResult,
  config?: SandboxConfig,
): SandboxExecutionResult {
  const sandbox = config ?? createDefaultSandboxConfig();
  const startedAt = new Date().toISOString();
  const logs: string[] = [];
  const errorParts: string[] = [];

  logs.push(`[${startedAt}] sandbox initialized`);

  const preflightBlocked = preflightResult.status !== 'ready';
  if (preflightBlocked) {
    logs.push(`preflight blocked: ${preflightResult.reasons.join('; ')}`);
    return {
      status: 'blocked',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: null,
      logs,
      error: `preflight not ready: ${preflightResult.reasons.join('; ')}`,
      sandbox,
      preflightBlocked: true,
      importViolations: [],
      hasCleanDataset: false,
      networkAccessDetected: false,
      filesystemAccessDetected: false,
      dangerousBuiltinsDetected: [],
    };
  }

  logs.push('preflight passed — ready to execute');
  logs.push(`sandbox config: timeout=${sandbox.timeoutMs}ms, network=${sandbox.networkDisabled ? 'disabled' : 'enabled'}, filesystem=${sandbox.filesystemRestricted ? 'restricted' : 'open'}, memory=${sandbox.memoryLimitMb ? `${sandbox.memoryLimitMb}MB` : 'unlimited'}`);

  const hasCleanDataset = detectCleanDatasetFunction(contract.scriptText);
  if (!hasCleanDataset) {
    errorParts.push('clean_dataset(df) function not found in script');
  }
  logs.push(`clean_dataset detected: ${hasCleanDataset}`);

  const networkAccessDetected = detectNetworkAccess(contract.scriptText);
  if (networkAccessDetected && sandbox.networkDisabled) {
    errorParts.push('network access detected in script (sandbox network disabled)');
  }
  logs.push(`network access detected: ${networkAccessDetected}`);

  const filesystemAccessDetected = detectFilesystemAccess(contract.scriptText);
  if (filesystemAccessDetected && sandbox.filesystemRestricted) {
    errorParts.push('filesystem access detected in script (sandbox filesystem restricted)');
  }
  logs.push(`filesystem access detected: ${filesystemAccessDetected}`);

  const dangerousBuiltinsDetected = detectDangerousBuiltins(contract.scriptText);
  if (dangerousBuiltinsDetected.length > 0) {
    errorParts.push(`dangerous builtins detected: ${dangerousBuiltinsDetected.join(', ')}`);
  }
  logs.push(`dangerous builtins: ${dangerousBuiltinsDetected.length > 0 ? dangerousBuiltinsDetected.join(', ') : 'none'}`);

  const importViolations = validateScriptImports(contract.scriptText, sandbox.allowedImports);
  if (importViolations.length > 0) {
    errorParts.push(`import violations: ${importViolations.join('; ')}`);
  }
  logs.push(`import violations: ${importViolations.length}`);

  const failed = errorParts.length > 0;

  const finishedAt = new Date().toISOString();
  const durationMs = failed ? null : (new Date(finishedAt).getTime() - new Date(startedAt).getTime());

  if (failed) {
    logs.push(`[${finishedAt}] sandbox validation failed`);
    return {
      status: 'failed',
      startedAt,
      finishedAt,
      durationMs: null,
      logs,
      error: errorParts.join('; '),
      sandbox,
      preflightBlocked: false,
      importViolations,
      hasCleanDataset,
      networkAccessDetected,
      filesystemAccessDetected,
      dangerousBuiltinsDetected,
    };
  }

  logs.push(`[${finishedAt}] sandbox validation passed — script safe for execution`);
  return {
    status: 'success',
    startedAt,
    finishedAt,
    durationMs,
    logs,
    error: null,
    sandbox,
    preflightBlocked: false,
    importViolations: [],
    hasCleanDataset,
    networkAccessDetected: false,
    filesystemAccessDetected: false,
    dangerousBuiltinsDetected: [],
  };
}
