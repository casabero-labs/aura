import type { ExperimentAggregation, ExperimentCellSummary } from './experimentAggregation';
import type { OE4InputMode, OE4ModelId } from './finalEvaluationProtocol';

export type DecisionUseCase = 'balanced' | 'diagnostic_quality' | 'reliability' | 'traceability' | 'speed';

export interface ExperimentCellScores {
  cellId: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  accuracy: number | null;
  reliability: number | null;
  contractCompliance: number | null;
  evidenceSupport: number | null;
  hallucinationSafety: number | null;
  efficiency: number | null;
  balanced: number | null;
}

export interface ExperimentRecommendation {
  useCase: DecisionUseCase;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  score: number;
  rationale: string;
}

export interface ExperimentDecisionSupport {
  scores: ExperimentCellScores[];
  recommendations: ExperimentRecommendation[];
  methodology: {
    oracle: string;
    balancedWeights: Record<'accuracy' | 'reliability' | 'contractCompliance' | 'evidenceSupport' | 'hallucinationSafety' | 'efficiency', number>;
    note: string;
  };
}

const BALANCED_WEIGHTS = {
  accuracy: 0.35,
  reliability: 0.20,
  contractCompliance: 0.15,
  evidenceSupport: 0.15,
  hallucinationSafety: 0.10,
  efficiency: 0.05,
} as const;

const percent = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : (numerator / denominator) * 100;

const toPercent = (value: number | null): number | null => value === null ? null : value * 100;

const meanAvailable = (values: readonly (number | null)[]): number | null => {
  const measured = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return measured.length === 0
    ? null
    : measured.reduce((sum, value) => sum + value, 0) / measured.length;
};

const weightedAvailable = (
  values: Record<keyof typeof BALANCED_WEIGHTS, number | null>,
): number | null => {
  const measured = (Object.keys(BALANCED_WEIGHTS) as Array<keyof typeof BALANCED_WEIGHTS>)
    .filter((key) => values[key] !== null);
  const weight = measured.reduce((sum, key) => sum + BALANCED_WEIGHTS[key], 0);
  if (weight === 0) return null;
  return measured.reduce((sum, key) => sum + ((values[key] ?? 0) * BALANCED_WEIGHTS[key]), 0) / weight;
};

const scoreCell = (cell: ExperimentCellSummary, fastestMedianMs: number | null): ExperimentCellScores => {
  const accuracy = toPercent(cell.diagnosticF1.mean);
  const reliability = percent(cell.completedRuns, cell.attemptedRuns);
  const contractCompliance = percent(cell.contractCompliantRuns, cell.completedRuns);
  const evidenceSupport = meanAvailable([
    toPercent(cell.evidenceFidelity.mean),
    toPercent(cell.anchoring.mean),
  ]);
  const hallucinationSafety = percent(cell.hallucinationFreeRuns, cell.completedRuns);
  const latency = cell.totalLatencyMs.median;
  const efficiency = fastestMedianMs === null || latency === null || latency <= 0
    ? null
    : Math.min(100, (fastestMedianMs / latency) * 100);
  const balanced = weightedAvailable({
    accuracy,
    reliability,
    contractCompliance,
    evidenceSupport,
    hallucinationSafety,
    efficiency,
  });
  return {
    cellId: cell.cellId,
    modelId: cell.modelId,
    inputMode: cell.inputMode,
    accuracy,
    reliability,
    contractCompliance,
    evidenceSupport,
    hallucinationSafety,
    efficiency,
    balanced,
  };
};

const choose = (
  scores: readonly ExperimentCellScores[],
  useCase: DecisionUseCase,
  selector: (score: ExperimentCellScores) => number | null,
  rationale: string,
): ExperimentRecommendation | null => {
  const ranked = scores
    .map((score) => ({ score, value: selector(score) }))
    .filter((entry): entry is { score: ExperimentCellScores; value: number } => entry.value !== null)
    .sort((left, right) => right.value - left.value
      || (right.score.reliability ?? -1) - (left.score.reliability ?? -1)
      || (right.score.accuracy ?? -1) - (left.score.accuracy ?? -1)
      || left.score.cellId.localeCompare(right.score.cellId));
  const selected = ranked[0];
  return selected ? {
    useCase,
    modelId: selected.score.modelId,
    inputMode: selected.score.inputMode,
    score: selected.value,
    rationale,
  } : null;
};

export const buildExperimentDecisionSupport = (
  aggregation: ExperimentAggregation,
): ExperimentDecisionSupport => {
  const measuredLatencies = aggregation.matrix.cells
    .map((cell) => cell.totalLatencyMs.median)
    .filter((value): value is number => value !== null && value > 0);
  const fastestMedianMs = measuredLatencies.length === 0 ? null : Math.min(...measuredLatencies);
  const scores = aggregation.matrix.cells.map((cell) => scoreCell(cell, fastestMedianMs));
  const recommendations = [
    choose(scores, 'balanced', (score) => score.balanced, 'Mejor equilibrio entre calidad, estabilidad, contrato, evidencia, seguridad y velocidad.'),
    choose(scores, 'diagnostic_quality', (score) => score.accuracy, 'Mayor F1 medio frente al oráculo controlado.'),
    choose(scores, 'reliability', (score) => score.reliability, 'Mayor proporción de diagnósticos válidos entre las corridas intentadas.'),
    choose(scores, 'traceability', (score) => score.evidenceSupport, 'Mayor soporte y anclaje a la evidencia visible del método de entrada.'),
    choose(scores, 'speed', (score) => score.efficiency, 'Menor latencia mediana relativa dentro de esta campaña y este hardware.'),
  ].filter((entry): entry is ExperimentRecommendation => entry !== null);

  return {
    scores,
    recommendations,
    methodology: {
      oracle: 'Coincidencia exacta ruleId + columnId + scope contra el oráculo congelado del dataset controlado.',
      balancedWeights: { ...BALANCED_WEIGHTS },
      note: 'El índice equilibrado repondera únicamente las dimensiones medibles. Es ayuda de decisión para esta campaña, no una afirmación de superioridad universal.',
    },
  };
};
