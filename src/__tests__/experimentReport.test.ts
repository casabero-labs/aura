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
      'Método de calificación automática', 'Latencia, tokens y estabilidad',
      'Scores de apoyo a la decisión', 'Recomendaciones por objetivo',
      'Amenazas a la validez', 'Conclusiones acotadas',
    ]) {
      expect(markdown).toContain(`## ${heading}`);
    }
    expect(markdown).toContain(fixture.campaign.campaignId);
    expect(markdown).toContain('Corridas observadas: 27');
    expect(markdown).toContain('No existe un campo ni una conclusión de ganador universal');
  });

  it('keeps the diagnosis-only report valid when human ratings are absent', () => {
    const fixture = createExperimentEvidenceFixture({ missingHumanReview: true });
    const document = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);

    expect(document.formalValidity).toEqual({ valid: true, reasons: [] });
    expect(document.representatives).toEqual([]);
    expect(document.decisionSupport.recommendations).toHaveLength(5);
    expect(renderExperimentReportMarkdown(document)).toContain('script, HITL y remediación pertenecen al pipeline normal');
  });
});
