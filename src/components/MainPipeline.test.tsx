// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIConfig, AIProvider, AuditReport } from '../types';
import MainPipeline, { PipelineData } from './MainPipeline';

vi.mock('./DiagnosisStep', () => ({
  default: () => <div data-testid="diagnosis-step">Diagnóstico</div>,
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

const initialData: PipelineData = {
  state: 'calibration',
  file: null,
  report,
  auditEvidence: null,
  rawData: [],
  csvFields: [],
  csvDelimiter: ',',
  cleaningScript: '',
  approvedScript: '',
  healthDelta: null,
  aiAnalysis: '',
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
};

const aiConfig: AIConfig = {
  model: 'test-model',
  temperature: 0.2,
  autoAnalyze: false,
  providerType: 'ollama',
};

describe('MainPipeline calibration integration', () => {
  it('opens calibration inside the step and continues without external lab navigation', async () => {
    const user = userEvent.setup();
    const onOpenLab = vi.fn();

    render(
      <MainPipeline
        aiConfig={aiConfig}
        aiProvider={{} as AIProvider}
        initialData={initialData}
        onOpenLab={onOpenLab}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Activar comparación experimental' }));

    expect(screen.getByTestId('calibration-embedded-panel')).not.toBeNull();
    expect(onOpenLab).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continuar diagnóstico normal' }));

    expect(screen.getByTestId('diagnosis-step')).not.toBeNull();
    expect(onOpenLab).not.toHaveBeenCalled();
  });
});
