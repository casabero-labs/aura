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

const auditEvidence = { datasetFingerprint: 'abc123fingerprint' };

const envLocal = _buildEvidenceEnvelopeV2(minimalReport, { privacyLevel: 'local_full', datasetSha256: 'abc123fingerprint', delimiter: ',' });
const envCloud = _buildEvidenceEnvelopeV2(minimalReport, { privacyLevel: 'cloud_minimized', datasetSha256: 'abc123fingerprint', delimiter: ',' });
const ppLocal = buildDiagnosisPromptV2(envLocal);
const ppCloud = buildDiagnosisPromptV2(envCloud);

function validResponseForProviderType(type: string): string {
  const env = type === 'cloud' ? envCloud : envLocal;
  const pp = type === 'cloud' ? ppCloud : ppLocal;
  const ref = pp.evidenceEnvelopeRef;
  const iss0 = env.issues[0];
  const iss1 = env.issues[1];
  return JSON.stringify({
    contractId: 'aura.diagnosis.v2', contractVersion: '2.0.0',
    evidenceEnvelopeRef: ref, responseId: 'diag-test-001',
    issues: [
      { issueId: iss0.issueId, evidenceRefs: iss0.evidenceRefs, hypothesis: 'Whitespace padding', confidence: 0.9, requiresHumanReview: true, limits: [] },
      { issueId: iss1.issueId, evidenceRefs: iss1.evidenceRefs, hypothesis: 'Null values in Age', confidence: 0.85, requiresHumanReview: true, limits: [] },
    ],
    diagnosisBlocks: [
      { issueId: iss0.issueId, ruleId: iss0.ruleId, columnId: iss0.columnId, scope: iss0.scope, observation: '2 whitespace values', recommendation: 'Trim at ingestion' },
      { issueId: iss1.issueId, ruleId: iss1.ruleId, columnId: iss1.columnId, scope: iss1.scope, observation: '177 null values', recommendation: 'Investigate collection' },
    ],
    limitations: ['Sample based'],
    generatedAt: new Date().toISOString(),
  });
}

function setupValidProvider(p: AIProvider) {
  p.generateTextWithProgress = vi.fn().mockResolvedValue({
    text: validResponseForProviderType(p.type),
    metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini-2.5-flash', provider: 'google', isLocal: false },
  });
}

describe('v2 flag selection', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(false); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('flag false → CONTRACTS_V2_DISABLED', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence });
    expect(r.success).toBe(false);
    expect((r as { success: false; code: string }).code).toBe('CONTRACTS_V2_DISABLED');
  });

  it('flag true → success with structured result', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    const p = makeProvider('cloud');
    setupValidProvider(p);
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.result.version).toBe(2);
      expect(r.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(r.result.diagnosis.issues).toHaveLength(2);
      expect(r.result.diagnosis.diagnosisBlocks).toHaveLength(2);
      expect(r.result.metrics.tokensGenerated).toBe(250);
    }
  });
});

describe('fingerprint enforcement', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('null → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence: null });
    expect(r.success).toBe(false);
    expect((r as { success: false; code: string; message: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
    expect((r as { success: false; code: string; message: string }).message).toContain('datasetFingerprint');
  });

  it('empty → DIAGNOSIS_ADAPTER_ERROR', async () => {
    const p = makeProvider('cloud');
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence: { datasetFingerprint: '' } });
    expect(r.success).toBe(false);
    expect((r as { success: false; code: string }).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });
});

describe('privacy derivation', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('cloud → success', async () => { const p = makeProvider('cloud'); setupValidProvider(p); expect((await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence })).success).toBe(true); });
  it('ollama → success', async () => { const p = makeProvider('ollama'); setupValidProvider(p); expect((await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence })).success).toBe(true); });
  it('local → success', async () => { const p = makeProvider('local'); setupValidProvider(p); expect((await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence })).success).toBe(true); });
});

describe('result structure', () => {
  beforeEach(() => { vi.mocked(isContractsV2Enabled).mockReturnValue(true); });
  afterEach(() => { vi.mocked(isContractsV2Enabled).mockReset(); });

  it('success narrowing → all fields present', async () => {
    const p = makeProvider('cloud');
    setupValidProvider(p);
    const r = await runStructuredDiagnosis(minimalReport, { provider: p, auditEvidence });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.result.version).toBe(2);
      expect(r.result.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(r.result.metrics.latencyMs).toBeGreaterThan(0);
    }
  });
});
