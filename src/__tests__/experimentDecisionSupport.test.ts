import { describe, expect, it } from 'vitest';
import { aggregateExperimentRuns } from '../services/benchmark/experimentAggregation';
import { buildExperimentDecisionSupport } from '../services/benchmark/experimentDecisionSupport';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('experimentDecisionSupport', () => {
  it('builds transparent 0-100 scores and recommendations without human or script metrics', () => {
    const fixture = createExperimentEvidenceFixture();
    const aggregation = aggregateExperimentRuns(fixture.runs);
    const result = buildExperimentDecisionSupport(aggregation);

    expect(result.scores).toHaveLength(9);
    expect(result.recommendations.map((entry) => entry.useCase)).toEqual([
      'balanced',
      'diagnostic_quality',
      'reliability',
      'traceability',
      'speed',
    ]);
    expect(result.methodology.oracle).toContain('ruleId + columnId + scope');
    expect(result.methodology.balancedWeights).toEqual({
      accuracy: 0.35,
      reliability: 0.2,
      contractCompliance: 0.15,
      evidenceSupport: 0.15,
      hallucinationSafety: 0.1,
      efficiency: 0.05,
    });
    result.scores.forEach((score) => {
      Object.values(score).filter((value): value is number => typeof value === 'number')
        .forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
      expect(score.balanced).not.toBeNull();
    });
    expect(JSON.stringify(result)).not.toMatch(/human|script|hitl/i);
  });

  it('penalizes failures through reliability instead of requiring manual review', () => {
    const fixture = createExperimentEvidenceFixture();
    const target = fixture.runs[0];
    const runs = fixture.runs.map((run) => run.runId === target.runId
      ? {
        ...run,
        status: 'failed' as const,
        diagnosis: { ...run.diagnosis!, status: 'failed' as const },
        automaticEvaluation: null,
      }
      : run);
    const result = buildExperimentDecisionSupport(aggregateExperimentRuns(runs));
    const cell = result.scores.find((score) =>
      score.modelId === target.modelId && score.inputMode === target.inputMode);

    expect(cell?.reliability).toBeCloseTo(66.6667, 3);
    expect(cell?.balanced).toBeLessThan(100);
  });
});
