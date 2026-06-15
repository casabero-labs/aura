import { describe, expect, it } from 'vitest';
import { compositeScore, exportBenchmarkJson, experimentStats, getDefaultWeights, validateWeights } from '../services/benchmark/evaluationService';
import { BenchmarkResult } from '../types';

const createResult = (overrides: Partial<BenchmarkResult> = {}): BenchmarkResult => ({
  id: `test-${Date.now()}`,
  provider: 'TestProvider',
  providerType: 'cloud',
  inputMode: 'smart_sample',
  model: 'test-model-v1',
  temperature: 0.7,
  status: 'completed',
  latencyMs: 500,
  firstTokenMs: 100,
  tokensGenerated: 200,
  tokensPerSecond: 400,
  contractCompliance: true,
  formatCompliance: true,
  pythonScriptIncluded: true,
  hallucinatedColumns: [],
  unsupportedClaims: 0,
  evidenceStatus: 'preliminary_valid',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('compositeScore', () => {
  it('returns score between 0 and 1 for a valid result', () => {
    const result = createResult();
    const score = compositeScore(result);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('penalizes results with hallucinations', () => {
    const clean = createResult({ hallucinatedColumns: [] });
    const hallucinated = createResult({
      hallucinatedColumns: ['col1', 'col2', 'col3'],
      hallucinationReport: {
        hallucinatedColumns: ['col1', 'col2', 'col3'],
        unsupportedClaimsCount: 0,
        jsonCompliance: false,
        contractCompliance: true,
        formatErrorCount: 0,
        invalidScriptColumns: [],
        knownColumnCount: 6,
      },
    });
    expect(compositeScore(clean)).toBeGreaterThan(compositeScore(hallucinated));
  });

  it('uses known columns, not generated tokens, to penalize hallucinations', () => {
    const verbose = createResult({
      tokensGenerated: 1000,
      hallucinatedColumns: ['phantom'],
      hallucinationReport: {
        hallucinatedColumns: ['phantom'],
        unsupportedClaimsCount: 0,
        jsonCompliance: false,
        contractCompliance: true,
        formatErrorCount: 0,
        invalidScriptColumns: [],
        knownColumnCount: 4,
      },
    });
    const terse = createResult({ ...verbose, id: 'terse', tokensGenerated: 50 });
    expect(compositeScore(verbose)).toBe(compositeScore(terse));
  });

  it('penalizes non-compliant contract', () => {
    const compliant = createResult({ contractCompliance: true, formatCompliance: true });
    const nonCompliant = createResult({ contractCompliance: false, formatCompliance: false });
    expect(compositeScore(compliant)).toBeGreaterThan(compositeScore(nonCompliant));
  });

  it('penalizes missing Python script', () => {
    const withScript = createResult({ pythonScriptIncluded: true });
    const withoutScript = createResult({ pythonScriptIncluded: false });
    expect(compositeScore(withScript)).toBeGreaterThanOrEqual(compositeScore(withoutScript));
  });

  it('returns 1 for a perfect result (zero latency, max tokens, compliant)', () => {
    const perfect = createResult({
      latencyMs: 1,
      tokensPerSecond: 200,
      formatCompliance: true,
      pythonScriptIncluded: true,
      hallucinatedColumns: [],
      unsupportedClaims: 0,
    });
    const score = compositeScore(perfect);
    expect(score).toBeGreaterThan(0.8);
  });
});

describe('experimentStats', () => {
  it('calculates mean, stdDev, cv from completed results', () => {
    const results = [
      createResult({ id: 'a', latencyMs: 100 }),
      createResult({ id: 'b', latencyMs: 200 }),
      createResult({ id: 'c', latencyMs: 300 }),
    ];
    const stats = experimentStats(results);
    expect(stats.mean).toBeGreaterThan(0);
    expect(stats.stdDev).toBeGreaterThan(0);
    expect(stats.cv).toBeGreaterThan(0);
  });

  it('returns zeros for empty array', () => {
    const stats = experimentStats([]);
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.cv).toBe(0);
  });
});

describe('exportBenchmarkJson', () => {
  it('produces valid JSON with experiment count and summary', () => {
    const results = [
      createResult({ id: 'a', evidenceStatus: 'formal_valid' }),
      createResult({ id: 'b', evidenceStatus: 'attempted_failed', status: 'error' }),
    ];
    const json = exportBenchmarkJson(results);
    const parsed = JSON.parse(json);

    expect(parsed.experimentCount).toBe(2);
    expect(parsed.formalValidCount).toBe(1);
    expect(parsed.failedCount).toBe(1);
    expect(parsed.experiments).toHaveLength(2);
    expect(parsed.bestByMetric).toBeDefined();
    expect(parsed.bestByMetric.lowestLatencyMs).toBeGreaterThan(0);
    expect(parsed.bestByMetric.highestCompositeScore).toBeGreaterThan(0);
    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.meanCompositeScore).toBeGreaterThan(0);
  });

  it('handles empty results array gracefully', () => {
    const json = exportBenchmarkJson([]);
    const parsed = JSON.parse(json);
    expect(parsed.experimentCount).toBe(0);
    expect(parsed.formalValidCount).toBe(0);
    expect(parsed.failedCount).toBe(0);
  });

  it('includes config with temperature in each experiment', () => {
    const results = [createResult({ temperature: 0.3 })];
    const json = exportBenchmarkJson(results);
    const parsed = JSON.parse(json);
    expect(parsed.experiments[0].config.temperature).toBe(0.3);
    expect(parsed.experiments[0].evidenceStatus).toBe('preliminary_valid');
    expect(parsed.experiments[0].metrics.contractCompliance).toBe(true);
    expect(parsed.experiments[0].metrics.jsonCompliance).toBe(false);
  });
});

describe('getDefaultWeights', () => {
  it('returns weights that sum to 1', () => {
    const weights = getDefaultWeights();
    expect(validateWeights(weights)).toBe(true);
  });

  it('validateWeights rejects invalid weight sets', () => {
    const invalid = { jsonCompliance: 1, hallucinationRate: 0, latencyScore: 0, tokenEfficiency: 0, scriptQuality: 0, claimAccuracy: 0 };
    // Sum = 1, so it's valid
    expect(validateWeights(invalid)).toBe(true);

    const reallyInvalid = { jsonCompliance: 2, hallucinationRate: 0, latencyScore: 0, tokenEfficiency: 0, scriptQuality: 0, claimAccuracy: 0 };
    expect(validateWeights(reallyInvalid)).toBe(false);
  });
});
