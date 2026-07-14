// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DiagnosisStep from '../components/DiagnosisStep';
import type { AIConfig, AIProvider, AuditReport } from '../types';
import { clearOllamaModelCatalogCache } from '../services/ollamaModelCatalog';

const report = {
  score: 100,
  rowCount: 1,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {},
  issues: [],
  scoreBreakdown: [],
  datasetProfile: { totalRows: 1, totalColumns: 1, columns: [], coalescencePairs: [], pruningCandidates: [], generatedAt: '2026-07-14T00:00:00Z' },
} as unknown as AuditReport;

const config: AIConfig = {
  providerType: 'ollama',
  model: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
  ollamaModel: 'hf.co/unsloth/Qwen3.5-4B-GGUF:UD-Q4_K_XL',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  temperature: 0.1,
  autoAnalyze: false,
};

const provider = {
  name: 'Ollama',
  type: 'ollama',
  isAvailable: vi.fn().mockResolvedValue(true),
} as unknown as AIProvider;

afterEach(() => {
  clearOllamaModelCatalogCache();
  vi.unstubAllGlobals();
});

describe('DiagnosisStep installed Ollama models', () => {
  it('populates quick configuration from /api/tags instead of the static registry', async () => {
    const models = [
      { name: config.model, size: 3_587_679_553, modified_at: '2026-07-14T00:00:00Z' },
      { name: 'custom:latest', size: 1_000_000_000, modified_at: '2026-07-14T00:00:00Z' },
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => url.endsWith('/api/chat')
        ? { message: { content: 'OK' } }
        : { models },
    } as Response)));

    render(
      <DiagnosisStep
        report={report}
        aiConfig={config}
        aiProvider={provider}
        analysisText=""
        onAiConfigChange={vi.fn()}
        onAnalysisComplete={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('diagnosis-config-toggle')).toBeTruthy());
    fireEvent.click(screen.getByTestId('diagnosis-config-toggle'));
    const select = screen.getByTestId('diagnosis-quick-model') as HTMLSelectElement;
    await waitFor(() => expect(select.options).toHaveLength(2));
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      config.model,
      'custom:latest',
    ]);
    expect(select.textContent).not.toContain('Qwen 3 8B');
  });
});
