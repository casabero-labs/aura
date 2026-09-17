// @vitest-environment jsdom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignResultsExplorer from '../components/benchmark/CampaignResultsExplorer';
import { buildExperimentCampaignEvidence } from '../services/benchmark/experimentReport';
import { OE4_INPUT_MODE_LABELS } from '../services/benchmark/finalEvaluationProtocol';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('CampaignResultsExplorer', () => {
  it('visualizes the canonical campaign evidence without inventing a second score', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(
      fixture.campaign,
      fixture.runs,
      fixture.generatedAt,
    );
    const balanced = evidenceDocument.decisionSupport.recommendations
      .find((entry) => entry.useCase === 'balanced');

    render(<CampaignResultsExplorer evidenceDocument={evidenceDocument} />);

    expect(screen.getByRole('heading', { name: 'Visualizar resultados' })).toBeTruthy();
    expect(screen.queryByTestId('oe4-results-chart-overview')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Visualizar resultados' }));

    expect(screen.getByText('Oráculo congelado')).toBeTruthy();
    expect(screen.getByText('Determinista, sin juez LLM')).toBeTruthy();
    expect(screen.getByTestId('oe4-results-chart-overview')).toBeTruthy();
    expect(within(screen.getByLabelText('Combinación seleccionada')).getByText(formatExpected(balanced?.score))).toBeTruthy();
    expect(screen.getByText(/No demuestra superioridad universal/)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Dimensiones' }));
    expect(screen.getByTestId('oe4-results-chart-dimensions')).toBeTruthy();
    expect(screen.getByText(/Alineación con GT · peso 0 %/)).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Calidad y velocidad' }));
    expect(screen.getByTestId('oe4-results-chart-quality_speed')).toBeTruthy();
    expect(screen.getByText(/Latencia mediana · segundos/)).toBeTruthy();
  });

  it('J13 — keyboard row selection syncs chart, table and detail', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(
      fixture.campaign,
      fixture.runs,
      fixture.generatedAt,
    );
    const onSelectedCellIdChange = vi.fn();
    const { container } = render(
      <CampaignResultsExplorer
        evidenceDocument={evidenceDocument}
        onSelectedCellIdChange={onSelectedCellIdChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Visualizar resultados' }));
    await user.click(screen.getByText('Ver los datos exactos representados'));

    const rows = screen.getAllByTestId('oe4-result-row');
    expect(rows.length).toBeGreaterThan(1);
    rows[1].focus();
    await user.keyboard('{Enter}');

    expect(rows[1].getAttribute('aria-selected')).toBe('true');
    const selectedModel = rows[1].querySelector('th')?.textContent ?? '';
    expect(selectedModel.length).toBeGreaterThan(0);
    // Detalle sincronizado con la fila.
    expect(screen.getByLabelText('Combinación seleccionada').textContent).toContain(selectedModel);
    // Gráfico sincronizado: la marca seleccionada existe en la vista actual.
    expect(container.querySelectorAll('.oe4-results-chart .is-selected').length).toBeGreaterThan(0);
    // La selección se propaga al laboratorio (detalle + transferencia).
    expect(onSelectedCellIdChange).toHaveBeenCalledTimes(1);
  });

  it('J13 — tablist arrow keys move across views', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(
      fixture.campaign,
      fixture.runs,
      fixture.generatedAt,
    );
    render(<CampaignResultsExplorer evidenceDocument={evidenceDocument} />);
    await user.click(screen.getByRole('button', { name: 'Visualizar resultados' }));

    const tablist = screen.getByRole('tablist', { name: 'Vistas de resultados' });
    const selected = () => tablist.querySelector('[aria-selected="true"]')?.textContent;
    expect(selected()).toBe('Panorama');
    await user.click(screen.getByRole('tab', { name: 'Panorama' }));
    await user.keyboard('{ArrowRight}');
    expect(selected()).toBe('Dimensiones');
    expect(screen.getByTestId('oe4-results-chart-dimensions')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(selected()).toBe('Panorama');
  });

  it('keeps a textual table equivalent to the interactive charts', async () => {
    const user = userEvent.setup();
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(
      fixture.campaign,
      fixture.runs,
      fixture.generatedAt,
    );

    render(<CampaignResultsExplorer evidenceDocument={evidenceDocument} />);
    await user.click(screen.getByRole('button', { name: 'Visualizar resultados' }));
    await user.click(screen.getByText('Ver los datos exactos representados'));

    const table = screen.getByRole('table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(9);
    for (const label of Object.values(OE4_INPUT_MODE_LABELS)) {
      expect(table.textContent).toContain(label);
    }
    expect(table.textContent).toContain('Qwen3.5 4B');
    expect(table.textContent).toContain('Gemma 4 E4B');
    expect(table.textContent).toContain('SmolLM3 3B');
  });
});

const formatExpected = (value: number | undefined): string => value === undefined ? 'n/d' : value.toFixed(1);
