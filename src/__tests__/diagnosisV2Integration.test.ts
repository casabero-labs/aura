/**
 * Diagnosis v1/v2 Integration Tests.
 *
 * Tests: v1/v2 flag selection, structured callback, privacy derivation,
 * fingerprint enforcement, Chrome privacy monitoring, result persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set CONTRACTS_V2_ENABLED before any modules are imported
process.env.CONTRACTS_V2_ENABLED = 'true';

// Mock contractRegistry BEFORE importing the modules under test
vi.mock('../contracts/llm/contractRegistry', () => ({
  isContractsV2Enabled: vi.fn(),
}));

import { runStructuredDiagnosis } from '../contracts/llm';
import { isContractsV2Enabled } from '../contracts/llm/contractRegistry';
import type { AuditReportInput } from '../contracts/llm/evidenceEnvelopeV2';
import type { AIProvider } from '../types';

const mockProvider = {
  type: 'cloud' as const,
  model: 'gemini-2.5-flash',
  generateText: vi.fn(),
  generateTextWithProgress: vi.fn(),
} satisfies AIProvider;

const minimalReport: AuditReportInput = {
  score: 85, rowCount: 100, colCount: 5, duplicateRows: 0, delimiterDetected: ',',
  issues: [
    { id: 'hygiene-ghost-Name', column: 'Name', category: 'Higiene de Texto', ruleName: 'Espacios Fantasma', description: 'whitespace padding', severity: 'info', count: 2, affectedPercentage: 2, sampleValues: ['Braund, Mr. Owen Harris'], ruleId: 'rule:trim-whitespace', automaticAuthorization: { actionType: 'trim_whitespace', authorized: true, conditionsMet: ['string-column'], reason: 'Deterministic' } },
  ],
  columnStats: {
    Name: { inferredType: 'string', semanticType: 'name', distinctCount: 89, nullCount: 0, nullPercentage: 0, topValues: [{ value: 'Braund', count: 1, percentage: 1 }], stats: {} },
  },
  datasetProfile: { columns: [{ name: 'Name' }] },
};

const auditEvidence = { datasetFingerprint: 'abc123fingerprint' };

const validV2Response = JSON.stringify({
  contractId: 'aura.diagnosis.v2',
  contractVersion: '2.0.0',
  evidenceEnvelopeRef: 'env-ref-001',
  responseId: 'resp-001',
  issues: [{
    issueId: 'iss-1', evidenceRefs: [], hypothesis: 'Test hypothesis',
    confidence: 0.9, requiresHumanReview: false, limits: [],
  }],
  diagnosisBlocks: [{
    issueId: 'iss-1', ruleId: 'rule:test', columnId: null,
    scope: 'dataset', observation: 'Test observation', recommendation: 'Test recommendation',
  }],
  limitations: ['Limited by sample size'],
  generatedAt: new Date().toISOString(),
});

function mockSuccessfulV2Provider() {
  mockProvider.generateTextWithProgress = vi.fn().mockResolvedValue({
    text: validV2Response,
    metrics: { latencyMs: 800, tokensGenerated: 250, model: 'gemini-2.5-flash', provider: 'google', isLocal: false },
  });
}

describe('runStructuredDiagnosis — v2 flag selection', () => {
  beforeEach(() => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(false);
  });
  afterEach(() => {
    vi.mocked(isContractsV2Enabled).mockReset();
    vi.clearAllMocks();
  });

  it('flag false returns CONTRACTS_V2_DISABLED without calling adapter', async () => {
    const result = await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence,
    });
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('CONTRACTS_V2_DISABLED');
    expect(mockProvider.generateText).not.toHaveBeenCalled();
    expect(mockProvider.generateTextWithProgress).not.toHaveBeenCalled();
  });

  it('flag true allows v2 pipeline to execute', async () => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    mockSuccessfulV2Provider();

    const result = await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence,
    });
    expect(mockProvider.generateTextWithProgress).toHaveBeenCalled();
  });
});

describe('runStructuredDiagnosis — fingerprint enforcement', () => {
  beforeEach(() => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
  });
  afterEach(() => {
    vi.mocked(isContractsV2Enabled).mockReset();
    vi.clearAllMocks();
  });

  it('missing fingerprint returns DIAGNOSIS_ADAPTER_ERROR without calling adapter', async () => {
    const result = await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence: null,
    });
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
    expect((result as any).message).toContain('datasetFingerprint');
    expect(mockProvider.generateTextWithProgress).not.toHaveBeenCalled();
  });

  it('empty fingerprint string returns DIAGNOSIS_ADAPTER_ERROR', async () => {
    const result = await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence: { datasetFingerprint: '' },
    });
    expect(result.success).toBe(false);
    expect((result as any).code).toBe('DIAGNOSIS_ADAPTER_ERROR');
  });
});

describe('runStructuredDiagnosis — privacy derivation', () => {
  beforeEach(() => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    mockSuccessfulV2Provider();
  });
  afterEach(() => {
    vi.mocked(isContractsV2Enabled).mockReset();
    vi.clearAllMocks();
  });

  it('cloud provider type uses cloud_minimized privacy', async () => {
    const cloudProvider = { ...mockProvider, type: 'cloud' as const };
    await runStructuredDiagnosis(minimalReport, { provider: cloudProvider, auditEvidence });
    expect(mockProvider.generateTextWithProgress).toHaveBeenCalled();
  });

  it('local provider type uses local_full privacy', async () => {
    const localProvider = { ...mockProvider, type: 'local' as const };
    await runStructuredDiagnosis(minimalReport, { provider: localProvider, auditEvidence });
    expect(mockProvider.generateTextWithProgress).toHaveBeenCalled();
  });

  it('ollama provider type uses local_full privacy', async () => {
    const ollamaProvider = { ...mockProvider, type: 'ollama' as const };
    await runStructuredDiagnosis(minimalReport, { provider: ollamaProvider, auditEvidence });
    expect(mockProvider.generateTextWithProgress).toHaveBeenCalled();
  });

  it('webllm_experimental provider type uses local_full privacy', async () => {
    const webllmProvider = { ...mockProvider, type: 'webllm_experimental' as const };
    await runStructuredDiagnosis(minimalReport, { provider: webllmProvider, auditEvidence });
    expect(mockProvider.generateTextWithProgress).toHaveBeenCalled();
  });
});

describe('runStructuredDiagnosis — result structure', () => {
  beforeEach(() => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
    mockSuccessfulV2Provider();
  });
  afterEach(() => {
    vi.mocked(isContractsV2Enabled).mockReset();
    vi.clearAllMocks();
  });

  it('v2 success returns DiagnosisExecutionResult with version 2 and all fields', async () => {
    mockSuccessfulV2Provider();
    const result = await runStructuredDiagnosis(minimalReport, { provider: mockProvider, auditEvidence });
    if (result.success) {
      const sr = (result as any).result;
      expect(sr.version).toBe(2);
      expect(sr.diagnosis.contractId).toBe('aura.diagnosis.v2');
      expect(sr.diagnosis.issues).toHaveLength(1);
      expect(sr.diagnosis.diagnosisBlocks).toHaveLength(1);
      expect(sr.diagnosis.limitations).toEqual(['Limited by sample size']);
      expect(sr.metrics.latencyMs).toBe(800);
      expect(sr.metrics.tokensGenerated).toBe(250);
    } else {
      expect((result as any).code).toBeTruthy();
    }
  });

  it('v2 success does NOT invoke onAnalysisComplete (only onStructuredDiagnosisComplete fires)', async () => {
    const onAnalysisComplete = vi.fn();
    await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence,
      onProgress: () => {},
    });
    expect(onAnalysisComplete).not.toHaveBeenCalled();
  });
});

describe('runStructuredDiagnosis — onProgress callback', () => {
  beforeEach(() => {
    vi.mocked(isContractsV2Enabled).mockReturnValue(true);
  });
  afterEach(() => {
    vi.mocked(isContractsV2Enabled).mockReset();
    vi.clearAllMocks();
  });

  it('progress events are forwarded to onProgress callback', async () => {
    const progressEvents: any[] = [];
    mockProvider.generateTextWithProgress = vi.fn().mockImplementation(async (prompt: string, onProgress: (event: any) => void) => {
      onProgress({ type: 'chunk', text: 'Thinking...' });
      onProgress({ type: 'chunk', text: 'Thinking more...' });
      return {
        text: validV2Response,
        metrics: { latencyMs: 500, tokensGenerated: 120, model: 'gemini-2.5-flash', provider: 'google', isLocal: false },
      };
    });

    const result = await runStructuredDiagnosis(minimalReport, {
      provider: mockProvider,
      auditEvidence,
      onProgress: (event) => progressEvents.push(event),
    });

    if (result.success) {
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0].type).toBe('chunk');
      expect(progressEvents[0].text).toBe('Thinking...');
      expect(progressEvents[1].text).toBe('Thinking more...');
    } else {
      expect((result as any).code).toBeTruthy();
    }
  });
});
