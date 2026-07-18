// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { downloadBlob, downloadTextFile } from '../utils/download';
import { loadPipelineSession } from '../services/pipelineSession';
import { validateAuraExportPackage } from '../services/exportContractValidation';
import { buildEvidenceArchive } from '../services/evidenceArchive';
import { AuditReport } from '../types';

vi.mock('../utils/download', () => ({
  downloadBlob: vi.fn(),
  downloadTextFile: vi.fn(),
}));

vi.mock('../services/evidenceArchive', () => ({
  buildEvidenceArchive: vi.fn(),
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

  it('returns from Exportación to the preserved diagnostic results', async () => {
    const user = userEvent.setup();
    vi.mocked(validateAuraExportPackage).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Empezar auditoría' }));
    expect(screen.getByTestId('export-stage')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Volver al informe diagnóstico' }));

    expect(screen.getByTestId('main-pipeline')).toBeTruthy();
    expect(screen.queryByTestId('export-stage')).toBeNull();
  });

  it('declara con sobriedad que no hubo remediación y conserva todas las descargas principales', async () => {
    vi.mocked(validateAuraExportPackage).mockReturnValue({ valid: true, errors: [], warnings: [] });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Empezar auditoría' }));

    expect(screen.getByTestId('export-remediation-not-run').textContent).toBe(
      'El análisis fue completado, pero no se ejecutó una remediación sobre el dataset',
    );
    expect(screen.getByTestId('export-download-evidence-package')).toBeTruthy();
    expect(screen.getByTestId('export-download-pdf')).toBeTruthy();
    expect(screen.getByTestId('export-download-json')).toBeTruthy();
    expect(screen.queryByTestId('export-download-corrected-csv')).toBeNull();
  });

  it('downloads one complete evidence ZIP after the same technical preflight', async () => {
    const user = userEvent.setup();
    vi.mocked(validateAuraExportPackage).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    vi.mocked(buildEvidenceArchive).mockResolvedValue({
      filename: 'aura_evidencia_test.zip',
      bytes: new Uint8Array([1, 2, 3]),
      manifest: {} as any,
    });

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Empezar auditoría' }));
    await user.click(screen.getByTestId('export-download-evidence-package'));

    await waitFor(() => {
      expect(validateAuraExportPackage).toHaveBeenCalledOnce();
      expect(buildEvidenceArchive).toHaveBeenCalledWith(expect.objectContaining({
        issuesCsv: expect.stringContaining('runId'),
        diagnosticPdf: null,
        activityLog: [],
        verifiedExecution: null,
        includeCorrectedDataset: false,
      }));
      expect(downloadBlob).toHaveBeenCalledWith(
        'aura_evidencia_test.zip',
        expect.any(Blob),
      );
    });
  });

  it('blocks the complete ZIP when a verified execution is claimed but its evidence is missing', async () => {
    const user = userEvent.setup();
    vi.mocked(validateAuraExportPackage).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
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
      executionState: 'verified',
      reauditState: 'completed',
      verifiedEvidence: null,
      savedAt: '2026-07-04T12:00:00.000Z',
    } as any);

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Empezar auditoría' }));
    await user.click(screen.getByTestId('export-download-evidence-package'));

    await waitFor(() => {
      const warning = screen.getByTestId('export-evidence-package-warning');
      expect(warning.textContent).toContain('reimportá');
    });
    expect(buildEvidenceArchive).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
