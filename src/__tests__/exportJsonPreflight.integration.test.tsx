// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { downloadTextFile } from '../utils/download';
import { loadPipelineSession } from '../services/pipelineSession';
import { validateAuraExportPackage } from '../services/exportContractValidation';
import { AuditReport } from '../types';

vi.mock('../utils/download', () => ({
  downloadTextFile: vi.fn(),
}));

vi.mock('../services/exportContractValidation', () => ({
  validateAuraExportPackage: vi.fn(),
}));

vi.mock('../services/pipelineSession', () => ({
  loadPipelineSession: vi.fn(),
  savePipelineSession: vi.fn(),
  clearPipelineSession: vi.fn(),
}));

vi.mock('../services/api', () => ({
  loadFromApi: vi.fn(
    async (_key: string, fallback: unknown): Promise<unknown> => fallback,
  ),
  syncToApi: vi.fn(),
}));

vi.mock('../services/aiProvider', () => ({
  createAIProvider: vi.fn(() => ({})),
}));

vi.mock('../components/MainPipeline', () => ({
  default: () => <div data-testid="main-pipeline" />,
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

describe('JSON technical export preflight integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    localStorage.clear();

    vi.mocked(loadPipelineSession).mockReturnValue({
      state: 'export',
      file: null,
      report,
      auditEvidence: null,
      rawData: [],
      csvFields: [],
      csvDelimiter: ',',
      cleaningScript: '',
      approvedScript: '',
      healthDelta: null,
      aiAnalysis: 'Diagnóstico de prueba.',
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
      savedAt: '2026-07-04T12:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('blocks the download and shows a controlled warning when preflight fails', async () => {
    const user = userEvent.setup();
    const internalDetail =
      'INTERNAL_SCHEMA_DETAIL: calibrationEvidence.summary.status mismatch';
    const consoleWarning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.mocked(validateAuraExportPackage).mockReturnValue({
      valid: false,
      errors: [internalDetail],
      warnings: [],
    });

    render(<App />);

    await user.click(
      screen.getByRole('button', { name: 'Empezar auditoría' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Descargar JSON' }),
    );

    expect(validateAuraExportPackage).toHaveBeenCalledOnce();
    expect(downloadTextFile).not.toHaveBeenCalled();

    const warning = screen.getByTestId('export-json-preflight-warning');
    expect(warning.textContent).toContain('JSON técnico no exportado.');
    expect(warning.textContent).toContain(
      'No se descargó el JSON técnico porque el paquete no superó la validación interna.',
    );
    expect(warning.textContent).not.toContain(internalDetail);
    expect(consoleWarning).toHaveBeenCalledWith(
      'export.preflight.failed',
      expect.objectContaining({
        errors: [internalDetail],
      }),
    );
  });

  it('does not expose the removed legacy laboratory in the app shell', () => {
    vi.mocked(validateAuraExportPackage).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    render(<App />);

    expect(screen.queryByText(/Laboratorio de Modelos/i)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Laboratorio' })).toHaveLength(2);
  });
});
