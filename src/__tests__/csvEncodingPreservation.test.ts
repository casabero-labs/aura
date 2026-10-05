// Regression: "Preservar 001, 120.00, vacíos y acentos" across upload,
// re-audit, verification and the Python runner (encoding, BOM, delimiter,
// line endings and admission rules).
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../contracts/llm/diagnosisPromptV2';
import { sha256hex } from '../contracts/llm/hash';
import { decodeCsvBytes, encodeCsvText } from '../services/csvEncoding.mjs';
import { parseCsv } from '../services/csvService';
import { buildAuditEvidence, computeBytesSha256, computeFileSha256 } from '../services/executionEvidence';
import { parseCsvString, runReaudit } from '../services/reauditService';
import { runAudit } from '../services/auditEngine';
import {
  buildPythonExecutionBundle,
  parsePythonExecutionReceipt,
  validatePythonExecutionChain,
} from '../services/remediationExecution/pythonExecutionContract';
import { buildRemediationVerificationWithReaudit } from '../services/remediationExecution/remediationVerification';

const nodeSha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const latin1 = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
const utf8 = (text: string) => new TextEncoder().encode(text);
const BOM = [0xef, 0xbb, 0xbf];
const withBom = (bytes: Uint8Array) => new Uint8Array([...BOM, ...bytes]);
const csvFile = (bytes: Uint8Array, name = 'fuente.csv') => new File([bytes], name, { type: 'text/csv' });

const LATIN1_TEXT = 'ciudad;nombre;codigo\r\n"Bogotá, Ñandú"; Ana ;001\r\nMedellín;José;120.00\r\nCali;;007\r\n';
const LATIN1_BYTES = latin1(LATIN1_TEXT);

describe('encoding at upload', () => {
  it('decodes a Latin-1 file as windows-1252 with accents intact, never U+FFFD', async () => {
    const parsed = await parseCsv(csvFile(LATIN1_BYTES));
    expect(parsed.source.encoding).toBe('windows-1252');
    expect(parsed.source.bom).toBe(false);
    expect(parsed.meta.delimiter).toBe(';');
    expect(parsed.meta.fields).toEqual(['ciudad', 'nombre', 'codigo']);
    expect(parsed.data[0]).toEqual({ ciudad: 'Bogotá, Ñandú', nombre: ' Ana ', codigo: '001' });
    expect(parsed.data[1]).toEqual({ ciudad: 'Medellín', nombre: 'José', codigo: '120.00' });
    expect(parsed.data[2].nombre).toBe('');
    expect(JSON.stringify(parsed.data)).not.toContain('\uFFFD');
  });

  it('keeps SHA-256 over the original bytes, not over decoded or re-encoded text', async () => {
    const parsed = await parseCsv(csvFile(LATIN1_BYTES));
    const expected = nodeSha(LATIN1_BYTES);
    expect(await computeBytesSha256(parsed.source.bytes)).toBe(expected);
    expect(await computeFileSha256(csvFile(LATIN1_BYTES))).toBe(expected);
    expect(expected).not.toBe(nodeSha(utf8(LATIN1_TEXT)));
  });

  it('strips and records a UTF-8 BOM; the hash still covers the BOM bytes', async () => {
    const bytes = withBom(utf8('id,nombre\n001,Ñandú\n'));
    const parsed = await parseCsv(csvFile(bytes));
    expect(parsed.source).toMatchObject({ encoding: 'utf-8', bom: true });
    expect(parsed.meta.fields).toEqual(['id', 'nombre']);
    expect(parsed.data[0]).toEqual({ id: '001', nombre: 'Ñandú' });
    expect(await computeBytesSha256(parsed.source.bytes)).toBe(nodeSha(bytes));
  });

  it('prefers strict UTF-8 and rejects UTF-16 instead of producing mojibake', async () => {
    expect(decodeCsvBytes(utf8('a\nBogotá\n'))).toEqual({ text: 'a\nBogotá\n', encoding: 'utf-8', bom: false });
    await expect(parseCsv(csvFile(new Uint8Array([0xff, 0xfe, 0x61, 0x00])))).rejects.toThrow('No se pudo auditar');
    expect(() => decodeCsvBytes(LATIN1_BYTES, 'utf-8')).toThrow('CSV_ENCODING_INVALID');
  });

  it('records the detected encoding in audit evidence', async () => {
    const parsed = await parseCsv(csvFile(LATIN1_BYTES));
    const report = runAudit(parsed.data, parsed.meta.fields, parsed.meta.delimiter);
    const evidence = buildAuditEvidence({
      datasetFingerprint: 'fp', datasetSha256: nodeSha(LATIN1_BYTES),
      startedAt: '2026-10-05T00:00:00.000Z', completedAt: '2026-10-05T00:00:01.000Z',
      parseDurationMs: 1, auditDurationMs: 1, rowsProcessed: parsed.data.length,
      columnsProcessed: parsed.meta.fields.length, delimiter: parsed.meta.delimiter,
      encoding: parsed.source.encoding, bom: parsed.source.bom,
      truncated: false, ingestionStatus: 'success', report, trace: [],
    });
    expect(evidence).toMatchObject({ encoding: 'windows-1252', bom: false, datasetSha256: nodeSha(LATIN1_BYTES) });
  });

  it('round-trips windows-1252 exactly and fails closed on unrepresentable characters', () => {
    expect(encodeCsvText(decodeCsvBytes(LATIN1_BYTES).text, 'windows-1252')).toEqual(LATIN1_BYTES);
    expect(() => encodeCsvText('→', 'windows-1252')).toThrow('CSV_ENCODING_UNREPRESENTABLE');
  });
});

describe('re-audit admission matches upload', () => {
  it.each([
    ['missing field', 'id,nombre\n001,Ana\n002\n'],
    ['extra field', 'id,nombre\n001,Ana\n002,José,extra\n'],
    ['unterminated quote', 'id,nombre\n001,"Ana\n'],
    ['duplicate header', 'id,id\n001,002\n'],
  ])('rejects a %s in both paths with the same rule', async (_name, csv) => {
    let uploadMessage = '';
    try { await parseCsv(csvFile(utf8(csv))); } catch (error) { uploadMessage = (error as Error).message; }
    expect(uploadMessage).toContain('No se pudo auditar');
    expect(() => parseCsvString(csv)).toThrow('CSV_PARSE_FAILED');
    expect(() => parseCsvString(csv)).toThrow(uploadMessage);
    expect(() => runReaudit('id,nombre\n001,Ana\n', csv, 'env:x')).toThrow(uploadMessage);
  });
});

const SCRIPT = 'def clean_dataset(df):\n    df_clean = df.copy()\n    df_clean["nombre"] = df_clean["nombre"].str.strip()\n    return df_clean\n';
const ENVELOPE_REF = `env:${'c'.repeat(64)}`;

const makeBundle = (source: Uint8Array, scriptText = SCRIPT, columnRefs: unknown[] = [{ position: 1, name: 'nombre' }]) => {
  const scriptHashPayload = { scriptText, columnRefs, acceptedActionIds: ['trim'], rendererVersion: '2.0.0' };
  return buildPythonExecutionBundle({
    generatedAt: '2026-10-05T12:00:00.000Z', runId: 'exec:encoding',
    approvedScriptHash: sha256hex(canonicalJson(scriptHashPayload)),
    beforeDatasetSha256: nodeSha(source), scriptText, scriptHashPayload,
    inputReceiptRef: 'b'.repeat(64), evidenceEnvelopeRef: ENVELOPE_REF,
  });
};

const runRunner = async (source: Uint8Array, bundle: object) => {
  const dir = await mkdtemp(join(tmpdir(), 'aura-encoding-'));
  try {
    await writeFile(join(dir, 'bundle.json'), JSON.stringify(bundle));
    await writeFile(join(dir, 'source.csv'), source);
    let exitCode = 0;
    try {
      await promisify(execFile)('node', [resolve('../experiments/runners/run-aura-remediation.mjs'),
        '--bundle', join(dir, 'bundle.json'), '--input', join(dir, 'source.csv'),
        '--output', join(dir, 'corrected.csv'), '--receipt', join(dir, 'receipt.json')], { timeout: 30000 });
    } catch { exitCode = 1; }
    const receipt = parsePythonExecutionReceipt(await readFile(join(dir, 'receipt.json'), 'utf8'));
    const output = await readFile(join(dir, 'corrected.csv')).then(b => new Uint8Array(b)).catch(() => null);
    expect(new Uint8Array(await readFile(join(dir, 'source.csv')))).toEqual(source);
    return { exitCode, receipt, output };
  } finally { await rm(dir, { recursive: true, force: true }); }
};

describe('runner writes the corrected copy in the source dialect', () => {
  it('keeps windows-1252, ";" and CRLF, and verification re-audits with the same encoding', async () => {
    const bundle = makeBundle(LATIN1_BYTES);
    const { exitCode, receipt, output } = await runRunner(LATIN1_BYTES, bundle);
    expect(exitCode).toBe(0);
    expect(output).toEqual(latin1('ciudad;nombre;codigo\r\nBogotá, Ñandú;Ana;001\r\nMedellín;José;120.00\r\nCali;;007\r\n'));
    expect(receipt.afterDatasetSha256).toBe(nodeSha(output!));
    expect(validatePythonExecutionChain({ bundle, receipt, sourceCsv: LATIN1_BYTES, outputCsv: output })).toEqual([]);

    const { result, reaudit } = buildRemediationVerificationWithReaudit({
      bundle, receipt, sourceCsv: LATIN1_BYTES, correctedCsv: output!, evidenceEnvelopeRef: ENVELOPE_REF,
      sourceEncoding: 'windows-1252',
    });
    expect(result.sourceDatasetSha256).toBe(nodeSha(LATIN1_BYTES));
    expect(reaudit.beforeOutput.delimiter).toBe(';');
    expect(reaudit.afterOutput.delimiter).toBe(';');
    expect(reaudit.afterOutput.data[0]).toEqual({ ciudad: 'Bogotá, Ñandú', nombre: 'Ana', codigo: '001' });
    expect(reaudit.afterOutput.data[1].codigo).toBe('120.00');
    expect(reaudit.output.changedCellsEstimate).toBe(1);
  }, 40000);

  it('re-emits a UTF-8 BOM and comma/LF so an identity script reproduces the source bytes', async () => {
    const source = withBom(utf8('id,nombre\n001,Ñandú\n002,\n'));
    const identity = 'def clean_dataset(df):\n    df_clean = df.copy()\n    return df_clean\n';
    const { exitCode, output } = await runRunner(source, makeBundle(source, identity, []));
    expect(exitCode).toBe(0);
    expect(output).toEqual(source);
  }, 40000);

  it('fails closed when the result cannot be written in the source encoding', async () => {
    const arrow = 'def clean_dataset(df):\n    df_clean = df.copy()\n    df_clean["nombre"] = "\\u2192"\n    return df_clean\n';
    const { exitCode, receipt, output } = await runRunner(LATIN1_BYTES, makeBundle(LATIN1_BYTES, arrow));
    expect(exitCode).toBe(1);
    expect(receipt.execution.error).toContain('ENCODING_FAILED');
    expect(output).toBeNull();
  }, 40000);
});
