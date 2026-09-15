// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignConfigurationPanel from '../components/benchmark/CampaignConfigurationPanel';
import { buildCampaignPipelineConfiguration } from '../services/benchmark/campaignPipelineConfiguration';
import { buildExperimentCampaignEvidence } from '../services/benchmark/experimentReport';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

const configuration = () => {
  const fixture = createExperimentEvidenceFixture();
  return buildCampaignPipelineConfiguration(
    buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt),
  );
};

describe('CampaignConfigurationPanel', () => {
  it('shows and applies the exact selected configuration to the normal pipeline', async () => {
    const user = userEvent.setup();
    const value = configuration();
    const onApply = vi.fn();
    const onGoToAudit = vi.fn();
    render(
      <CampaignConfigurationPanel
        configuration={value}
        modelInstalled
        onApply={onApply}
        onGoToAudit={onGoToAudit}
      />,
    );

    expect(screen.getByText(value.modelId)).toBeTruthy();
    expect(screen.getByText(value.inputModeLabel)).toBeTruthy();
    expect(screen.getByText(value.inference.numCtx.toLocaleString('es-CO'))).toBeTruthy();
    expect(screen.getByText(value.inference.numPredict.toLocaleString('es-CO'))).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Aplicar al próximo diagnóstico' }));
    expect(onApply).toHaveBeenCalledWith(value);
    await user.click(screen.getByRole('button', { name: 'Ir a Auditoría' }));
    expect(onGoToAudit).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/no inicia un diagnóstico/i)).toBeTruthy();
  });

  it('blocks applying a model that is not installed in Ollama', () => {
    render(<CampaignConfigurationPanel configuration={configuration()} modelInstalled={false} />);
    expect(screen.getByText(/no está instalado en Ollama/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Aplicar al próximo diagnóstico' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
