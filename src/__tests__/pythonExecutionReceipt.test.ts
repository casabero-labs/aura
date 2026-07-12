import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { sha256hex } from '../contracts/llm/hash';
import { canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import {
  buildPythonExecutionBundle,
  buildPythonExecutionReceipt,
  parsePythonExecutionReceipt,
  validatePythonExecutionReceipt,
} from '../services/benchmark/pythonExecutionReceipt';

const execFile = promisify(execFileCallback);
const NOW = '2026-07-12T12:00:00.000Z';
const SCRIPT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';
const BEFORE = 'Name\n Alice \n';
const AFTER = 'Name\nAlice\n';

const makeReceipt = () => buildPythonExecutionReceipt({
  contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0',
  runId: 'run:test', approvedScriptHash: 'a'.repeat(64), scriptTextSha256: sha256hex(SCRIPT),
  beforeDatasetSha256: sha256hex(BEFORE), afterDatasetSha256: sha256hex(AFTER),
  pythonVersion: '3.12.1', pandasVersion: '2.2.0', platform: 'test',
  syntax: { status: 'passed', error: null },
  execution: {
    status: 'passed', startedAt: NOW, completedAt: NOW, durationMs: 10,
    stdoutSha256: sha256hex(''), stderrSha256: sha256hex(''), error: null,
  },
  output: { rowCount: 1, columnCount: 1 },
});

describe('Python execution receipt V1', () => {
  it('validates a complete receipt against script and CSV bytes', () => {
    const errors = validatePythonExecutionReceipt(makeReceipt(), {
      runId: 'run:test', approvedScriptHash: 'a'.repeat(64), scriptText: SCRIPT,
      beforeDatasetSha256: sha256hex(BEFORE), afterCsv: AFTER,
    });
    expect(errors).toEqual([]);
  });

  it('rejects altered receipt fields and an unrelated output CSV', () => {
    const receipt = { ...makeReceipt(), pythonVersion: 'tampered' };
    const errors = validatePythonExecutionReceipt(receipt, {
      runId: 'run:test', approvedScriptHash: 'a'.repeat(64), scriptText: SCRIPT,
      beforeDatasetSha256: sha256hex(BEFORE), afterCsv: 'Name\nMallory\n',
    });
    expect(errors).toEqual(expect.arrayContaining(['receipt hash is invalid', 'output CSV hash mismatch']));
  });

  it('rejects malformed JSON instead of repairing it', () => {
    expect(() => parsePythonExecutionReceipt('```json\n{}\n```')).toThrow('PYTHON_RECEIPT_JSON_INVALID');
  });

  it('refuses a bundle whose approved contract hash does not cover the script', () => {
    expect(() => buildPythonExecutionBundle({
      generatedAt: NOW,
      runId: 'run:test',
      approvedScriptHash: 'a'.repeat(64),
      beforeDatasetSha256: sha256hex(BEFORE),
      scriptText: SCRIPT,
      scriptHashPayload: { scriptText: SCRIPT },
    })).toThrow('PYTHON_BUNDLE_APPROVED_HASH_MISMATCH');
  });

  it('executes the approved script locally and emits a verifiable receipt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-p1-03-test-'));
    try {
      const bundlePath = join(dir, 'bundle.json');
      const beforePath = join(dir, 'before.csv');
      const afterPath = join(dir, 'after.csv');
      const receiptPath = join(dir, 'receipt.json');
      const scriptHashPayload = { scriptText: SCRIPT };
      const approvedScriptHash = sha256hex(canonicalJson(scriptHashPayload));
      const bundle = buildPythonExecutionBundle({
        generatedAt: NOW, runId: 'run:test', approvedScriptHash,
        beforeDatasetSha256: sha256hex(BEFORE), scriptText: SCRIPT, scriptHashPayload,
      });
      await Promise.all([
        writeFile(bundlePath, JSON.stringify(bundle)),
        writeFile(beforePath, BEFORE),
      ]);
      await execFile('node', [
        resolve(process.cwd(), '../experiments/final-evaluation/run-python-representative.mjs'),
        '--bundle', bundlePath, '--input', beforePath, '--output', afterPath, '--receipt', receiptPath,
      ], { timeout: 30_000 });
      const [afterCsv, receiptText] = await Promise.all([
        readFile(afterPath, 'utf8'), readFile(receiptPath, 'utf8'),
      ]);
      const receipt = parsePythonExecutionReceipt(receiptText);
      expect(afterCsv).toBe(AFTER);
      expect(validatePythonExecutionReceipt(receipt, {
        runId: 'run:test', approvedScriptHash, scriptText: SCRIPT,
        beforeDatasetSha256: sha256hex(BEFORE), afterCsv,
      })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 40_000);
});
