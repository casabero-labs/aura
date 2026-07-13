/**
 * Diagnosis v1/v2 Integration Tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

process.env.CONTRACTS_V2_ENABLED = 'true';

// Set import.meta.env for vitest (needed by buildEvidenceEnvelopeV2)
(import.meta as any).env = { ...((import.meta as any).env || {}), VITE_CONTRACTS_V2_ENABLED: 'true' };

vi.mock('../contracts/llm/contractRegistry', () => ({ isContractsV2Enabled: vi.fn() }));

import { runStructuredDiagnosis } from '../contracts/llm';
import { isContractsV2Enabled } from '../contracts/llm/contractRegistry';
import { _buildEvidenceEnvelopeV2 } from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisPromptV2 } from '../contracts/llm/diagnosisPromptV2';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { AIProvider } from '../types';

function makeProvider(type: AIProvider['type'] = 'cloud'): AIProvider {
  const p: AIProvider = {
    name: type === 'cloud' ? 'Google Gemini' : type === 'ollama' ? 'Ollama' : 'WebLLM',
    type,
    analyzeStream: vi.fn().mockResolvedValue({ latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false }),
    generateExecutiveReport: vi.fn().mockResolvedValue({ content: { title: '', domain_inferred: '', dataset_technical_description: '', executive_summary: '', business_impact: '', key_findings: [], recommendations: [] }, metrics: { latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false } }),
    generateExecutiveReportStream: vi.fn().mockResolvedValue({ content: { title: '', domain_inferred: '', dataset_technical_description: '', executive_summary: '', business_impact: '', key_findings: [], recommendations: [] }, metrics: { latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false } }),
    generateText: vi.fn(),
    generateTextWithProgress: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
  return p;
}

const minimalReport: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma', description: 'whitespace padding', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund, Mr. Owen Harris'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' } },
    { id: 'integrity-null-Age', column: 'Age', category: 'Integridad', ruleName: 'Valores Nulos', description: 'nulls in Age', severity: 'warning', count: 177, affectedPercentage: 19.9, sampleValues: [null, 22, 38], ruleId: 'rule:null-values', automaticAuthorization: { actionType: 'null_values', authorized: false, conditionsMet: [], reason: 'No auto' } },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
    Age: { inferredType: 'number', semanticType: 'age', distinctCount: 88, nullCount: 177, nullPercentage: 19.9, topValues: [{ value: '24', count: 5, percentage: 5 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
};

const DATASET_SHA256 = 'a'.repeat(64);
const auditEvidence = { datasetSha256: DATASET_SHA256, datasetFingerprint: DATASET_SHA256 };

const envLocal = _buildEvidenceEnvelopeV2(minimalReport, { privacyLevel: 'local_full', datasetSha256: DATASET_SHA256, delimiter: ',' });
const envCloud = _buildEvidenceEnvelopeV2(minimalReport, { privacyLevel: 'cloud_minimized', datasetSha256: DATASET_SHA256, delimiter: ',' });
const ppLocal = buildDiagnosisPromptV2(envLocal);
const ppCloud = buildDiagnosisPromptV2(envCloud);

function validResponseForProviderType(type: string, withoutEvidenceRefs = false): string {
  const env = type === 'cloud' ? envCloud : envLocal;
  const pp = type === 'cloud' ? ppCloud : ppLocal;
  const ref = pp.evidenceEnvelopeRef;
  const iss0 = env.issues[0];
  const iss1 = env.issues[1];
  return JSON.stringify({
    contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
    evidenceEnvelopeRef: ref, responseId: 'diag-test-001',
    issues: [
      { issueId: iss0.issueId, evidenceRefs: withoutEvidenceRefs ? [] : iss0.evidenceRefs, hypothesis: 'Whitespace padding', confidence: 0.9, requiresHumanReview: true, limits: [] },
      { issueId: iss1.issueId, evidenceRefs: withoutEvidenceRefs ? [] : iss1.evidenceRefs, hypothesis: 'Null values in Age', confidence: 0.85, requiresHumanReview: true, limits: [] },
    ],
    diagnosisBlocks: [
      { issueId: iss0.issueId, ruleId: iss0.ruleId, columnId: iss0.columnId, scope: iss0.scope, observation: '2 whitespace values', recommendation: 'Trim at ingestion' },
      { issueId: iss1.issueId, ruleId: iss1.ruleId, columnId: iss1.columnId, scope: iss1.scope, observation: '177 null values', recommendation: 'Investigate collection' },
    ],
    limitations: ['Sample based'],
    generatedAt: new Date().toISOString(),
  });
}

function setupValidProvider(p: AIProvider, model = 'gemini-2.5-flash') {
  p.generateTextWithProgress = vi.fn().mockResolvedValue({
    text: validResponseForProviderType(p.type),
    metrics: { latencyMs: 800, tokensGenerated: 250, model, provider: p.type === 'cloud' ? 'google' : p.name, isLocal: p.type !== 'cloud' },
  });
}

describe('always-on v2 selection', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(false); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('a historical false flag cannot route a new diagnosis to legacy', async () => {
    const p = makeProvider('cloud');
    setupValidProvider(p);
    const r = await runStructuredDiagnosis(minimalReport, {
      provider: p,
      auditEvidence,
      requestedModel: 'gemini-2.5-flash',
    });
    expect('success' in r && r.success).toBe(true);
  });

  it('flag true → success with structured result', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    const p = makeProvider('cloud');
    setupValidProvider(p);
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence, requestedModel: 'gemini-2.5-flash' });
    expect('success' in r && r.success).toBe(true);
    if ('success' in r && r.success) {
      expect(r.result.version).toBe(2);
      expect(r.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(r.result.diagnosis.issues).toHaveLength(2);
      expect(r.result.diagnosis.diagnosisBlocks).toHaveLength(2);
      expect(r.result.metrics.tokensGenerated).toBe(250);
      expect(r.result.inputMode).toBe('smart_sample');
      expect(r.result.inputSnapshot?.contractId).toBe('aura.input-snapshot.v2');
      expect(r.result.executionReceipt?.validationStatus).toBe('valid');
      expect(r.result.executionReceipt?.inputHash).toBe(r.result.inputHash);
    }
    expect(p.generateTextWithProgress).toHaveBeenCalledWith(
      expect.stringContaining('=== REQUIRED RESPONSE JSON SCHEMA ==='),
      expect.any(Function),
      expect.objectContaining({
        responseSchema: expect.objectContaining({
          required: expect.arrayContaining(['contractId', 'contractVersion', 'evidenceEnvelopeRef']),
          properties: expect.objectContaining({
            issues: expect.objectContaining({ minItems: 2, maxItems: 2 }),
            diagnosisBlocks: expect.objectContaining({ minItems: 2, maxItems: 2 }),
          }),
        }),
      }),
    );
    expect(vi.mocked(p.generateTextWithProgress!).mock.calls[0][0]).toContain('"contractId"');
  });
});

describe('fingerprint enforcement', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('null → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence: null });
    expect('success' in r && r.success).toBe(false);
    expect((r as unknown as { success: false; code: string; message: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
    expect((r as unknown as { success: false; code: string; message: string }).message).toContain('datasetSha256');
  });

  it('empty → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence: { datasetSha256: '' } });
    expect('success' in r && r.success).toBe(false);
    expect((r as unknown as { success: false; code: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });

  it('non-64-hex sha256 → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, {
      provider: p,
      auditEvidence: { datasetSha256: 'short-fingerprint' },
    });
    expect('success' in r && r.success).toBe(false);
    expect((r as unknown as { success: false; code: string; details: { reason: string } }).details.reason).toBe('invalid_dataset_sha256');
  });
});

describe('privacy derivation', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('cloud → success', async () => { const p = makeProvider('cloud'); setupValidProvider(p); const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence, requestedModel: 'gemini-2.5-flash' }); expect('success' in r && r.success).toBe(true); });
  it('ollama → success', async () => { const p = makeProvider('ollama'); setupValidProvider(p, 'qwen2.5:3b'); const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence, requestedModel: 'qwen2.5:3b' }); expect('success' in r && r.success).toBe(true); });
  it('local → success', async () => { const p = makeProvider('local'); setupValidProvider(p, 'gemma3-4b-it'); const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence, requestedModel: 'gemma3-4b-it' }); expect('success' in r && r.success).toBe(true); });
});

describe('result structure', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('success narrowing → all fields present', async () => {
    const p = makeProvider('cloud');
    setupValidProvider(p);
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence, requestedModel: 'gemini-2.5-flash' });
    expect('success' in r && r.success).toBe(true);
    if ('success' in r && r.success) {
      expect(r.result.version).toBe(2);
      expect(r.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(r.result.metrics.latencyMs).toBeGreaterThan(0);
    }
  });

  it('rejects an empty requested model before calling the provider', async () => {
    const provider = makeProvider('ollama');
    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      requestedModel: '   ',
    });

    expect(provider.generateTextWithProgress).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      contractId: 'aura.diagnosis-failure-evidence.v2',
      code: 'DIAGNOSIS_MODEL_NOT_REQUESTED',
    }));
    if ('contractId' in result) {
      expect(result.executionReceipt.validationStatus).toBe('invalid');
      expect(result.executionReceipt.observedModel).toBeNull();
      expect(result.rawResponseHash).toBe(result.executionReceipt.rawResponseHash);
    }
  });

  it.each([
    [null, 'missing observed model'],
    ['another-model', 'different observed model'],
  ])('persists canonical failure evidence for %s', async (observedModel) => {
    const provider = makeProvider('ollama');
    provider.generateTextWithProgress = vi.fn().mockResolvedValue({
      text: validResponseForProviderType('ollama'),
      metrics: { latencyMs: 10, tokensGenerated: 20, model: observedModel, provider: 'Ollama', isLocal: true },
    });

    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      requestedModel: 'model-a',
    });

    expect(result).toEqual(expect.objectContaining({
      contractId: 'aura.diagnosis-failure-evidence.v2',
      code: 'DIAGNOSIS_MODEL_MISMATCH',
    }));
    if ('contractId' in result) {
      expect(result.executionReceipt.validationStatus).toBe('invalid');
      expect(result.executionReceipt.observedModel).toBe(observedModel);
      expect(result.rawResponseHash).toBe(result.executionReceipt.rawResponseHash);
    }
  });

  it('uses the receipt hash as the canonical hash after a transport failure', async () => {
    const provider = makeProvider('ollama');
    provider.generateTextWithProgress = vi.fn().mockRejectedValue(new Error('transport unavailable'));

    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      requestedModel: 'model-a',
    });

    expect(result).toEqual(expect.objectContaining({ contractId: 'aura.diagnosis-failure-evidence.v2' }));
    if ('contractId' in result) {
      expect(result.rawResponseHash).toBe(result.executionReceipt.rawResponseHash);
      expect(result.rawResponseHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe('canonical input propagation', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('sends three distinct exact prompts and certifies each effective method', async () => {
    const observed: string[] = [];
    const hashes: string[] = [];
    for (const inputMode of ['prompt_libre', 'smart_sample', 'recommended'] as const) {
      const provider = makeProvider('ollama');
      provider.generateTextWithProgress = vi.fn(async (prompt) => {
        observed.push(prompt);
        return {
          text: validResponseForProviderType('ollama', prompt.includes('"inputMode":"prompt_libre"')),
          metrics: {
            latencyMs: 10, firstTokenMs: 1, tokensGenerated: 20,
            model: 'model-a', provider: 'Ollama', isLocal: true,
            timestamp: '2026-07-11T00:00:00.000Z',
          },
        };
      });
      const result = await runStructuredDiagnosis(minimalReport, {
        provider,
        auditEvidence,
        inputMode,
        requestedModel: 'model-a',
      });
      expect('success' in result && result.success).toBe(true);
      if ('success' in result && result.success) {
        expect(result.result.inputMode).toBe(inputMode);
        expect(result.result.executionReceipt?.effectiveInputMode).toBe(inputMode);
        expect(result.result.executionReceipt?.promptHash).toBe(result.result.inputSnapshot?.promptHash);
        hashes.push(result.result.inputHash!);
      }
    }
    expect(new Set(observed)).toHaveLength(3);
    expect(new Set(hashes)).toHaveLength(3);
  });
});
