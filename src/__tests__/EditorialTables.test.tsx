// @vitest-environment jsdom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CampaignResultsExplorer from '../components/benchmark/CampaignResultsExplorer';
import { buildExperimentCampaignEvidence } from '../services/benchmark/experimentReport';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('Editorial table and chart contracts', () => {
  it('exposes caption, scoped headers, numeric alignment metadata and chart text alternative', async () => {
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
    expect(within(table).getByRole('caption')).toBeTruthy();
    expect(within(table).getAllByRole('columnheader').every((header) => header.getAttribute('scope') === 'col')).toBe(true);
    expect(within(table).getAllByRole('rowheader').every((header) => header.getAttribute('scope') === 'row')).toBe(true);

    const chart = screen.getByTestId('oe4-results-chart-overview');
    const describedBy = chart.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')?.textContent).toMatch(/tabla de datos exactos/i);
  });
});
