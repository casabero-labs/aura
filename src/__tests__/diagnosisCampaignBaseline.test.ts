import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDiagnosisCampaignBaseline,
  type DiagnosisCampaignArtifactLike,
} from '../services/benchmark/diagnosisCampaignBaseline';

describe('buildDiagnosisCampaignBaseline', () => {
  it('separates failed runs, first blockers, and derived error occurrences', () => {
    const baseline = buildDiagnosisCampaignBaseline({
      campaign: { campaignId: 'campaign:test' },
      generatedAt: '2026-07-19T00:00:00.000Z',
      runs: [
        {
          runId: 'run:completed',
          modelId: 'model-a',
          inputMode: 'smart_sample',
          status: 'completed',
          diagnosis: {
            status: 'completed',
            metrics: { outputTokens: 100, promptTokens: 200, totalDurationMs: 300 },
          },
          automaticEvaluation: {
            diagnosis: {
              contractCompliant: false,
              inventedColumns: ['invented'],
              unsupportedClaims: ['unsupported'],
            },
          },
        },
        {
          runId: 'run:failed',
          modelId: 'model-b',
          inputMode: 'recommended',
          status: 'failed',
          diagnosis: {
            status: 'failed',
            error: { code: 'DIAGNOSIS_REFERENCE_INVALID' },
            validationErrors: [
              { code: 'DIAGNOSIS_REFERENCE_INVALID' },
              { code: 'DIAGNOSIS_SCHEMA_INVALID' },
              { code: 'DIAGNOSIS_SCHEMA_INVALID' },
            ],
            metrics: { outputTokens: 50, promptTokens: 150, totalDurationMs: 250 },
          },
        },
      ],
    });

    expect(baseline.totals).toEqual(expect.objectContaining({
      runCount: 2,
      completedRuns: 1,
      failedRuns: 1,
      contractEvaluatedRuns: 1,
      contractCompliantRuns: 0,
      claimCount: 2,
    }));
    expect(baseline.validation.runsWithCode).toEqual({
      DIAGNOSIS_REFERENCE_INVALID: 1,
      DIAGNOSIS_SCHEMA_INVALID: 1,
    });
    expect(baseline.validation.occurrencesByCode).toEqual({
      DIAGNOSIS_REFERENCE_INVALID: 1,
      DIAGNOSIS_SCHEMA_INVALID: 2,
    });
    expect(baseline.validation.firstBlockingCodes).toEqual({
      DIAGNOSIS_REFERENCE_INVALID: 1,
    });
    expect(baseline.validation.totalErrorOccurrences).toBe(3);
    expect(baseline.validation.additionalOccurrencesAfterFirstBlocker).toBe(2);
    expect(baseline.validation.rootCauseClassification).toBe('not_inferred');
  });

  it('reproduces the frozen campaign 2 denominators without treating occurrences as runs', () => {
    const campaignPath = join(
      __dirname,
      '..',
      '..',
      'experiments',
      'tests',
      'campana2',
      'resultado_export',
      'campaign.json',
    );
    const campaign = JSON.parse(readFileSync(campaignPath, 'utf8')) as DiagnosisCampaignArtifactLike;
    const baseline = buildDiagnosisCampaignBaseline(campaign);

    expect(baseline.totals).toEqual(expect.objectContaining({
      runCount: 27,
      completedRuns: 20,
      failedRuns: 7,
      contractEvaluatedRuns: 20,
      contractCompliantRuns: 11,
      claimCount: 34,
    }));
    expect(baseline.validation.firstBlockingCodes).toEqual({
      DIAGNOSIS_REFERENCE_INVALID: 4,
      DIAGNOSIS_SCHEMA_INVALID: 3,
    });
    expect(baseline.validation.totalErrorOccurrences).toBe(222);
    expect(baseline.validation.additionalOccurrencesAfterFirstBlocker).toBe(215);
    expect(new Set(baseline.validation.failedRuns.map((run) => run.modelId))).toEqual(
      new Set(['hf.co/unsloth/SmolLM3-3B-GGUF:UD-Q4_K_XL']),
    );
    expect(baseline.tokenComparison).toEqual(expect.objectContaining({
      v3SimulatedOutputTokens: null,
      status: 'pending_v3_serializer',
    }));
  });
});
