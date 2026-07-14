import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from './finalEvaluationProtocol';
import type { ExperimentRunV1 } from './experimentTypes';

export interface DescriptiveStats {
  count: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
}

export interface ExperimentCellSummary {
  cellId: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  runCount: number;
  attemptedRuns: number;
  completedRuns: number;
  failedRuns: number;
  attemptEventCount: number;
  diagnosticF1: DescriptiveStats;
  evidenceFidelity: DescriptiveStats;
  anchoring: DescriptiveStats;
  totalLatencyMs: DescriptiveStats;
  outputTokens: DescriptiveStats;
  contractCompliantRuns: number;
  hallucinationCount: number;
  hallucinationFreeRuns: number;
}

export interface DimensionBestResult {
  dimension: 'diagnosticF1' | 'evidenceFidelity' | 'anchoring' | 'latencyMs';
  direction: 'higher' | 'lower';
  runId: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  repetition: number;
  value: number;
}

export interface ExperimentAggregation {
  matrix: {
    models: number;
    inputModes: number;
    repetitions: number;
    expectedRuns: number;
    observedRuns: number;
    cells: ExperimentCellSummary[];
  };
  totals: {
    attemptedRuns: number;
    completedRuns: number;
    failedRuns: number;
    runsWithAutomaticEvaluation: number;
  };
  overall: {
    diagnosticF1: DescriptiveStats;
    evidenceFidelity: DescriptiveStats;
    anchoring: DescriptiveStats;
    totalLatencyMs: DescriptiveStats;
    outputTokens: DescriptiveStats;
  };
  bestByDimension: DimensionBestResult[];
}

const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

export const descriptiveStats = (values: readonly number[]): DescriptiveStats => {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) {
    return { count: 0, mean: null, median: null, stdDev: null, min: null, max: null };
  }
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const midpoint = Math.floor(finite.length / 2);
  const median = finite.length % 2 === 0
    ? (finite[midpoint - 1] + finite[midpoint]) / 2
    : finite[midpoint];
  const variance = finite.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / finite.length;
  return {
    count: finite.length,
    mean: round(mean),
    median: round(median),
    stdDev: round(Math.sqrt(variance)),
    min: finite[0],
    max: finite.at(-1) ?? finite[0],
  };
};

const totalLatencyMs = (run: ExperimentRunV1): number | null =>
  run.diagnosis?.status === 'completed' ? run.diagnosis.metrics?.totalDurationMs ?? null : null;

const outputTokens = (run: ExperimentRunV1): number | null =>
  run.diagnosis?.status === 'completed' ? run.diagnosis.metrics?.outputTokens ?? null : null;

const numbers = (
  runs: readonly ExperimentRunV1[],
  selector: (run: ExperimentRunV1) => number | null | undefined,
): number[] => runs.map(selector).filter((value): value is number =>
  typeof value === 'number' && Number.isFinite(value));

const isAttempted = (run: ExperimentRunV1): boolean =>
  !['planned', 'running'].includes(run.status);

const isCompletedOutput = (run: ExperimentRunV1): boolean =>
  run.diagnosis?.status === 'completed';

const summarizeCell = (
  modelId: OE4ModelId,
  inputMode: OE4InputMode,
  runs: readonly ExperimentRunV1[],
): ExperimentCellSummary => ({
  cellId: `cell:${modelId}:${inputMode}`,
  modelId,
  inputMode,
  runCount: runs.length,
  attemptedRuns: runs.filter(isAttempted).length,
  completedRuns: runs.filter(isCompletedOutput).length,
  failedRuns: runs.filter((run) => run.status === 'failed').length,
  attemptEventCount: runs.reduce((sum, run) => sum + run.attempts.length, 0),
  diagnosticF1: descriptiveStats(numbers(runs, (run) => run.automaticEvaluation?.diagnosis.primary.f1)),
  evidenceFidelity: descriptiveStats(numbers(runs, (run) => run.automaticEvaluation?.diagnosis.evidenceFidelity)),
  anchoring: descriptiveStats(numbers(runs, (run) => run.automaticEvaluation?.diagnosis.anchoringScore)),
  totalLatencyMs: descriptiveStats(numbers(runs, totalLatencyMs)),
  outputTokens: descriptiveStats(numbers(runs, outputTokens)),
  contractCompliantRuns: runs.filter((run) => run.automaticEvaluation?.diagnosis.contractCompliant).length,
  hallucinationCount: runs.reduce((sum, run) => sum
    + (run.automaticEvaluation?.diagnosis.inventedColumns.length ?? 0)
    + (run.automaticEvaluation?.diagnosis.unsupportedClaims.length ?? 0), 0),
  hallucinationFreeRuns: runs.filter((run) => {
    const diagnosis = run.automaticEvaluation?.diagnosis;
    return diagnosis !== undefined
      && diagnosis.inventedColumns.length === 0
      && diagnosis.unsupportedClaims.length === 0;
  }).length,
});

const best = (
  runs: readonly ExperimentRunV1[],
  dimension: DimensionBestResult['dimension'],
  direction: DimensionBestResult['direction'],
  selector: (run: ExperimentRunV1) => number | null | undefined,
): DimensionBestResult | null => {
  const candidates = runs
    .map((run) => ({ run, value: selector(run) }))
    .filter((entry): entry is { run: ExperimentRunV1; value: number } =>
      typeof entry.value === 'number' && Number.isFinite(entry.value));
  candidates.sort((left, right) => {
    const metricOrder = direction === 'higher'
      ? right.value - left.value
      : left.value - right.value;
    return metricOrder || left.run.sequence - right.run.sequence || left.run.runId.localeCompare(right.run.runId);
  });
  const selected = candidates[0];
  return selected === undefined ? null : {
    dimension,
    direction,
    runId: selected.run.runId,
    modelId: selected.run.modelId,
    inputMode: selected.run.inputMode,
    repetition: selected.run.repetition,
    value: selected.value,
  };
};

export const aggregateExperimentRuns = (
  runs: readonly ExperimentRunV1[],
): ExperimentAggregation => {
  const sortedRuns = [...runs].sort((left, right) => left.sequence - right.sequence);
  const cells = FINAL_EVALUATION_PROTOCOL.models.flatMap((modelId) =>
    FINAL_EVALUATION_PROTOCOL.inputModes.map((inputMode) => summarizeCell(
      modelId,
      inputMode,
      sortedRuns.filter((run) => run.modelId === modelId && run.inputMode === inputMode),
    )));
  const bestByDimension = [
    best(sortedRuns, 'diagnosticF1', 'higher', (run) => run.automaticEvaluation?.diagnosis.primary.f1),
    best(sortedRuns, 'evidenceFidelity', 'higher', (run) => run.automaticEvaluation?.diagnosis.evidenceFidelity),
    best(sortedRuns, 'anchoring', 'higher', (run) => run.automaticEvaluation?.diagnosis.anchoringScore),
    best(sortedRuns, 'latencyMs', 'lower', totalLatencyMs),
  ].filter((entry): entry is DimensionBestResult => entry !== null);

  return {
    matrix: {
      models: FINAL_EVALUATION_PROTOCOL.models.length,
      inputModes: FINAL_EVALUATION_PROTOCOL.inputModes.length,
      repetitions: FINAL_EVALUATION_PROTOCOL.repetitions,
      expectedRuns: FINAL_EVALUATION_PROTOCOL.matrix.units,
      observedRuns: sortedRuns.length,
      cells,
    },
    totals: {
      attemptedRuns: sortedRuns.filter(isAttempted).length,
      completedRuns: sortedRuns.filter(isCompletedOutput).length,
      failedRuns: sortedRuns.filter((run) => run.status === 'failed').length,
      runsWithAutomaticEvaluation: sortedRuns.filter((run) => run.automaticEvaluation !== null).length,
    },
    overall: {
      diagnosticF1: descriptiveStats(numbers(sortedRuns, (run) => run.automaticEvaluation?.diagnosis.primary.f1)),
      evidenceFidelity: descriptiveStats(numbers(sortedRuns, (run) => run.automaticEvaluation?.diagnosis.evidenceFidelity)),
      anchoring: descriptiveStats(numbers(sortedRuns, (run) => run.automaticEvaluation?.diagnosis.anchoringScore)),
      totalLatencyMs: descriptiveStats(numbers(sortedRuns, totalLatencyMs)),
      outputTokens: descriptiveStats(numbers(sortedRuns, outputTokens)),
    },
    bestByDimension,
  };
};
