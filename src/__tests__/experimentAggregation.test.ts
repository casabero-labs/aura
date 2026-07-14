import { describe, expect, it } from 'vitest';
import { aggregateExperimentRuns } from '../services/benchmark/experimentAggregation';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('OE4 experiment aggregation — Task 9', () => {
  it('derives the complete 3 × 3 matrix with three runs per cell', () => {
    const { runs } = createExperimentEvidenceFixture();
    const result = aggregateExperimentRuns(runs);

    expect(result.matrix).toMatchObject({
      models: 3,
      inputModes: 3,
      repetitions: 3,
      expectedRuns: 27,
      observedRuns: 27,
    });
    expect(result.matrix.cells).toHaveLength(9);
    expect(result.matrix.cells.every((cell) => cell.runCount === 3)).toBe(true);
  });

  it('produces descriptive statistics and independent best dimensions', () => {
    const { runs } = createExperimentEvidenceFixture();
    const result = aggregateExperimentRuns(runs);

    expect(result.overall.diagnosticF1).toMatchObject({ count: 27, median: 0.4, min: 0.2, max: 0.6 });
    expect(result.overall.totalLatencyMs.count).toBe(27);
    expect(result.bestByDimension.map((entry) => entry.dimension)).toEqual([
      'diagnosticF1', 'evidenceFidelity', 'anchoring', 'latencyMs', 'humanMean',
    ]);
    expect(result).not.toHaveProperty('winner');
  });
});
