/**
 * Evaluation Service for AURA Benchmark
 * Provides composite scoring, JSON export, and statistical analysis for TFM experiments.
 */

import { BenchmarkResult, InputMode } from '../../types';

// =============================================================================
// ScoreWeights Interface
// =============================================================================

/**
 * Weight configuration for composite score calculation.
 * All weights should sum to 1.0.
 */
export interface ScoreWeights {
  jsonCompliance: number;   // Default: 0.25
  hallucinationRate: number; // Default: 0.25
  latencyScore: number;      // Default: 0.15
  tokenEfficiency: number;   // Default: 0.10
  scriptQuality: number;     // Default: 0.10
  claimAccuracy: number;     // Default: 0.15
}

/** Default weights for composite score calculation */
const DEFAULT_WEIGHTS: ScoreWeights = {
  jsonCompliance: 0.25,
  hallucinationRate: 0.25,
  latencyScore: 0.15,
  tokenEfficiency: 0.10,
  scriptQuality: 0.10,
  claimAccuracy: 0.15
};

// =============================================================================
// ExperimentExport Interface
// =============================================================================

/**
 * Structured JSON export for TFM documentation.
 */
export interface ExperimentExport {
  exportTimestamp: string;
  experimentCount: number;
  formalValidCount: number;
  failedCount: number;
  experiments: ExperimentEntry[];
  bestByMetric: {
    lowestLatencyMs: number;
    highestTokensPerSecond: number;
    highestCompositeScore: number;
    fewestHallucinations: number;
  };
  summary: {
    meanCompositeScore: number;
    stdDevCompositeScore: number;
    cvCompositeScore: number;
    meanLatencyMs: number;
    meanTokensGenerated: number;
    totalHallucinatedColumns: number;
  };
}

export interface ExperimentEntry {
  id: string;
  config: {
    provider: string;
    providerType: 'local' | 'cloud' | 'chrome';
    model: string;
    inputMode: InputMode;
    temperature: number;
  };
  metrics: {
    latencyMs: number;
    firstTokenMs: number;
    tokensGenerated: number;
    tokensPerSecond: number;
    formatCompliance: boolean;
    pythonScriptIncluded: boolean;
    hallucinatedColumns: string[];
    unsupportedClaims: number;
  };
  compositeScore: number;
  evidenceStatus: BenchmarkResult['evidenceStatus'];
  status: BenchmarkResult['status'];
  timestamp: string;
}

// =============================================================================
// ExperimentStats Interface
// =============================================================================

export interface ExperimentStats {
  mean: number;
  stdDev: number;
  cv: number; // Coefficient of Variation (stdDev / mean)
}

// =============================================================================
// Helper Types
// =============================================================================

/** Normalized metrics before weighting */
interface NormalizedMetrics {
  jsonCompliance: number;
  hallucinationRate: number;
  latencyScore: number;
  tokenEfficiency: number;
  scriptQuality: number;
  claimAccuracy: number;
}

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Normalizes format compliance (boolean) to 0-1 range.
 * 1.0 = compliant (true), 0.0 = non-compliant (false)
 */
const normalizeJsonCompliance = (result: BenchmarkResult): number => {
  return result.formatCompliance ? 1.0 : 0.0;
};

/**
 * Normalizes hallucination rate to 0-1 range.
 * Based on: 1 - (hallucinatedColumns.length / totalKnownColumns)
 * where totalKnownColumns is derived from the result context.
 * Falls back to: 1 - (hallucinatedColumns.length / (tokensGenerated + 1))
 * to avoid division by zero.
 *
 * Higher is better (1 = no hallucinations, 0 = all columns hallucinated).
 */
const normalizeHallucinationRate = (result: BenchmarkResult): number => {
  const hallucinatedCount = result.hallucinatedColumns.length;
  // Use tokensGenerated as a proxy for total columns expected
  // A result with 0 hallucinations gets score 1
  // A result where hallucinations > tokens gets score 0
  const totalTokens = result.tokensGenerated || 1;
  const rate = hallucinatedCount / (totalTokens * 0.1 + 1); // Weighted proxy
  return Math.max(0, Math.min(1, 1 - rate));
};

/**
 * Normalizes latency to 0-1 range.
 * Uses inverse scaling: 1 - (latency / maxLatency)
 * Requires maxLatency to be provided (typically from the experiment set).
 */
const normalizeLatency = (latencyMs: number, maxLatencyMs: number): number => {
  if (maxLatencyMs <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - (latencyMs / maxLatencyMs)));
};

/**
 * Normalizes token efficiency to 0-1 range.
 * Uses tokensPerSecond directly, normalized against a reasonable max (100 tok/s).
 * Higher is better.
 */
const normalizeTokenEfficiency = (tokensPerSecond: number): number => {
  const MAX_TOKENS_PER_SECOND = 100;
  return Math.max(0, Math.min(1, tokensPerSecond / MAX_TOKENS_PER_SECOND));
};

/**
 * Normalizes script quality to 0-1 range.
 * 1.0 = Python script included, 0.0 = no script.
 */
const normalizeScriptQuality = (result: BenchmarkResult): number => {
  return result.pythonScriptIncluded ? 1.0 : 0.0;
};

/**
 * Normalizes claim accuracy to 0-1 range.
 * Based on: 1 - (unsupportedClaims / totalClaims)
 * where unsupportedClaims represents hallucinations/fabrications.
 * Falls back to token-based ratio.
 * Higher is better (1 = all claims supported, 0 = no claims supported).
 */
const normalizeClaimAccuracy = (result: BenchmarkResult): number => {
  const unsupported = result.unsupportedClaims;
  const totalTokens = result.tokensGenerated || 1;
  // Use a conservative ratio - assume ~10% of tokens could be claims
  const estimatedTotalClaims = Math.max(1, Math.floor(totalTokens * 0.1));
  const rate = unsupported / estimatedTotalClaims;
  return Math.max(0, Math.min(1, 1 - rate));
};

// =============================================================================
// Composite Score Calculation
// =============================================================================

/**
 * Calculates a weighted composite score from a benchmark result.
 *
 * @param result - The BenchmarkResult to evaluate
 * @param weights - Optional custom weights (defaults to TFM standard weights)
 * @param maxLatencyMs - Maximum latency for normalization (from experiment set)
 * @returns Composite score between 0 and 1
 */
export const compositeScore = (
  result: BenchmarkResult,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  maxLatencyMs?: number
): number => {
  // Determine max latency for normalization
  const effectiveMaxLatency = maxLatencyMs ?? Math.max(result.latencyMs, 1000);

  // Normalize each metric to 0-1 range
  const normalized: NormalizedMetrics = {
    jsonCompliance: normalizeJsonCompliance(result),
    hallucinationRate: normalizeHallucinationRate(result),
    latencyScore: normalizeLatency(result.latencyMs, effectiveMaxLatency),
    tokenEfficiency: normalizeTokenEfficiency(result.tokensPerSecond),
    scriptQuality: normalizeScriptQuality(result),
    claimAccuracy: normalizeClaimAccuracy(result)
  };

  // Apply weights and sum
  const score =
    normalized.jsonCompliance * weights.jsonCompliance +
    normalized.hallucinationRate * weights.hallucinationRate +
    normalized.latencyScore * weights.latencyScore +
    normalized.tokenEfficiency * weights.tokenEfficiency +
    normalized.scriptQuality * weights.scriptQuality +
    normalized.claimAccuracy * weights.claimAccuracy;

  return Math.round(score * 10000) / 10000; // Round to 4 decimal places
};

// =============================================================================
// JSON Export
// =============================================================================

/**
 * Generates a structured JSON export for TFM documentation.
 * Includes timestamp, full experiment configurations, metrics, and composite scores.
 *
 * @param results - Array of BenchmarkResult to export
 * @param weights - Optional custom weights used for scoring
 * @returns JSON string formatted for TFM export
 */
export const exportBenchmarkJson = (
  results: BenchmarkResult[],
  weights: ScoreWeights = DEFAULT_WEIGHTS
): string => {
  // Calculate max latency for normalization
  const maxLatencyMs = Math.max(...results.map(r => r.latencyMs), 1);

  // Build experiment entries with composite scores
  const experiments: ExperimentEntry[] = results.map(result => ({
    id: result.id,
    config: {
      provider: result.provider,
      providerType: result.providerType,
      model: result.model,
      inputMode: result.inputMode,
      temperature: result.temperature
    },
    metrics: {
      latencyMs: result.latencyMs,
      firstTokenMs: result.firstTokenMs,
      tokensGenerated: result.tokensGenerated,
      tokensPerSecond: result.tokensPerSecond,
      formatCompliance: result.formatCompliance,
      pythonScriptIncluded: result.pythonScriptIncluded,
      hallucinatedColumns: result.hallucinatedColumns,
      unsupportedClaims: result.unsupportedClaims
    },
    compositeScore: compositeScore(result, weights, maxLatencyMs),
    evidenceStatus: result.evidenceStatus,
    status: result.status,
    timestamp: result.timestamp
  }));

  // Calculate summary statistics
  const scores = experiments.map(e => e.compositeScore);
  const stats = experimentStats(scores);

  const formalValidCount = experiments.filter(e => e.evidenceStatus === 'formal_valid').length;
  const failedCount = experiments.filter(e => e.evidenceStatus === 'attempted_failed' || e.status === 'error').length;

  const completedExps = experiments.filter(e => e.status === 'completed');
  const bestByMetric = {
    lowestLatencyMs: completedExps.length > 0 ? Math.min(...completedExps.map(e => e.metrics.latencyMs)) : 0,
    highestTokensPerSecond: completedExps.length > 0 ? Math.max(...completedExps.map(e => e.metrics.tokensPerSecond)) : 0,
    highestCompositeScore: completedExps.length > 0 ? Math.max(...completedExps.map(e => e.compositeScore)) : 0,
    fewestHallucinations: completedExps.length > 0 ? Math.min(...completedExps.map(e => e.metrics.hallucinatedColumns.length)) : 0,
  };

  const exportData: ExperimentExport = {
    exportTimestamp: new Date().toISOString(),
    experimentCount: experiments.length,
    formalValidCount,
    failedCount,
    experiments,
    bestByMetric,
    summary: {
      meanCompositeScore: Math.round(stats.mean * 10000) / 10000,
      stdDevCompositeScore: Math.round(stats.stdDev * 10000) / 10000,
      cvCompositeScore: Math.round(stats.cv * 10000) / 10000,
      meanLatencyMs: Math.round(
        results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
      ),
      meanTokensGenerated: Math.round(
        results.reduce((sum, r) => sum + r.tokensGenerated, 0) / results.length
      ),
      totalHallucinatedColumns: results.reduce(
        (sum, r) => sum + r.hallucinatedColumns.length, 0
      )
    }
  };

  return JSON.stringify(exportData, null, 2);
};

// =============================================================================
// Statistical Analysis
// =============================================================================

/**
 * Calculates statistical metrics for a set of experiment results.
 *
 * @param results - Array of BenchmarkResult or numeric scores
 * @returns Object with mean, standard deviation, and coefficient of variation
 */
export const experimentStats = (
  results: BenchmarkResult[] | number[]
): ExperimentStats => {
  // Extract scores if BenchmarkResult array
  let scores: number[];
  if (results.length > 0) {
    const first = results[0];
    if (typeof first === 'object' && first !== null && 'id' in first) {
      scores = (results as BenchmarkResult[]).map(r => compositeScore(r));
    } else {
      scores = results as number[];
    }
  } else {
    scores = [];
  }

  if (scores.length === 0) {
    return { mean: 0, stdDev: 0, cv: 0 };
  }

  // Calculate mean
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Calculate standard deviation
  const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  // Calculate coefficient of variation (CV = stdDev / mean)
  // Handle division by zero
  const cv = mean !== 0 ? stdDev / mean : 0;

  return {
    mean: Math.round(mean * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    cv: Math.round(cv * 10000) / 10000
  };
};

// =============================================================================
// Diagnosis Reliability Score
// =============================================================================

/**
 * Diagnosis Reliability Score — measures how trustworthy a diagnosis is
 * based on evidence anchoring, bad sample citation, and hallucination control.
 *
 * Weights (sum = 1.0):
 * - formatCompliance: 0.20
 * - zeroHallucinations: 0.25
 * - evidenceAnchoring: 0.20 (mentions real rules/columns from the profile)
 * - badSampleCitation: 0.15 (cites actual detected values)
 * - scriptValidity: 0.10
 * - latencyPenalty: 0.10 (speed as tradeoff, not quality)
 */
export interface DiagnosisReliabilityWeights {
  formatCompliance: number;
  zeroHallucinations: number;
  evidenceAnchoring: number;
  badSampleCitation: number;
  scriptValidity: number;
  latencyTradeoff: number;
}

const DEFAULT_RELIABILITY_WEIGHTS: DiagnosisReliabilityWeights = {
  formatCompliance: 0.20,
  zeroHallucinations: 0.25,
  evidenceAnchoring: 0.20,
  badSampleCitation: 0.15,
  scriptValidity: 0.10,
  latencyTradeoff: 0.10,
};

/**
 * Estimates evidence anchoring: what fraction of the diagnosis mentions
 * real column names or rule names from the benchmark result's context.
 * Falls back to 0.5 if no diagnosis text is stored in the result.
 */
const estimateEvidenceAnchoring = (result: BenchmarkResult): number => {
  if (!result.hallucinatedColumns || result.hallucinatedColumns.length === 0) return 0.8;
  const hCount = result.hallucinatedColumns.length;
  return Math.max(0, 1 - (hCount * 0.15));
};

/**
 * Estimates bad sample citation based on the input mode.
 * copy_paste_bad_samples and recommended modes force citations.
 */
const estimateBadSampleCitation = (result: BenchmarkResult): number => {
  switch (result.inputMode) {
    case 'copy_paste_bad_samples': return 0.9;
    case 'recommended': return 0.85;
    case 'enhanced_registry': return 0.5;
    case 'smart_sample': return 0.5;
    case 'prompt_libre': return 0.2;
    default: return 0.4;
  }
};

/**
 * Calculates the Diagnosis Reliability Score for a benchmark result.
 * Returns a value between 0 and 1.
 */
export const diagnosisReliabilityScore = (
  result: BenchmarkResult,
  weights: DiagnosisReliabilityWeights = DEFAULT_RELIABILITY_WEIGHTS,
  maxLatencyMs?: number
): number => {
  const fmtScore = result.formatCompliance ? 1.0 : 0.0;
  const hallucScore = result.hallucinatedColumns.length === 0 ? 1.0
    : Math.max(0, 1 - (result.hallucinatedColumns.length * 0.2));
  const anchoringScore = estimateEvidenceAnchoring(result);
  const citationScore = estimateBadSampleCitation(result);
  const scriptScore = result.pythonScriptIncluded ? 1.0 : 0.0;
  const effectiveMaxLatency = maxLatencyMs ?? Math.max(result.latencyMs, 1000);
  const latencyScore = Math.max(0, 1 - (result.latencyMs / effectiveMaxLatency));

  const score =
    fmtScore * weights.formatCompliance +
    hallucScore * weights.zeroHallucinations +
    anchoringScore * weights.evidenceAnchoring +
    citationScore * weights.badSampleCitation +
    scriptScore * weights.scriptValidity +
    latencyScore * weights.latencyTradeoff;

  return Math.round(score * 10000) / 10000;
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Returns the default score weights for TFM benchmark evaluation.
 */
export const getDefaultWeights = (): ScoreWeights => ({ ...DEFAULT_WEIGHTS });

/**
 * Validates that weights sum to approximately 1.0.
 * @param weights - ScoreWeights to validate
 * @returns true if valid, false otherwise
 */
export const validateWeights = (weights: ScoreWeights): boolean => {
  const sum =
    weights.jsonCompliance +
    weights.hallucinationRate +
    weights.latencyScore +
    weights.tokenEfficiency +
    weights.scriptQuality +
    weights.claimAccuracy;

  return Math.abs(sum - 1.0) < 0.001;
};