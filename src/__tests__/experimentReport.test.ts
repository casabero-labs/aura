import { describe, expect, it } from 'vitest';
import {
  buildExperimentCampaignEvidence,
  renderExperimentReportMarkdown,
} from '../services/benchmark/experimentReport';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('OE4 TFM report — Task 9', () => {
  it('renders every required section from the canonical document', () => {
    const fixture = createExperimentEvidenceFixture();
    const document = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    const markdown = renderExperimentReportMarkdown(document);

    expect(document.formalValidity).toEqual({ valid: true, reasons: [] });
    for (const heading of [
      'Método', 'Entorno y modelos', 'Matriz de corridas y fallos',
      'Calidad diagnóstica', 'Contrato y alucinaciones',
      'Validez y seguridad del script', 'Latencia, tokens y estabilidad',
      'Rúbrica humana', 'Ejecución representativa y antes/después',
      'Amenazas a la validez', 'Conclusiones acotadas',
    ]) {
      expect(markdown).toContain(`## ${heading}`);
    }
    expect(markdown).toContain(fixture.campaign.campaignId);
    expect(markdown).toContain('Corridas observadas: 45');
    expect(markdown).toContain('No existe un campo ni una conclusión de ganador universal');
  });

  it('keeps formal validity false when ratings or representative resolutions are missing', () => {
    const fixture = createExperimentEvidenceFixture({ missingHumanReview: true });
    const document = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);

    expect(document.formalValidity.valid).toBe(false);
    expect(document.formalValidity.reasons.join(' ')).toMatch(/human evaluation/i);
  });
});
