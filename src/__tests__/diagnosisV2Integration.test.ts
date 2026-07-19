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
import { buildDiagnosisInputPackageV2_5 } from '../contracts/llm/diagnosisInputPackageV2_5';
import type { DiagnosisInputPackageV2_5 } from '../contracts/llm/diagnosisEvidenceIdentityV1';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { EvidenceEnvelopeV2 } from '../contracts/llm/types';
import type { AIProvider } from '../types';

function makeProvider(type: AIProvider['type'] = 'cloud'): AIProvider {
  const provider: AIProvider = {
    name: type === 'cloud' ? 'Google Gemini' : type === 'ollama' ? 'Ollama' : 'WebLLM',
    type,
    analyzeStream: vi.fn().mockResolvedValue({ latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false }),
    generateExecutiveReport: vi.fn().mockResolvedValue({ content: { title: '', domain_inferred: '', dataset_technical_description: '', executive_summary: '', business_impact: '', key_findings: [], recommendations: [] }, metrics: { latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false } }),
    generateExecutiveReportStream: vi.fn().mockResolvedValue({ content: { title: '', domain_inferred: '', dataset_technical_description: '', executive_summary: '', business_impact: '', key_findings: [], recommendations: [] }, metrics: { latencyMs: 0, tokensGenerated: 0, model: '', provider: '', isLocal: false } }),
    generateText: vi.fn(),
    generateTextWithProgress: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };
  return provider;
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
const inputLocal = buildDiagnosisInputPackageV2_5(minimalReport, envLocal, 'smart_sample');
const inputCloud = buildDiagnosisInputPackageV2_5(minimalReport, envCloud, 'smart_sample');

const aliasesByIssue = (input: DiagnosisInputPackageV2_5): Record<string, string[]> => {
  const grouped: Record<string, string[]> = {};
  for (const entry of input.evidenceAliasMap.entries) {
    grouped[entry.issueId] = [...(grouped[entry.issueId] ?? []), entry.alias];
  }
  return grouped;
};

const responseObject = (
  env: EvidenceEnvelopeV2,
  evidenceEnvelopeRef: string,
  refsByIssueId: Record<string, string[]>,
) => {
  const issue0 = env.issues[0];
  const issue1 = env.issues[1];
  return {
    contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
    evidenceEnvelopeRef, responseId: 'diag-test-001',
    issues: [
      { issueId: issue0.issueId, evidenceRefs: refsByIssueId[issue0.issueId] ?? [], hypothesis: 'Whitespace padding', confidence: 0.9, requiresHumanReview: true, limits: [] },
      { issueId: issue1.issueId, evidenceRefs: refsByIssueId[issue1.issueId] ?? [], hypothesis: 'Null values in Age', confidence: 0.85, requiresHumanReview: true, limits: [] },
    ],
    diagnosisBlocks: [
      { issueId: issue0.issueId, ruleId: issue0.ruleId, columnId: issue0.columnId, scope: issue0.scope, observation: '2 whitespace values', recommendation: 'Trim at ingestion' },
      { issueId: issue1.issueId, ruleId: issue1.ruleId, columnId: issue1.columnId, scope: issue1.scope, observation: '177 null values', recommendation: 'Investigate collection' },
    ],
    limitations: ['Sample based'],
    generatedAt: new Date().toISOString(),
  };
};

function validResponseForProviderType(type: string): string {
  const env = type === 'cloud' ? envCloud : envLocal;
  const input = type === 'cloud' ? inputCloud : inputLocal;
  return JSON.stringify(responseObject(env, input.evidenceEnvelopeRef, aliasesByIssue(input)));
}

function sourceRefResponseForProviderType(type: string): string {
  const env = type === 'cloud' ? envCloud : envLocal;
  return JSON.stringify(responseObject(
    env,
    type === 'cloud' ? inputCloud.evidenceEnvelopeRef : inputLocal.evidenceEnvelopeRef,
    Object.fromEntries(env.issues.map((issue) => [issue.issueId, issue.evidenceRefs])),
  ));
}

const payloadFromExactPrompt = (prompt: string) => {
  const prefix = '=== INPUT EVIDENCE ===\n';
  const suffix = '\n\n=== REQUIRED RESPONSE JSON SCHEMA ===';
  const start = prompt.indexOf(prefix);
  const end = prompt.indexOf(suffix, start + prefix.length);
  if (start < 0 || end < 0) throw new Error('Exact prompt does not contain the canonical payload markers.');
  return JSON.parse(prompt.slice(start + prefix.length, end)) as {
    evidenceEnvelopeRef: string;
    inputMode: string;
    task: { allowedEvidenceAliasesByIssueId?: Record<string, string[]> };
  };
};

function validResponseForExactPrompt(prompt: string, env: EvidenceEnvelopeV2): string {
  const payload = payloadFromExactPrompt(prompt);
  return JSON.stringify(responseObject(
    env,
    payload.evidenceEnvelopeRef,
    payload.task.allowedEvidenceAliasesByIssueId ?? {},
  ));
}

function setupValidProvider(provider: AIProvider, model = 'gemini-2.5-flash') {
  provider.generateTextWithProgress = vi.fn(async (prompt) => ({
    text: validResponseForExactPrompt(prompt, provider.type === 'cloud' ? envCloud : envLocal),
    metrics: { latencyMs: 800, tokensGenerated: 250, model, provider: provider.type === 'cloud' ? 'google' : provider.name, isLocal: provider.type !== 'cloud' },
  }));
}

describe('always-on v2 selection', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(false); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('a historical false flag cannot route a new diagnosis to legacy', async () => {
    const provider = makeProvider('cloud');
    setupValidProvider(provider);
    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      requestedModel: 'gemini-2.5-flash',
    });
    expect('success' in result && result.success).toBe(true);
  });

  it('flag true → success with structured result', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    const provider = makeProvider('cloud');
    setupValidProvider(provider);
    const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence, requestedModel: 'gemini-2.5-flash' });
    expect('success' in result && result.success).toBe(true);
    if ('success' in result && result.success) {
      expect(result.result.version).toBe(2);
      expect(result.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(result.result.diagnosis.issues).toHaveLength(2);
      expect(result.result.diagnosis.diagnosisBlocks).toHaveLength(2);
      expect(result.result.metrics.tokensGenerated).toBe(250);
      expect(result.result.inputMode).toBe('smart_sample');
      expect(result.result.inputSnapshot?.contractId).toBe('aura.input-snapshot.v2');
      expect(result.result.executionReceipt?.validationStatus).toBe('valid');
      expect(result.result.executionReceipt?.inputHash).toBe(result.result.inputHash);
    }
    expect(provider.generateTextWithProgress).toHaveBeenCalledWith(
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
    expect(vi.mocked(provider.generateTextWithProgress!).mock.calls[0][0]).toContain('"contractId"');
  });
});

describe('fingerprint enforcement', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('null → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const provider = makeProvider('cloud');
    const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence: null });
    expect('success' in result && result.success).toBe(false);
    expect((result as unknown as { success: false; code: string; message: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
    expect((result as unknown as { success: false; code: string; message: string }).message).toContain('datasetSha256');
  });

  it('empty → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const provider = makeProvider('cloud');
    const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence: { datasetSha256: '' } });
    expect('success' in result && result.success).toBe(false);
    expect((result as unknown as { success: false; code: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });

  it('non-64-hex sha256 → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const provider = makeProvider('cloud');
    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence: { datasetSha256: 'short-fingerprint' },
    });
    expect('success' in result && result.success).toBe(false);
    expect((result as unknown as { success: false; code: string; details: { reason: string } }).details.reason).toBe('invalid_dataset_sha256');
  });
});

describe('privacy derivation', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('cloud → success', async () => { const provider = makeProvider('cloud'); setupValidProvider(provider); const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence, requestedModel: 'gemini-2.5-flash' }); expect('success' in result && result.success).toBe(true); });
  it('ollama → success', async () => { const provider = makeProvider('ollama'); setupValidProvider(provider, 'qwen2.5:3b'); const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence, requestedModel: 'qwen2.5:3b' }); expect('success' in result && result.success).toBe(true); });
  it('local → success', async () => { const provider = makeProvider('local'); setupValidProvider(provider, 'gemma3-4b-it'); const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence, requestedModel: 'gemma3-4b-it' }); expect('success' in result && result.success).toBe(true); });
});

describe('result structure', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('success narrowing → all fields present', async () => {
    const provider = makeProvider('cloud');
    let rawResponse = '';
    provider.generateTextWithProgress = vi.fn(async (prompt) => {
      rawResponse = validResponseForExactPrompt(prompt, envCloud);
      return {
        text: rawResponse,
        metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini-2.5-flash', provider: 'google', isLocal: false },
      };
    });
    const result = await runStructuredDiagnosis(minimalReport, { provider, auditEvidence, requestedModel: 'gemini-2.5-flash' });
    expect('success' in result && result.success).toBe(true);
    if ('success' in result && result.success) {
      expect(result.result.version).toBe(2);
      expect(result.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(result.result.metrics.latencyMs).toBeGreaterThan(0);
      expect(result.result.rawResponse).toBe(rawResponse);
      expect(result.result.rawResponseHash).toBe(result.result.executionReceipt.rawResponseHash);
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
    provider.generateTextWithProgress = vi.fn(async (prompt) => ({
      text: validResponseForExactPrompt(prompt, envLocal),
      metrics: { latencyMs: 10, tokensGenerated: 20, model: observedModel, provider: 'Ollama', isLocal: true },
    }));

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

  it('reports Ollama output truncation instead of a generic JSON error', async () => {
    const provider = makeProvider('ollama');
    const rawResponse = '{"contractId":"aura.diagnosis.v2","issues":[';
    provider.generateTextWithProgress = vi.fn().mockResolvedValue({
      text: rawResponse,
      metrics: {
        latencyMs: 10,
        tokensGenerated: 4096,
        model: 'model-a',
        provider: 'Ollama',
        finishReason: 'length',
        isLocal: true,
      },
    });

    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      requestedModel: 'model-a',
    });

    expect(result).toEqual(expect.objectContaining({
      contractId: 'aura.diagnosis-failure-evidence.v2',
      code: 'DIAGNOSIS_RESPONSE_TRUNCATED',
      path: '$',
      rawResponse,
    }));
    if ('contractId' in result) {
      expect(result.message).toContain('4096 tokens');
      expect(result.executionReceipt.validationErrorCodes).toEqual(['DIAGNOSIS_RESPONSE_TRUNCATED']);
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
          text: validResponseForExactPrompt(prompt, envLocal),
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

  it('rejects a prompt_libre response that guesses envelope-valid hidden refs', async () => {
    const provider = makeProvider('ollama');
    provider.generateTextWithProgress = vi.fn().mockResolvedValue({
      text: sourceRefResponseForProviderType('ollama'),
      metrics: {
        latencyMs: 10,
        firstTokenMs: 1,
        tokensGenerated: 20,
        model: 'model-a',
        provider: 'Ollama',
        isLocal: true,
      },
    });

    const result = await runStructuredDiagnosis(minimalReport, {
      provider,
      auditEvidence,
      inputMode: 'prompt_libre',
      requestedModel: 'model-a',
    });

    expect(result).toEqual(expect.objectContaining({
      contractId: 'aura.diagnosis-failure-evidence.v2',
      code: 'DIAGNOSIS_REFERENCE_INVALID',
    }));
  });
});
