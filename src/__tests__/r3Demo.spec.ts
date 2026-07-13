// Demo runner for R3 verification — builds a real bundle, runs the runner, validates output.
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { buildPythonExecutionBundle, validatePythonExecutionChain } from '../services/remediationExecution/pythonExecutionContract';
import { sha256hex } from '../contracts/llm/hash';

const execFile = promisify(execFileCallback);

const SCRIPT_TEXT = 'import pandas as pd\n\ndef clean_dataset(df):\n    df["Name"] = df["Name"].str.strip()\n    return df\n';

describe('R3 demo: real runner with local fixture', () => {
  it('produces a verifiable receipt from end-to-end runner execution', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-r3-demo-'));
    try {
      const beforeCsv = 'PassengerId,Name\n1," Braund, Mr. Owen Harris "\n2," Cumings, Mrs. John Bradley "\n';
      const sourcePath = join(dir, 'source.csv');
      await writeFile(sourcePath, beforeCsv);
      const fingerprint = sha256hex(beforeCsv);
      const scriptHash = sha256hex(JSON.stringify({ scriptText: SCRIPT_TEXT }));
      const bundle = buildPythonExecutionBundle({
        generatedAt: '2026-07-12T12:05:00.000Z',
        executionId: 'run:r3-demo',
        approvedScriptHash: scriptHash,
        beforeDatasetSha256: fingerprint,
        scriptText: SCRIPT_TEXT,
        scriptHashPayload: { scriptText: SCRIPT_TEXT },
        inputReceiptRef: 'b'.repeat(64),
        evidenceEnvelopeRef: 'env:' + 'c'.repeat(64),
      });
      const bundlePath = join(dir, 'execution-bundle.json');
      const outputPath = join(dir, 'corrected.csv');
      const receiptPath = join(dir, 'receipt.json');
      await writeFile(bundlePath, JSON.stringify(bundle, null, 2));

      const runner = resolve(process.cwd(), '../experiments/runners/run-aura-remediation.mjs');
      const result = await execFile('node', [
        runner,
        '--bundle', bundlePath,
        '--input', sourcePath,
        '--output', outputPath,
        '--receipt', receiptPath,
      ], { timeout: 30_000 });
      expect(result.stdout).toMatch(/OK receipt\.json [a-f0-9]+/);

      const afterCsv = await readFile(outputPath, 'utf8');
      const receiptText = await readFile(receiptPath, 'utf8');
      const receipt = JSON.parse(receiptText);
      expect(receipt.contractId).toBe('aura.python-execution-receipt.v1');
      const afterBuf = new Uint8Array(Buffer.from(afterCsv, 'utf8'));
      const sourceBuf = new Uint8Array(Buffer.from(beforeCsv, 'utf8'));

      const errors = validatePythonExecutionChain({ bundle, receipt, sourceCsv: sourceBuf, outputCsv: afterBuf });
      expect(errors).toEqual([]);
      expect(receipt.syntax.status).toBe('passed');
      expect(receipt.execution.status).toBe('passed');
      expect(afterCsv.trim()).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});