import { describe, expect, it, beforeEach, vi } from 'vitest';
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
      aiAnalysis: '', benchmarkResults: [], improvementRun: null,
      scriptValidation: null, deterministicValidation: null, logs: [],
    });
    expect(loadPipelineSession()).not.toBeNull();

    clearPipelineSession();
    expect(loadPipelineSession()).toBeNull();
  });

  it('returns null when no session is stored', () => {
    expect(loadPipelineSession()).toBeNull();
  });

  it('handles corrupt JSON gracefully', () => {
    mockLs.getItem.mockReturnValueOnce('{not json');
    const result = loadPipelineSession();
    expect(result).toBeNull();
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
});
