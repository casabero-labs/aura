import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { clearPipelineSession, loadPipelineSession, savePipelineSession } from '../services/pipelineSession';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
  };
}

describe('pipelineSession', () => {
  let mockLs: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockLs = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockLs);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and restores serializable pipeline data without raw File objects', () => {
    savePipelineSession({
      state: 'export',
      file: new File(['a,b\n1,2'], 'demo.csv', { type: 'text/csv' }),
      report: { rowCount: 1, colCount: 2 } as any,
      auditEvidence: null,
      rawData: [{ a: 1, b: 2 }],
      csvFields: ['a', 'b'],
      csvDelimiter: ',',
      cleaningScript: 'print("ok")',
      approvedScript: 'print("ok")',
      healthDelta: null,
      aiAnalysis: 'diagnosis',
      structuredDiagnosis: null,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
    });

    expect(mockLs.setItem).toHaveBeenCalled();

    const restored = loadPipelineSession();
    expect(restored?.state).toBe('export');
    expect(restored?.file).toBeNull();
    expect(restored?.fileMeta?.name).toBe('demo.csv');
    expect(restored?.report).not.toBeNull();
    expect(restored?.csvFields).toEqual(['a', 'b']);
    expect(restored?.approvedScript).toBe('print("ok")');
  });

  it('clears the saved session', () => {
    savePipelineSession({
      state: 'upload', file: null, report: null, auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
        diagnosisFailureEvidence: null,
        structuredDiagnosis: null,
        diagnosticReport: null,
        remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
    });
    expect(loadPipelineSession()).not.toBeNull();

    clearPipelineSession();
    expect(loadPipelineSession()).toBeNull();
  });

  it('returns null when no session is stored', () => {
    expect(loadPipelineSession()).toBeNull();
  });

  it('does not restore a historical report with zero rows or columns', () => {
    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({
      state: 'profile',
      report: { rowCount: 0, colCount: 0, score: 100, issues: [] },
    }));
    expect(loadPipelineSession()).toBeNull();

    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({
      state: 'diagnostic_report',
      report: { rowCount: 3, colCount: 0, score: 100, issues: [] },
    }));
    expect(loadPipelineSession()).toBeNull();
  });

  it('handles corrupt JSON gracefully', () => {
    mockLs.getItem.mockReturnValueOnce('{not json');
    const result = loadPipelineSession();
    expect(result).toBeNull();
  });

  it('moves sessions from the removed calibration screen to diagnosis', () => {
    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({ state: 'calibration' }));

    expect(loadPipelineSession()?.state).toBe('diagnosis');
  });

  it('handles save with null file correctly', () => {
    savePipelineSession({
      state: 'upload',
      file: null,
      report: null,
      auditEvidence: null,
      rawData: [],
      csvFields: [],
      csvDelimiter: ',',
      cleaningScript: '',
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: '',
        diagnosisFailureEvidence: null,
        structuredDiagnosis: null,
        diagnosticReport: null,
        remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [],
      improvementRun: null,
      scriptValidation: null,
      deterministicValidation: null,
      logs: [],
    });

    const restored = loadPipelineSession();
    expect(restored?.state).toBe('upload');
    expect(restored?.fileMeta).toBeUndefined();
  });

  it('never restores executionState=verified from JSON even when fileMeta is present', () => {
    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({
      state: 'execution',
      file: null,
      fileMeta: { name: 'demo.csv', size: 10, type: 'text/csv', lastModified: 0 },
      report: null,
      auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: '{"contractId":"test"}',
      executionReceipt: { contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0' },
      executionValidationError: '',
    }));

    const restored = loadPipelineSession();
    expect(restored?.executionState).toBe('awaiting_external_output');
    expect(restored?.executionValidationError).toContain('memoria');
  });

  it('resets reaudit state and drops verifiedEvidence on restore', () => {
    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({
      state: 'execution',
      file: null,
      fileMeta: { name: 'demo.csv', size: 10, type: 'text/csv', lastModified: 0 },
      report: null,
      auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: '{"contractId":"test"}',
      executionReceipt: { contractId: 'aura.python-execution-receipt.v1', contractVersion: '1.0.0' },
      executionValidationError: '',
      reauditState: 'completed',
      reauditError: '',
    }));

    const restored = loadPipelineSession();
    expect(restored?.reauditState).toBe('not_run');
    expect(restored?.reauditError).toBe('');
    expect(restored?.verifiedEvidence).toBeNull();
  });

  it('never persists verifiedEvidence (corrected CSV bytes) in localStorage', () => {
    savePipelineSession({
      state: 'execution',
      file: null,
      report: null,
      auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: '{}',
      executionValidationError: '',
      reauditState: 'completed',
      reauditError: '',
      verifiedEvidence: {
        correctedCsv: new TextEncoder().encode('id,secret\n1,PII_VALUE\n'),
        beforeAfterSummary: { beforeScore: 10, afterScore: 90 },
      } as any,
    });

    const stored = mockLs.setItem.mock.calls.at(-1)?.[1] ?? '';
    expect(stored).not.toContain('verifiedEvidence');
    expect(stored).not.toContain('correctedCsv');
    expect(stored).not.toContain('PII_VALUE');
  });

  it('persists all cryptographic fields of executionReceipt', () => {
    savePipelineSession({
      state: 'execution',
      file: null,
      report: null,
      auditEvidence: null,
      rawData: [], csvFields: [], csvDelimiter: ',',
      cleaningScript: '', approvedScript: '', healthDelta: null,
      aiAnalysis: '',
      structuredDiagnosis: null,
      diagnosisFailureEvidence: null,
      diagnosticReport: null,
      remediationPlan: null,
      scriptContractV2: null,
      scriptContractVerificationV2: null,
      benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
      executionState: 'verified',
      executionBundleJson: '{}',
      executionReceipt: {
        contractId: 'aura.python-execution-receipt.v1',
        contractVersion: '1.0.0',
        runId: 'exec:test',
        approvedScriptHash: 'a'.repeat(64),
        scriptTextSha256: 'b'.repeat(64),
        beforeDatasetSha256: 'c'.repeat(64),
        afterDatasetSha256: 'd'.repeat(64),
        pythonVersion: '3.12.1',
        pandasVersion: '2.2.0',
        platform: 'darwin',
        bundleHash: 'e'.repeat(64),
        inputReceiptRef: 'f'.repeat(64),
        evidenceEnvelopeRef: 'env:' + '0'.repeat(64),
        syntax: { status: 'passed', error: null },
        execution: {
          status: 'passed', startedAt: '2026-07-12T12:00:00.000Z', completedAt: '2026-07-12T12:00:01.000Z',
          durationMs: 1000, stdoutSha256: '1'.repeat(64), stderrSha256: '2'.repeat(64), error: null,
        },
        output: { rowCount: 1, columnCount: 1 },
        receiptHash: '9'.repeat(64),
      } as any,
      executionValidationError: '',
    });

    const stored = mockLs.setItem.mock.calls[0]?.[1] ?? '';
    const parsed = JSON.parse(stored);
    expect(parsed.executionReceipt.bundleHash).toBe('e'.repeat(64));
    expect(parsed.executionReceipt.inputReceiptRef).toBe('f'.repeat(64));
    expect(parsed.executionReceipt.evidenceEnvelopeRef).toBe('env:' + '0'.repeat(64));
  });

  const baseData = (overrides: Record<string, unknown> = {}) => ({
    state: 'review' as const,
    file: new File(['Name,Age\nAna,30\n'], 'personas.csv', { type: 'text/csv' }),
    report: { rowCount: 2, colCount: 2, score: 80, issues: [] } as any,
    auditEvidence: { datasetSha256: 'a'.repeat(64), fileName: 'personas.csv' } as any,
    rawData: [{ Name: 'Zuleima', Age: '30' }, { Name: 'Luis', Age: '001' }],
    csvFields: ['Name', 'Age'], csvDelimiter: ',',
    cleaningScript: '', approvedScript: '', healthDelta: null, aiAnalysis: 'diagnóstico',
    structuredDiagnosis: null, diagnosisFailureEvidence: null, diagnosticReport: null,
    remediationPlan: null, scriptContractV2: null, scriptContractVerificationV2: null,
    benchmarkResults: [], improvementRun: null, scriptValidation: null,
    deterministicValidation: null, logs: [],
    ...overrides,
  });

  it('never persists dataset rows (rawData, improvementRun.simulatedData)', () => {
    savePipelineSession(baseData({
      improvementRun: {
        id: 'run-1', evidenceStatus: 'simulated', initialReport: { rowCount: 2 },
        benchmarkResults: [], remediationActions: [], createdAt: '2026-10-03T00:00:00.000Z',
        simulatedData: [{ Name: 'Xiomara', Age: '30' }],
        simulatedReport: { rowCount: 2 },
      } as any,
    }) as any);

    const stored = mockLs.setItem.mock.calls.at(-1)?.[1] ?? '';
    expect(stored).not.toContain('Luis');
    expect(stored).not.toContain('Zuleima');
    expect(stored).not.toContain('Xiomara');
    const parsed = JSON.parse(stored);
    expect(parsed.rawData).toEqual([]);
    expect(parsed.improvementRun.simulatedData).toBeUndefined();
    expect(parsed.improvementRun.simulatedReport).toEqual({ rowCount: 2 });
    // Processed artifacts survive.
    expect(parsed.report.rowCount).toBe(2);
    expect(parsed.auditEvidence.datasetSha256).toBe('a'.repeat(64));
    expect(parsed.aiAnalysis).toBe('diagnóstico');

    const restored = loadPipelineSession();
    expect(restored?.rawData).toEqual([]);
  });

  it('purges rows from a legacy snapshot on load', () => {
    mockLs.setItem('aura_pipeline_session_v1', JSON.stringify({
      state: 'review',
      report: { rowCount: 2, colCount: 2, score: 80, issues: [] },
      rawData: [{ Name: 'Ana' }, { Name: 'Luis' }],
    }));
    const restored = loadPipelineSession();
    expect(restored?.rawData).toEqual([]);
    expect(mockLs.getItem('aura_pipeline_session_v1')).not.toContain('Luis');
  });

  it('removes the stale snapshot when saving fails (quota)', () => {
    savePipelineSession(baseData({ auditEvidence: { datasetSha256: 'b'.repeat(64), fileName: 'antiguo.csv' } }) as any);
    expect(loadPipelineSession()?.auditEvidence?.fileName).toBe('antiguo.csv');

    mockLs.setItem.mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    savePipelineSession(baseData({ auditEvidence: { datasetSha256: 'c'.repeat(64), fileName: 'nuevo.csv' } }) as any);

    expect(mockLs.removeItem).toHaveBeenCalledWith('aura_pipeline_session_v1');
    expect(loadPipelineSession()).toBeNull();
  });
});
