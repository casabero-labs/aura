// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIConfig, AuditReport, BenchmarkResult } from '../../types';
import { runBenchmarkForConfig } from '../../services/benchmarkService';
import CalibrationEmbeddedPanel from './CalibrationEmbeddedPanel';

vi.mock('../../services/benchmarkService', () => ({
  runBenchmarkForConfig: vi.fn(),
}));

const report: AuditReport = {
  score: 80,
  rowCount: 10,
  colCount: 2,
  duplicateRows: 0,
  issues: [],
  columnStats: {},
  scoreBreakdown: [],
  delimiterDetected: ',',
};

const aiConfig: AIConfig = {
  model: 'test-model',
  temperature: 0.2,
  autoAnalyze: false,
  providerType: 'ollama',
  inputMode: 'smart_sample',
};

const result: BenchmarkResult = {
  id: 'calibration-result-1',
  provider: 'Ollama',
  providerType: 'ollama',
  inputMode: 'prompt_libre',
  model: 'test-model',
  temperature: 0.2,
  status: 'completed',
  latencyMs: 20,
  firstTokenMs: 5,
  tokensGenerated: 10,
  tokensPerSecond: 500,
  contractCompliance: true,
  formatCompliance: true,
  pythonScriptIncluded: false,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  timestamp: '2026-07-04T12:00:00.000Z',
};

describe('CalibrationEmbeddedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps normal diagnosis primary and allows returning to the explanation', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onClose = vi.fn();

    render(
      <CalibrationEmbeddedPanel
        report={report}
        aiConfig={aiConfig}
        results={[]}
        onResult={vi.fn()}
        onContinueStandardFlow={onContinue}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Continuar diagnóstico normal' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar calibración' }));

    expect(onContinue).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('runs the selected comparison and returns the preliminary result for persistence', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    vi.mocked(runBenchmarkForConfig).mockResolvedValue(result);

    render(
      <CalibrationEmbeddedPanel
        report={report}
        aiConfig={aiConfig}
        results={[]}
        onResult={onResult}
        onContinueStandardFlow={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Modo de entrada' }), 'prompt_libre');
    await user.click(screen.getByRole('button', { name: 'Ejecutar comparación preliminar' }));

    await waitFor(() => {
      expect(runBenchmarkForConfig).toHaveBeenCalledWith(
        report,
        aiConfig,
        'prompt_libre',
        expect.any(Function),
      );
      expect(onResult).toHaveBeenCalledWith(result);
    });
    expect(screen.getByTestId('calibration-result').textContent).toContain('Preliminar');
  });
});
