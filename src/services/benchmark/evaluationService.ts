/**
 * Evaluation Service for AURA Benchmark
 * Provides composite scoring, JSON export, and statistical analysis for TFM experiments.
 */

import { BenchmarkResult, InputMode } from '../../types';
import type { AutomaticEvaluationV1, HumanReviewV1, LlmStageResultV1 } from './experimentTypes';
import type { DiagnosticOracleEvaluation } from './diagnosticOracleEvaluator';
import type { ScriptOracleEvaluation } from './scriptOracleEvaluator';
import { FINAL_EVALUATION_PROTOCOL } from './finalEvaluationProtocol';

// =============================================================================
// ScoreWeights Interface
// =============================================================================

/**
 * Weight configuration for composite score calculation.
 * All weights should sum to 1.0.
 */
export interface ScoreWeights {
  contractCompliance?: number; // Default: 0.25
  /** @deprecated Use contractCompliance. JSON real se reporta por separado. */
  jsonCompliance?: number;
  hallucinationRate: number;   // Default: 0.25
  latencyScore: number;        // Default: 0.15
  tokenEfficiency: number;     // Default: 0.10
  scriptQuality: number;       // Default: 0.10
  claimAccuracy: number;       // Default: 0.15
}

/** Default weights for composite score calculation */
const DEFAULT_WEIGHTS: ScoreWeights = {
  contractCompliance: 0.25,
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
    highestExploratoryCompositeScore: number;
    fewestHallucinations: number;
  };
  summary: {
    meanExploratoryCompositeScore: number;
    stdDevExploratoryCompositeScore: number;
    cvExploratoryCompositeScore: number;
    meanLatencyMs: number;
    meanTokensGenerated: number;
    totalHallucinatedColumns: number;
  };
}

export interface ExperimentEntry {
  id: string;
  config: {
    provider: string;
    providerType: 'local' | 'cloud' | 'chrome' | 'ollama' | 'webllm_experimental';
    model: string;
    inputMode: InputMode;
    temperature: number;
  };
  metrics: {
    latencyMs: number;
    firstTokenMs: number;
    tokensGenerated: number;
    tokensPerSecond: number;
    contractCompliance: boolean;
    jsonCompliance: boolean;
    /** @deprecated Alias historico de contractCompliance. */
    formatCompliance: boolean;
    pythonScriptIncluded: boolean;
    hallucinatedColumns: string[];
    unsupportedClaims: number;
    evidenceAnchoringScore?: number;
    badSampleCitationScore?: number;
  };
  exploratoryCompositeScore: number;
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
  contractCompliance: number;
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
 * Normalizes contract compliance (boolean) to 0-1 range.
 * 1.0 = compliant (true), 0.0 = non-compliant (false)
 */
const hasContractCompliance = (result: BenchmarkResult): boolean =>
  result.contractCompliance ?? result.formatCompliance;

const normalizeContractCompliance = (result: BenchmarkResult): number => {
  return hasContractCompliance(result) ? 1.0 : 0.0;
};

/**
 * Normalizes hallucination rate to 0-1 range.
 * Based on: 1 - (hallucinatedColumns.length / totalKnownColumns)
 * where totalKnownColumns is derived from the result context.
 * If the benchmark result does not carry knownColumnCount, the fallback is
 * intentionally strict: any hallucinated columns consume the whole basis.
 *
 * Higher is better (1 = no hallucinations, 0 = all columns hallucinated).
 */
const normalizeHallucinationRate = (result: BenchmarkResult): number => {
  const hallucinatedCount = result.hallucinatedColumns.length;
  if (hallucinatedCount === 0) return 1;
  const knownColumnCount = result.hallucinationReport?.knownColumnCount;
  const basis = knownColumnCount && knownColumnCount > 0
    ? knownColumnCount
    : hallucinatedCount;
  const rate = hallucinatedCount / basis;
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
  const contractWeight = weights.contractCompliance ?? weights.jsonCompliance ?? 0.25;
  // Determine max latency for normalization
  const effectiveMaxLatency = maxLatencyMs ?? Math.max(result.latencyMs, 1000);

  // Normalize each metric to 0-1 range
  const normalized: NormalizedMetrics = {
    contractCompliance: normalizeContractCompliance(result),
    hallucinationRate: normalizeHallucinationRate(result),
    latencyScore: normalizeLatency(result.latencyMs, effectiveMaxLatency),
    tokenEfficiency: normalizeTokenEfficiency(result.tokensPerSecond),
    scriptQuality: normalizeScriptQuality(result),
    claimAccuracy: normalizeClaimAccuracy(result)
  };

  // Apply weights and sum
  const score =
    normalized.contractCompliance * contractWeight +
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
      contractCompliance: hasContractCompliance(result),
      jsonCompliance: Boolean(result.hallucinationReport?.jsonCompliance),
      formatCompliance: result.formatCompliance,
      pythonScriptIncluded: result.pythonScriptIncluded,
      hallucinatedColumns: result.hallucinatedColumns,
      unsupportedClaims: result.unsupportedClaims,
      evidenceAnchoringScore: result.hallucinationReport?.evidenceAnchoringScore,
      badSampleCitationScore: result.hallucinationReport?.badSampleCitationScore
    },
    exploratoryCompositeScore: compositeScore(result, weights, maxLatencyMs),
    evidenceStatus: result.evidenceStatus,
    status: result.status,
    timestamp: result.timestamp
  }));

  // Calculate summary statistics
  const scores = experiments.map(e => e.exploratoryCompositeScore);
  const stats = experimentStats(scores);

  const formalValidCount = experiments.filter(e => e.evidenceStatus === 'formal_valid').length;
  const failedCount = experiments.filter(e => e.evidenceStatus === 'attempted_failed' || e.status === 'error').length;

  const completedExps = experiments.filter(e => e.status === 'completed');
  const bestByMetric = {
    lowestLatencyMs: completedExps.length > 0 ? Math.min(...completedExps.map(e => e.metrics.latencyMs)) : 0,
    highestTokensPerSecond: completedExps.length > 0 ? Math.max(...completedExps.map(e => e.metrics.tokensPerSecond)) : 0,
    highestExploratoryCompositeScore: completedExps.length > 0
      ? Math.max(...completedExps.map(e => e.exploratoryCompositeScore))
      : 0,
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
      meanExploratoryCompositeScore: Math.round(stats.mean * 10000) / 10000,
      stdDevExploratoryCompositeScore: Math.round(stats.stdDev * 10000) / 10000,
      cvExploratoryCompositeScore: Math.round(stats.cv * 10000) / 10000,
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
// OE4 formal evaluation — independent dimensions
// =============================================================================

export interface OperationEvaluation {
  latency: {
    totalMs: number | null;
    diagnosisMs: number | null;
    scriptMs: number | null;
  };
  tokens: {
    prompt: number | null;
    output: number | null;
    reasoning: number | null;
  };
  errors: {
    count: number;
    codes: string[];
  };
  stability: {
    completedStages: number;
    expectedStages: number;
    score: number;
  };
}

export interface FormalRunEvaluationInput {
  evaluatedAt: string;
  diagnosis: DiagnosticOracleEvaluation;
  script: ScriptOracleEvaluation;
  stages: readonly LlmStageResultV1[];
  humanReview?: HumanReviewV1 | null;
  exploratoryCompositeScore?: number | null;
}

export interface FormalRunEvaluation {
  diagnosis: DiagnosticOracleEvaluation;
  operation: OperationEvaluation;
  script: ScriptOracleEvaluation;
  human: Pick<HumanReviewV1, 'clarity' | 'traceability' | 'actionability' | 'mean'> | null;
  exploratoryCompositeScore: number | null;
  automaticEvaluation: AutomaticEvaluationV1;
}

const sumNullable = (values: readonly (number | null)[]): number | null => {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((sum, value) => sum + value, 0);
};

export const evaluateOperation = (
  stages: readonly LlmStageResultV1[],
): OperationEvaluation => {
  const diagnosis = stages.find((stage) => stage.stage === 'diagnosis');
  const script = stages.find((stage) => stage.stage === 'script');
  const measuredStages = FINAL_EVALUATION_PROTOCOL.matrix.stagesPerUnit === 1
    ? [diagnosis]
    : [diagnosis, script];
  const stageMetrics = measuredStages.map((stage) => stage?.metrics ?? null);
  const completedStages = measuredStages
    .filter((stage) => stage?.status === 'completed').length;
  const failedStages = measuredStages
    .filter((stage) => stage === undefined || stage.status !== 'completed');
  const codes = [...new Set(failedStages
    .map((stage) => stage?.error?.code ?? `stage_${stage?.status ?? 'missing'}`))]
    .sort((left, right) => left.localeCompare(right));

  return {
    latency: {
      totalMs: sumNullable(stageMetrics.map((metrics) => metrics?.totalDurationMs ?? null)),
      diagnosisMs: diagnosis?.metrics?.totalDurationMs ?? null,
      scriptMs: script?.metrics?.totalDurationMs ?? null,
    },
    tokens: {
      prompt: sumNullable(stageMetrics.map((metrics) => metrics?.promptTokens ?? null)),
      output: sumNullable(stageMetrics.map((metrics) => metrics?.outputTokens ?? null)),
      reasoning: sumNullable(stageMetrics.map((metrics) => metrics?.reasoningTokens ?? null)),
    },
    errors: { count: failedStages.length, codes },
    stability: {
      completedStages,
      expectedStages: FINAL_EVALUATION_PROTOCOL.matrix.stagesPerUnit,
      score: completedStages / FINAL_EVALUATION_PROTOCOL.matrix.stagesPerUnit,
    },
  };
};

export const buildFormalRunEvaluation = (
  input: FormalRunEvaluationInput,
): FormalRunEvaluation => {
  const exploratory = input.exploratoryCompositeScore ?? null;
  if (exploratory !== null && (!Number.isFinite(exploratory) || exploratory < 0 || exploratory > 1)) {
    throw new Error('exploratoryCompositeScore must be within 0–1 or null');
  }

  const automaticEvaluation: AutomaticEvaluationV1 = {
    contractId: 'aura.automatic-evaluation.v1',
    evaluatedAt: input.evaluatedAt,
    diagnosis: {
      primary: input.diagnosis.primary,
      engineCoverage: input.diagnosis.engineCoverage,
      evidenceFidelity: input.diagnosis.evidenceFidelity,
      extendedDiscoveryKeys: input.diagnosis.extendedDiscoveryKeys,
      contractCompliant: input.diagnosis.contract.compliant,
      inventedColumns: input.diagnosis.hallucinations.inventedColumns,
      unsupportedClaims: input.diagnosis.hallucinations.unsupportedClaims,
      anchoringScore: input.diagnosis.anchoring.score,
    },
    script: {
      contractValid: input.script.contractValid,
      syntaxValid: input.script.syntaxValid,
      safe: input.script.safe,
      coveredActions: input.script.coveredActions,
      missingActions: input.script.missingActions,
      unsupportedActions: input.script.unsupportedActions,
    },
  };

  const human = input.humanReview === undefined || input.humanReview === null
    ? null
    : {
      clarity: input.humanReview.clarity,
      traceability: input.humanReview.traceability,
      actionability: input.humanReview.actionability,
      mean: input.humanReview.mean,
    };

  return {
    diagnosis: input.diagnosis,
    operation: evaluateOperation(input.stages),
    script: input.script,
    human,
    exploratoryCompositeScore: exploratory,
    automaticEvaluation,
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
 * - contractCompliance: 0.20
 * - zeroHallucinations: 0.25
 * - evidenceAnchoring: 0.20 (mentions real rules/columns from the profile)
 * - badSampleCitation: 0.15 (cites actual detected values)
 * - scriptValidity: 0.10
 * - latencyPenalty: 0.10 (speed as tradeoff, not quality)
 */
export interface DiagnosisReliabilityWeights {
  contractCompliance?: number;
  /** @deprecated Use contractCompliance. */
  formatCompliance?: number;
  zeroHallucinations: number;
  evidenceAnchoring: number;
  badSampleCitation: number;
  scriptValidity: number;
  latencyTradeoff: number;
}

const DEFAULT_RELIABILITY_WEIGHTS: DiagnosisReliabilityWeights = {
  contractCompliance: 0.20,
  formatCompliance: 0.20,
  zeroHallucinations: 0.25,
  evidenceAnchoring: 0.20,
  badSampleCitation: 0.15,
  scriptValidity: 0.10,
  latencyTradeoff: 0.10,
};

/**
 * Uses observed evidence anchoring computed by hallucinationDetector.
 * No credit is granted just because a mode is expected to be better.
 */
const estimateEvidenceAnchoring = (result: BenchmarkResult): number => {
  return result.hallucinationReport?.evidenceAnchoringScore ?? 0;
};

/**
 * Uses observed bad-sample citations computed by hallucinationDetector.
 */
const estimateBadSampleCitation = (result: BenchmarkResult): number => {
  return result.hallucinationReport?.badSampleCitationScore ?? 0;
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
  const complianceWeight = weights.contractCompliance ?? weights.formatCompliance ?? 0.20;
  const fmtScore = hasContractCompliance(result) ? 1.0 : 0.0;
  const hallucScore = result.hallucinatedColumns.length === 0 ? 1.0
    : Math.max(0, 1 - (result.hallucinatedColumns.length * 0.2));
  const anchoringScore = estimateEvidenceAnchoring(result);
  const citationScore = estimateBadSampleCitation(result);
  const scriptScore = result.pythonScriptIncluded ? 1.0 : 0.0;
  const effectiveMaxLatency = maxLatencyMs ?? Math.max(result.latencyMs, 1000);
  const latencyScore = Math.max(0, 1 - (result.latencyMs / effectiveMaxLatency));

  const score =
    fmtScore * complianceWeight +
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
    (weights.contractCompliance ?? weights.jsonCompliance ?? 0) +
    weights.hallucinationRate +
    weights.latencyScore +
    weights.tokenEfficiency +
    weights.scriptQuality +
    weights.claimAccuracy;

  return Math.abs(sum - 1.0) < 0.001;
};
