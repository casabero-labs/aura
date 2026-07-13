import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { sha256hex } from '../contracts/llm/hash';
import { canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
  parsePythonExecutionBundle,
  parsePythonExecutionReceipt,
  validatePythonExecutionBundle,
  validatePythonExecutionChain,
  validatePythonExecutionReceipt,
  type PythonExecutionBundleV1,
} from '../services/remediationExecution/pythonExecutionContract';

const execFile = promisify(execFileCallback);
const NOW = '2026-07-12T12:00:00.000Z';
const SCRIPT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';
const FAILING_SCRIPT = 'def clean_dataset(df):\n    raise RuntimeError("expected failure")\n';
const BEFORE = 'Name\n Alice \n';
const AFTER = 'Name\nAlice\n';
const RUNNER = resolve(process.cwd(), '../experiments/runners/run-aura-remediation.mjs');
const HISTORICAL_RUNNER = resolve(process.cwd(), '../experiments/final-evaluation/run-python-representative.mjs');

const makeBundle = (scriptText = SCRIPT): PythonExecutionBundleV1 => {
  const scriptHashPayload = { scriptText };
  return buildPythonExecutionBundle({
    generatedAt: NOW,
    executionId: 'execution:test',
    approvedScriptHash: sha256hex(canonicalJson(scriptHashPayload)),
    beforeDatasetSha256: sha256hex(BEFORE),
    scriptText,
    scriptHashPayload,
    inputReceiptRef: 'b'.repeat(64),
    evidenceEnvelopeRef: `env:${'c'.repeat(64)}`,
  });
};

const makeSuccessReceipt = (bundle = makeBundle()) => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0',
  runId: bundle.runId, approvedScriptHash: bundle.approvedScriptHash,
  scriptTextSha256: bundle.scriptTextSha256,
  beforeDatasetSha256: bundle.beforeDatasetSha256, afterDatasetSha256: sha256hex(AFTER),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'test',
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: NOW, completedAt: NOW, durationMs: 10,
    stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 1, columnCount: 1 },
});

const runCli = async (
  args: string[],
  runner = RUNNER,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  try {
    const result = await execFile('node', [runner, ...args], { timeout: 30_000 });
    return { exitCode: 0, stdout: String(result.stdout), stderr: String(result.stderr) };
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    return {
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? failure.message),
    };
  }
};

const writeCliFixture = async (dir: string, bundle: PythonExecutionBundleV1, sourceCsv = BEFORE) => {
  const bundlePath = join(dir, 'bundle.json');
  const sourcePath = join(dir, 'source.csv');
  const outputPath = join(dir, 'corrected.csv');
  const receiptPath = join(dir, 'receipt.json');
  await Promise.all([
    writeFile(bundlePath, JSON.stringify(bundle)),
    writeFile(sourcePath, sourceCsv),
  ]);
  return { bundlePath, sourcePath, outputPath, receiptPath };
};

const cliArgs = (paths: Awaited<ReturnType<typeof writeCliFixture>>) => [
  '--bundle', paths.bundlePath,
  '--input', paths.sourcePath,
  '--output', paths.outputPath,
  '--receipt', paths.receiptPath,
];

describe('Python execution contract V1', () => {
  it('builds and parses a deterministic neutral bundle with optional diagnosis references', () => {
    const first = makeBundle();
    const second = makeBundle();
    expect(first).toEqual(second);
    expect(first.executionId).toBe('execution:test');
    expect(first.runId).toBe('execution:test');
    expect(first.inputReceiptRef).toBe('b'.repeat(64));
    expect(first.evidenceEnvelopeRef).toBe(`env:${'c'.repeat(64)}`);
    expect(parsePythonExecutionBundle(JSON.stringify(first))).toEqual(first);
    expect(validatePythonExecutionBundle(first)).toEqual([]);
  });

  it('accepts historical bundles without optional diagnosis references', () => {
    const {
      executionId: _executionId,
      inputReceiptRef: _inputReceiptRef,
      evidenceEnvelopeRef: _evidenceEnvelopeRef,
      ...historical
    } = makeBundle();
    expect(validatePythonExecutionBundle(historical)).toEqual([]);
  });

  it('rejects an empty execution ID, an empty script, and an invalid source SHA-256', () => {
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      executionId: ' ',
      approvedScriptHash: sha256hex(canonicalJson({ scriptText: SCRIPT })),
      beforeDatasetSha256: sha256hex(BEFORE),
      scriptText: SCRIPT,
      scriptHashPayload: { scriptText: SCRIPT },
    })).toThrow('PYTHON_BUNDLE_RUN_ID_REQUIRED');
    const scriptHashPayload = { scriptText: '' };
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      executionId: 'execution:test',
      approvedScriptHash: sha256hex(canonicalJson(scriptHashPayload)),
      beforeDatasetSha256: sha256hex(BEFORE),
      scriptText: '',
      scriptHashPayload,
    })).toThrow('PYTHON_BUNDLE_SCRIPT_REQUIRED');
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      executionId: 'execution:test',
      approvedScriptHash: sha256hex(canonicalJson({ scriptText: SCRIPT })),
      beforeDatasetSha256: 'not-a-sha256',
      scriptText: SCRIPT,
      scriptHashPayload: { scriptText: SCRIPT },
    })).toThrow('PYTHON_BUNDLE_DATASET_HASH_INVALID');
  });

  it('rejects payload, script text, and approved hash inconsistencies', () => {
    const unrelatedPayload = { scriptText: 'def clean_dataset(df):\n    return df\n' };
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      executionId: 'execution:test',
      approvedScriptHash: sha256hex(canonicalJson(unrelatedPayload)),
      beforeDatasetSha256: sha256hex(BEFORE),
      scriptText: SCRIPT,
      scriptHashPayload: unrelatedPayload,
    })).toThrow('PYTHON_BUNDLE_SCRIPT_PAYLOAD_MISMATCH');
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      executionId: 'execution:test',
      approvedScriptHash: 'a'.repeat(64),
      beforeDatasetSha256: sha256hex(BEFORE),
      scriptText: SCRIPT,
      scriptHashPayload: { scriptText: SCRIPT },
    })).toThrow('PYTHON_BUNDLE_APPROVED_HASH_MISMATCH');
  });

  it('validates a complete receipt and evidence chain', () => {
    const bundle = makeBundle();
    const receipt = makeSuccessReceipt(bundle);
    expect(validatePythonExecutionReceipt(receipt, {
      runId: bundle.runId,
      approvedScriptHash: bundle.approvedScriptHash,
      scriptText: bundle.scriptText,
      beforeDatasetSha256: bundle.beforeDatasetSha256,
      afterCsv: AFTER,
    })).toEqual([]);
    expect(validatePythonExecutionChain({
      bundle,
      receipt,
      sourceCsv: BEFORE,
      outputCsv: AFTER,
    })).toEqual([]);
    const encoder = new TextEncoder();
    expect(validatePythonExecutionChain({
      bundle,
      receipt,
      sourceCsv: encoder.encode(BEFORE),
      outputCsv: encoder.encode(AFTER),
    })).toEqual([]);
  });

  it('validates an honest failure receipt without certifying output', () => {
    const bundle = makeBundle(FAILING_SCRIPT);
    const receipt = buildPythonExecutionReceipt({
      contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0',
      runId: bundle.runId, approvedScriptHash: bundle.approvedScriptHash,
      scriptTextSha256: bundle.scriptTextSha256,
      beforeDatasetSha256: bundle.beforeDatasetSha256, afterDatasetSha256: null,
      pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'test',
      syntax: { status: 'passed', error: null },
      execution: {
        status: 'failed', startedAt: NOW, completedAt: NOW, durationMs: 10,
        stdoutSha256: sha256hex(''), stderrSha256: sha256hex('trace'), error: 'Python execution failed.',
      },
      output: null,
    });
    expect(validatePythonExecutionChain({
      bundle,
      receipt,
      sourceCsv: BEFORE,
      outputCsv: null,
    })).toEqual([]);
  });

  it('rejects altered output bytes', () => {
    const bundle = makeBundle();
    const errors = validatePythonExecutionChain({
      bundle,
      receipt: makeSuccessReceipt(bundle),
      sourceCsv: BEFORE,
      outputCsv: 'Name\nMallory\n',
    });
    expect(errors).toContain('output CSV hash mismatch');
  });

  it('rejects altered receipt fields', () => {
    const bundle = makeBundle();
    const receipt = { ...makeSuccessReceipt(bundle), pythonVersion: 'tampered' };
    expect(validatePythonExecutionChain({ bundle, receipt, sourceCsv: BEFORE, outputCsv: AFTER }))
      .toContain('receipt hash is invalid');
  });

  it('rejects malformed JSON instead of repairing it', () => {
    expect(() => parsePythonExecutionReceipt('```json\n{}\n```')).toThrow('PYTHON_RECEIPT_JSON_INVALID');
    expect(() => parsePythonExecutionBundle('[]')).toThrow('PYTHON_BUNDLE_OBJECT_REQUIRED');
  });
});

describe('neutral Python remediation CLI', () => {
  it('prints usage with exit 0 for both CLIs and exit 2 when arguments are missing', async () => {
    const help = await runCli(['--help']);
    const historicalHelp = await runCli(['--help'], HISTORICAL_RUNNER);
    const missing = await runCli([]);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain('run-aura-remediation.mjs');
    expect(historicalHelp.exitCode).toBe(0);
    expect(historicalHelp.stdout).toContain('run-python-representative.mjs');
    expect(missing.exitCode).toBe(2);
  });

  it('executes the approved script locally without modifying the source', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-python-core-success-'));
    try {
      const bundle = makeBundle();
      const paths = await writeCliFixture(dir, bundle);
      const result = await runCli(cliArgs(paths));
      expect(result.exitCode).toBe(0);
      const [sourceCsv, outputCsv, receiptText] = await Promise.all([
        readFile(paths.sourcePath, 'utf8'),
        readFile(paths.outputPath, 'utf8'),
        readFile(paths.receiptPath, 'utf8'),
      ]);
      expect(sourceCsv).toBe(BEFORE);
      expect(outputCsv).toBe(AFTER);
      expect(validatePythonExecutionChain({
        bundle,
        receipt: parsePythonExecutionReceipt(receiptText),
        sourceCsv,
        outputCsv,
      })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);

  it('removes an uncertified output when the receipt cannot be written', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-python-core-receipt-failure-'));
    try {
      const bundle = makeBundle();
      const paths = await writeCliFixture(dir, bundle);
      const unwritableReceiptPath = join(dir, 'missing', 'receipt.json');
      const result = await runCli(cliArgs({ ...paths, receiptPath: unwritableReceiptPath }));
      expect(result.exitCode).toBe(1);
      expect(await readFile(paths.sourcePath, 'utf8')).toBe(BEFORE);
      await expect(access(paths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(access(unwritableReceiptPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);

  it('rejects colliding bundle and source paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-python-core-paths-'));
    try {
      const paths = await writeCliFixture(dir, makeBundle());
      const result = await runCli([
        '--bundle', paths.bundlePath,
        '--input', paths.bundlePath,
        '--output', paths.outputPath,
        '--receipt', paths.receiptPath,
      ]);
      expect(result.exitCode).toBe(1);
      await expect(access(paths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects tampered bundle and source bytes before execution', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-python-core-tamper-'));
    try {
      const bundle = makeBundle();
      const tamperedBundle = { ...bundle, scriptText: `${bundle.scriptText}\n` };
      const bundlePaths = await writeCliFixture(join(dir), tamperedBundle);
      const bundleResult = await runCli(cliArgs(bundlePaths));
      expect(bundleResult.exitCode).toBe(1);
      await expect(access(bundlePaths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
      const sourcePaths = await writeCliFixture(join(dir), bundle, 'Name\nMallory\n');
      const sourceResult = await runCli(cliArgs(sourcePaths));
      expect(sourceResult.exitCode).toBe(1);
      await expect(access(sourcePaths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('removes stale output and emits a verifiable failure receipt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-python-core-failure-'));
    try {
      const bundle = makeBundle(FAILING_SCRIPT);
      const paths = await writeCliFixture(dir, bundle);
      await writeFile(paths.outputPath, 'stale output');
      const result = await runCli(cliArgs(paths));
      expect(result.exitCode).toBe(1);
      expect(await readFile(paths.sourcePath, 'utf8')).toBe(BEFORE);
      await expect(access(paths.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
      const receiptText = await readFile(paths.receiptPath, 'utf8');
      const receipt = parsePythonExecutionReceipt(receiptText);
      expect(receipt.execution.status).toBe('failed');
      expect(receipt.execution.error).toBe('Python execution failed.');
      expect(receiptText).not.toContain('expected failure');
      expect(validatePythonExecutionChain({
        bundle,
        receipt,
        sourceCsv: BEFORE,
        outputCsv: null,
      })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);
});
