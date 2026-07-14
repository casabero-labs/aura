// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CampaignReportPanel from '../components/benchmark/CampaignReportPanel';
import type { ExperimentEvidencePackage } from '../services/benchmark/experimentArtifactExporter';
import { buildExperimentCampaignEvidence } from '../services/benchmark/experimentReport';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

const artifacts = [
  ['campaign.json', 'application/json'],
  ['runs.csv', 'text/csv'],
  ['report.md', 'text/markdown'],
  ['report.pdf', 'application/pdf'],
  ['manifest.json', 'application/json'],
] as const;

describe('CampaignReportPanel', () => {
  it('explains what every exported artifact contains', () => {
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    const evidencePackage = {
      artifacts: artifacts.map(([filename, mediaType]) => ({ filename, mediaType, content: '' })),
    } as unknown as ExperimentEvidencePackage;
    render(<CampaignReportPanel evidenceDocument={evidenceDocument} formalValidity={{ valid: true, reasons: [] }} evidencePackage={evidencePackage} />);
    const list = screen.getByRole('list', { name: 'Artefactos disponibles' });
    expect(list.textContent).toContain('Fuente canónica del experimento');
    expect(list.textContent).toContain('Una fila por corrida');
    expect(list.textContent).toContain('Informe legible');
    expect(list.textContent).toContain('Versión PDF');
    expect(list.textContent).not.toContain('TFM');
    expect(list.textContent).toContain('Hashes de todos los archivos');
    expect(screen.getByText('Cómo califica AURA')).toBeTruthy();
    expect(screen.getByText('Mejor equilibrio para AURA')).toBeTruthy();
    expect(screen.getByText(/No es un juicio de otro LLM/)).toBeTruthy();
  });

  it('groups verbose technical blockers into concise human-readable causes', () => {
    const fixture = createExperimentEvidenceFixture();
    const evidenceDocument = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    render(
      <CampaignReportPanel
        evidenceDocument={evidenceDocument}
        formalValidity={{
          valid: false,
          reasons: [
            'run:very:long:identifier: protocolVersion must match the frozen protocol',
            'run:another:long:identifier: protocolVersion must match the frozen protocol',
            'run:very:long:identifier: environment.inference must match the frozen protocol',
            'campaign status is not completed',
          ],
        }}
        evidencePackage={null}
      />,
    );

    const pending = screen.getByRole('list', { name: 'Condiciones pendientes del reporte' });
    expect(pending.textContent).toContain('Protocolo anterior');
    expect(pending.textContent).toContain('Configuración no vigente');
    expect(pending.textContent).toContain('Campaña incompleta');
    expect(screen.getAllByText('Protocolo anterior')).toHaveLength(1);
    expect(screen.getByText('Ver detalle técnico')).toBeTruthy();
  });
});
