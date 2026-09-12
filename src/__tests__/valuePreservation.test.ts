import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../contracts/llm/hash';
import { buildPythonExecutionBundle, parsePythonExecutionReceipt, validatePythonExecutionChain } from '../services/remediationExecution/pythonExecutionContract';
import { parseCsvString } from '../services/reauditService';
import { runAudit } from '../services/auditEngine';

const SOURCE = 'id;amount;code;flag\n001;120;NA;false\n001;120;NA;false\n002;120.00;;TRUE\n003;-12.50;null;false\n';
const SCRIPT = 'def clean_dataset(df):\n    df_clean = df.copy()\n    df_clean = df_clean.drop_duplicates(keep="first").copy()\n    return df_clean\n';
const makeBundle = (scriptText = SCRIPT) => {
  const scriptHashPayload = { scriptText, columnRefs: [], acceptedActionIds: ['dedup'], rendererVersion: '2.0.0' };
  return buildPythonExecutionBundle({
    generatedAt: '2026-09-10T12:00:00.000Z', runId: 'exec:preservation',
    approvedScriptHash: sha256hex(canonicalJson(scriptHashPayload)),
    beforeDatasetSha256: sha256hex(SOURCE), scriptText, scriptHashPayload,
  });
};

describe('UX-08 value preservation', () => {
  it('keeps CSV values lexical while numeric audit remains available', () => {
    const parsed = parseCsvString(SOURCE);
    expect(parsed.data[0]).toEqual({ id: '001', amount: '120', code: 'NA', flag: 'false' });
    expect(parsed.data[2].amount).toBe('120.00');
    const report = runAudit(parsed.data, parsed.fields, parsed.delimiter);
    expect(report.columnStats.amount.inferredType).toBe('number');
    expect(report.columnStats.amount.min).toBe(-12.5);
    expect(parsed.data[0].id).toBe('001');
    const different = parseCsvString('id,amount\n001,120\n1,120\n001,120.00\n');
    expect(runAudit(different.data, different.fields, ',').duplicateRows).toBe(0);
  });

  it.each([
    ['deduplication', SCRIPT, true],
    ['unapproved identifier conversion', SCRIPT.replace('    return df_clean', '    df_clean["id"] = df_clean["id"].astype(int)\n    return df_clean'), false],
    ['unapproved unique row removal', SCRIPT.replace('    return df_clean', '    df_clean = df_clean.iloc[1:]\n    return df_clean'), false],
  ])('checks %s in real Python and when importing the receipt', async (_name, script, passes) => {
    const dir = await mkdtemp(join(tmpdir(), 'aura-ux08-'));
    try {
      const bundle = makeBundle(script);
      await writeFile(join(dir, 'bundle.json'), JSON.stringify(bundle));
      await writeFile(join(dir, 'source.csv'), SOURCE);
      let exitCode = 0;
      try {
        await promisify(execFile)('node', [resolve('../experiments/runners/run-aura-remediation.mjs'),
          '--bundle', join(dir, 'bundle.json'), '--input', join(dir, 'source.csv'),
          '--output', join(dir, 'corrected.csv'), '--receipt', join(dir, 'receipt.json')], { timeout: 30000 });
      } catch { exitCode = 1; }
      expect(exitCode).toBe(passes ? 0 : 1);
      expect(await readFile(join(dir, 'source.csv'), 'utf8')).toBe(SOURCE);
      const receipt = parsePythonExecutionReceipt(await readFile(join(dir, 'receipt.json'), 'utf8'));
      if (passes) {
        const output = await readFile(join(dir, 'corrected.csv'), 'utf8');
        expect(output).toBe('id,amount,code,flag\n001,120,NA,false\n002,120.00,,TRUE\n003,-12.50,null,false\n');
        expect(validatePythonExecutionChain({ bundle, receipt, sourceCsv: SOURCE, outputCsv: output })).toEqual([]);
        // A valid, self-consistent receipt cannot hide changed protected values.
        const damaged = output.replace('001,', '1,');
        const { buildPythonExecutionReceipt } = await import('../services/remediationExecution/pythonExecutionContract');
        const { receiptHash: _hash, ...payload } = receipt;
        const changedReceipt = buildPythonExecutionReceipt({ ...payload, afterDatasetSha256: sha256hex(damaged) });
        expect(validatePythonExecutionChain({ bundle, receipt: changedReceipt, sourceCsv: SOURCE, outputCsv: damaged }).join(' ')).toContain('PRESERVATION');
      } else {
        expect(receipt.execution.status).toBe('failed');
        await expect(readFile(join(dir, 'corrected.csv'))).rejects.toThrow();
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 40000);
});
