import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as privacyReceiptModule from '../services/privacyReceipt';
import { buildDiagnosisPrivacyReceipt } from '../services/privacyReceipt';
import type { DiagnosisExecutionResult, DiagnosisFailureEvidenceV2, ExecutionReceiptV1 } from '../contracts/llm';
import type { NetworkGuardResult } from '../services/networkGuard';

const DATASET_SHA = 'a'.repeat(64);
const PROMPT_HASH = 'b'.repeat(64);
const SECRET_CELL = 'ana.secreta@example.com';

const executionReceipt = (overrides: Partial<ExecutionReceiptV1> = {}): ExecutionReceiptV1 => ({
  contractId: 'aura.execution-receipt.v1',
  contractVersion: '1.0.0',
  requestedInputMode: 'smart_sample',
  effectiveInputMode: 'smart_sample',
  includedSections: ['dataset_summary', 'dataset_schema', 'evidence_samples'],
  evidenceEnvelopeRef: 'env-1',
  promptVersion: 'diagnosis-v2',
  promptHash: PROMPT_HASH,
  inputHash: 'c'.repeat(64),
  responseSchemaHash: 'd'.repeat(64),
  provider: 'Chrome AI',
  requestedModel: 'gemini-nano',
  observedModel: 'gemini-nano',
  modelDigest: null,
  inferenceHash: 'e'.repeat(64),
  startedAt: '2026-10-05T10:00:00.000Z',
  completedAt: '2026-10-05T10:00:05.000Z',
  rawResponseHash: 'f'.repeat(64),
  validationStatus: 'valid',
  validationErrorCodes: [],
  receiptHash: '1'.repeat(64),
  ...overrides,
} as ExecutionReceiptV1);

const diagnosis = (receipt: ExecutionReceiptV1): DiagnosisExecutionResult => ({
  version: 2,
  diagnosis: {} as DiagnosisExecutionResult['diagnosis'],
  metrics: { latencyMs: 5000, tokensGenerated: 100, model: 'gemini-nano', provider: 'Chrome AI', isLocal: true },
  promptHash: receipt.promptHash,
  evidenceEnvelopeRef: receipt.evidenceEnvelopeRef,
  promptVersion: receipt.promptVersion,
  rawResponseHash: receipt.rawResponseHash,
  executionReceipt: receipt,
} as DiagnosisExecutionResult);

const auditEvidence = {
  datasetSha256: DATASET_SHA,
  datasetFingerprint: 'fp-891x12',
  rowsProcessed: 891,
  columnsProcessed: 12,
  truncated: false,
};

const network: NetworkGuardResult = {
  requests: [],
  externalRequests: [],
  auraRequests: [],
  totalRequests: 0,
};

describe('DiagnosisPrivacyReceiptV2', () => {
  it('describes the real dataset and the exact prompt hash, never placeholders', () => {
    const receipt = buildDiagnosisPrivacyReceipt({
      providerType: 'chrome',
      providerLabel: 'Chrome AI / Gemini Nano',
      requestedModel: 'gemini-nano',
      report: { rowCount: 891, colCount: 12 },
      auditEvidence,
      diagnosis: diagnosis(executionReceipt()),
      networkResult: network,
    });

    expect(receipt.contractId).toBe('aura.privacy-receipt.v2');
    expect(receipt.dataset).toMatchObject({ sha256: DATASET_SHA, rows: 891, columns: 12, source: 'audit_evidence' });
    expect(receipt.sent?.promptHash).toBe(PROMPT_HASH);
    expect(receipt.sent?.requests).toEqual([{ issueId: null, promptHash: PROMPT_HASH, rawResponseHash: 'f'.repeat(64) }]);
    expect(receipt.sent?.rawRowsSent).toBe(false);
    expect(receipt.sent?.includesRedactedSampleValues).toBe(true);
    expect(receipt.network).toMatchObject({ monitored: true, outboundRequestsFromAura: 0 });
    expect(receipt.provider).toMatchObject({ type: 'chrome', onDevice: true, observedModel: 'gemini-nano' });
    expect(receipt.unknowns).toEqual([]);

    const json = JSON.stringify(receipt);
    expect(json).not.toMatch(/placeholder/i);
    expect(json).not.toContain(SECRET_CELL);
  });

  it('lists one hash per request for fragmented Gemini Nano runs', () => {
    const receipt = buildDiagnosisPrivacyReceipt({
      providerType: 'chrome',
      providerLabel: 'Chrome AI / Gemini Nano',
      report: { rowCount: 891, colCount: 12 },
      auditEvidence,
      diagnosis: diagnosis(executionReceipt({
        fragmentedExecution: {
          strategy: 'per_issue',
          requestCount: 2,
          systemInstructionHash: '9'.repeat(64),
          fragments: [
            { issueId: 'issue-1', promptHash: '2'.repeat(64), rawResponseHash: '3'.repeat(64), attempts: 1 },
            { issueId: 'issue-2', promptHash: '4'.repeat(64), rawResponseHash: '5'.repeat(64), attempts: 2 },
          ],
        },
      })),
      networkResult: network,
    });

    expect(receipt.sent?.requestCount).toBe(2);
    expect(receipt.sent?.promptHash).toBe(PROMPT_HASH);
    expect(receipt.sent?.requests.map((r) => [r.issueId, r.promptHash])).toEqual([
      ['issue-1', '2'.repeat(64)],
      ['issue-2', '4'.repeat(64)],
    ]);
  });

  it('says explicitly what it cannot know instead of inventing it', () => {
    const receipt = buildDiagnosisPrivacyReceipt({
      providerType: 'ollama',
      providerLabel: 'Ollama local',
      report: { rowCount: 10, colCount: 3 },
      auditEvidence: null,
      diagnosis: null,
      failure: null,
      networkResult: null,
    });

    expect(receipt.outcome).toBe('failed');
    expect(receipt.dataset).toMatchObject({ sha256: null, rows: 10, columns: 3, source: 'report', truncated: null });
    expect(receipt.sent).toBeNull();
    expect(receipt.network).toEqual({ monitored: false, reason: 'La vigilancia de red solo se activa con Chrome AI.' });
    expect(receipt.unknowns.join(' ')).toMatch(/SHA-256/);
    expect(receipt.unknowns.join(' ')).toMatch(/Contenido enviado/);
    expect(receipt.unknowns.join(' ')).toMatch(/Conexiones de red/);
  });

  it('a failed run with evidence still certifies what was sent', () => {
    const receipt = buildDiagnosisPrivacyReceipt({
      providerType: 'chrome',
      providerLabel: 'Chrome AI / Gemini Nano',
      report: { rowCount: 891, colCount: 12 },
      auditEvidence,
      failure: {
        contractId: 'aura.diagnosis-failure-evidence.v2',
        code: 'DIAGNOSIS_SCHEMA_INVALID',
        message: 'invalid',
        path: '$',
        inputSnapshot: {} as DiagnosisFailureEvidenceV2['inputSnapshot'],
        executionReceipt: executionReceipt({ validationStatus: 'invalid' }),
        rawResponseHash: 'f'.repeat(64),
      },
      networkResult: network,
    });
    expect(receipt.outcome).toBe('failed');
    expect(receipt.sent?.promptHash).toBe(PROMPT_HASH);
    expect(receipt.dataset.sha256).toBe(DATASET_SHA);
  });

  it('the placeholder receipt helper is gone and DiagnosisStep builds the receipt from the run', () => {
    expect('generateQuickReceipt' in privacyReceiptModule).toBe(false);
    const source = readFileSync(resolve(__dirname, '../components/DiagnosisStep.tsx'), 'utf8');
    expect(source).not.toMatch(/\[\['placeholder'\]\]|placeholderData|placeholderColumns/);
    expect(source).toMatch(/buildDiagnosisPrivacyReceipt\(\{[\s\S]*auditEvidence,[\s\S]*networkResult: observedNetwork/);
  });
});
