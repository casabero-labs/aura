// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CampaignReportPanel from '../components/benchmark/CampaignReportPanel';
import type { ExperimentEvidencePackage } from '../services/benchmark/experimentArtifactExporter';

const artifacts = [
  ['campaign.json', 'application/json'],
  ['runs.csv', 'text/csv'],
  ['report.md', 'text/markdown'],
  ['report.pdf', 'application/pdf'],
  ['manifest.json', 'application/json'],
] as const;

describe('CampaignReportPanel', () => {
  it('explains what every exported artifact contains', () => {
    const evidencePackage = {
      artifacts: artifacts.map(([filename, mediaType]) => ({ filename, mediaType, content: '' })),
    } as unknown as ExperimentEvidencePackage;
    render(<CampaignReportPanel formalValidity={{ valid: true, reasons: [] }} evidencePackage={evidencePackage} />);
    const list = screen.getByRole('list', { name: 'Artefactos disponibles' });
    expect(list.textContent).toContain('Fuente canónica del experimento');
    expect(list.textContent).toContain('Una fila por corrida');
    expect(list.textContent).toContain('Informe legible');
    expect(list.textContent).toContain('Versión PDF');
    expect(list.textContent).not.toContain('TFM');
    expect(list.textContent).toContain('Hashes de todos los archivos');
  });
});
