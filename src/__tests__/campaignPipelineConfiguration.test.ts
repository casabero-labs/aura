import { describe, expect, it } from 'vitest';
import { buildExperimentCampaignEvidence } from '../services/benchmark/experimentReport';
import {
  applyCampaignConfigurationToAIConfig,
  buildCampaignPipelineConfiguration,
} from '../services/benchmark/campaignPipelineConfiguration';
import type { AIConfig } from '../types';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('campaignPipelineConfiguration', () => {
  it('turns the balanced recommendation into an exact normal-pipeline configuration', () => {
    const fixture = createExperimentEvidenceFixture();
    const evidence = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    const recommendation = evidence.decisionSupport.recommendations.find((entry) => entry.useCase === 'balanced')!;

    const configuration = buildCampaignPipelineConfiguration(evidence);

    expect(configuration.contractId).toBe('aura.campaign-pipeline-configuration.v1');
    expect(configuration.modelId).toBe(recommendation.modelId);
    expect(configuration.inputMode).toBe(recommendation.inputMode);
    expect(configuration.inference).toEqual(expect.objectContaining({
      temperature: expect.any(Number),
      topP: expect.any(Number),
      numCtx: expect.any(Number),
      numPredict: expect.any(Number),
      think: false,
    }));
    expect(configuration.selection.validRuns).toBeGreaterThan(0);
  });

  it('respects a cell selected by the user and preserves the frozen inference snapshot', () => {
    const fixture = createExperimentEvidenceFixture();
    const evidence = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    const selected = evidence.decisionSupport.scores.at(-1)!;
    const matchingRun = evidence.runs.find((run) =>
      run.modelId === selected.modelId && run.inputMode === selected.inputMode)!;

    const configuration = buildCampaignPipelineConfiguration(evidence, selected.cellId, 'http://127.0.0.1:11434');

    expect(configuration.cellId).toBe(selected.cellId);
    expect(configuration.modelId).toBe(selected.modelId);
    expect(configuration.inputMode).toBe(selected.inputMode);
    expect(configuration.ollamaBaseUrl).toBe('http://127.0.0.1:11434');
    expect(configuration.inference).toEqual(matchingRun.environment.inference);
    expect(configuration.selection.balancedScore).toBe(selected.balanced);
  });

  it('applies the selected model, method and inference snapshot to the normal pipeline', () => {
    const fixture = createExperimentEvidenceFixture();
    const evidence = buildExperimentCampaignEvidence(fixture.campaign, fixture.runs, fixture.generatedAt);
    const configuration = buildCampaignPipelineConfiguration(evidence);
    const current: AIConfig = {
      model: 'previous-model',
      temperature: 0.7,
      autoAnalyze: false,
      providerType: 'cloud',
    };

    const applied = applyCampaignConfigurationToAIConfig(current, configuration);

    expect(applied).toEqual(expect.objectContaining({
      providerType: 'ollama',
      model: configuration.modelId,
      ollamaModel: configuration.modelId,
      ollamaBaseUrl: configuration.ollamaBaseUrl,
      inputMode: configuration.inputMode,
      temperature: configuration.inference.temperature,
      ollamaTopP: configuration.inference.topP,
      ollamaNumCtx: configuration.inference.numCtx,
      ollamaNumPredict: configuration.inference.numPredict,
      ollamaSeed: configuration.inference.seed,
      ollamaKeepAlive: configuration.inference.keepAlive,
      ollamaTimeoutSeconds: configuration.inference.timeoutSeconds,
    }));
  });
});
