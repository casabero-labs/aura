import { describe, expect, it } from 'vitest';
import { sha256BytesHex } from '../contracts/llm/hash';
import {
  canonicalPrettyJson,
  exportExperimentEvidencePackage,
} from '../services/benchmark/experimentArtifactExporter';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('OE4 artifact exporter — Task 9', () => {
  it('derives nine consistent artifacts from campaign.json', () => {
    const fixture = createExperimentEvidenceFixture({ missingHumanReview: true });
    const result = exportExperimentEvidencePackage(fixture);
    const canonical = JSON.parse(result.campaignJson);

    expect(result.artifacts.map((artifact) => artifact.filename)).toEqual([
      'campaign.json',
      'runs.csv',
      'report.md',
      'report.pdf',
      'results-summary.json',
      'methodology.md',
      'glossary.md',
      'selected-configuration.json',
      'manifest.json',
    ]);
    expect(canonical.campaign.campaignId).toBe(fixture.campaign.campaignId);
    expect(canonical.runs).toHaveLength(27);
    expect(canonical.runs[0].diagnosis.rawOutput).toContain('raw diagnosis');
    expect(result.runsCsv.trim().split('\n')).toHaveLength(28);
    expect(result.runsCsv.split('\n')[0]).toContain('diagnosis_status');
    expect(result.runsCsv.split('\n')[0]).toContain('f1');
    expect(result.runsCsv.split('\n')[0]).not.toMatch(/script|human|hitl|python|representative/);
    expect(result.reportMarkdown).toContain(fixture.campaign.campaignId);
    expect(result.reportPdf.textContent).toContain(fixture.campaign.campaignId);
    expect(new TextDecoder().decode(result.reportPdf.bytes.slice(0, 4))).toBe('%PDF');
    expect(result.source.formalValidity.valid).toBe(true);
    expect(result.source.representatives).toEqual([]);
    expect(result.reportMarkdown).toContain('Método de calificación automática');
    expect(result.methodologyMarkdown).toContain('Alineación con GT: 0 %');
    expect(result.methodologyMarkdown).toContain('Fiabilidad: 35 %');
    expect(result.glossaryMarkdown).toContain('Ground truth (GT)');
    expect(result.selectedConfiguration.contractId).toBe('aura.campaign-pipeline-configuration.v1');
    expect(JSON.parse(result.selectedConfigurationJson).modelId).toBe(result.selectedConfiguration.modelId);
  });

  it('hashes every non-self artifact and declares the manifest self-hash scope', () => {
    const result = exportExperimentEvidencePackage(createExperimentEvidenceFixture());
    const contentByName = new Map(result.artifacts.map((artifact) => [artifact.filename, artifact.content]));

    expect(result.source.formalValidity).toEqual({ valid: true, reasons: [] });
    for (const entry of result.manifest.files) {
      const content = contentByName.get(entry.filename);
      expect(content).toBeDefined();
      const contentBytes = typeof content === 'string' ? bytes(content) : content!;
      expect(entry.sizeBytes).toBe(contentBytes.byteLength);
      expect(entry.sha256).toBe(sha256BytesHex(contentBytes));
    }

    const { self, ...payload } = result.manifest;
    expect(self.scope).toBe('canonical manifest payload excluding self');
    expect(self.sha256).toBe(sha256BytesHex(bytes(canonicalPrettyJson(payload))));
  });
});
