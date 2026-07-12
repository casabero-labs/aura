import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from './finalEvaluationProtocol';
import type { ExperimentRunV1 } from './experimentTypes';

export interface CellRepresentative {
  cellId: string;
  runId: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  repetition: 1 | 2 | 3 | 4 | 5;
  f1: number;
  executionEligible: boolean;
  selectionStatus: 'selected' | 'blocked';
  blockReasons: string[];
  run: ExperimentRunV1;
}

export class RepresentativeSelectionError extends Error {
  constructor(message: string) {
    super(`REPRESENTATIVE_SELECTION_INVALID: ${message}`);
    this.name = 'RepresentativeSelectionError';
  }
}

const cellId = (modelId: OE4ModelId, inputMode: OE4InputMode): string =>
  `cell:${modelId}:${inputMode}`;

const executionBlockReasons = (run: ExperimentRunV1): string[] => {
  const reasons: string[] = [];
  if (run.diagnosis?.status !== 'completed') reasons.push('diagnosis is not completed');
  if (run.automaticEvaluation === null) reasons.push('automatic evaluation is missing');
  if (run.humanReview === null) reasons.push('human review is missing');
  return reasons;
};

const f1For = (run: ExperimentRunV1): number => {
  const f1 = run.automaticEvaluation?.diagnosis.primary.f1;
  if (f1 === undefined || !Number.isFinite(f1) || f1 < 0 || f1 > 1) {
    throw new RepresentativeSelectionError(`run ${run.runId} has no valid primary F1`);
  }
  return f1;
};

export const selectCellRepresentative = (
  runs: readonly ExperimentRunV1[],
): CellRepresentative => {
  if (runs.length !== FINAL_EVALUATION_PROTOCOL.repetitions) {
    throw new RepresentativeSelectionError('each cell must contain exactly five repetitions');
  }
  const [first] = runs;
  if (first === undefined) throw new RepresentativeSelectionError('cell is empty');
  if (runs.some((run) => run.modelId !== first.modelId || run.inputMode !== first.inputMode)) {
    throw new RepresentativeSelectionError('all runs in a cell must share modelId and inputMode');
  }
  const repetitions = runs.map((run) => run.repetition).sort((left, right) => left - right);
  if (new Set(repetitions).size !== 5 || repetitions.some((value, index) => value !== index + 1)) {
    throw new RepresentativeSelectionError('cell repetitions must be unique and equal 1–5');
  }

  const scored = runs.map((run) => ({ run, f1: f1For(run) }));
  const orderedScores = scored.map(({ f1 }) => f1).sort((left, right) => left - right);
  const medianF1 = orderedScores[Math.floor(orderedScores.length / 2)];
  const selected = scored
    .filter(({ f1 }) => f1 === medianF1)
    .sort((left, right) => left.run.repetition - right.run.repetition)[0];
  if (selected === undefined) throw new RepresentativeSelectionError('median run could not be selected');
  const blockReasons = executionBlockReasons(selected.run);

  return {
    cellId: cellId(selected.run.modelId, selected.run.inputMode),
    runId: selected.run.runId,
    modelId: selected.run.modelId,
    inputMode: selected.run.inputMode,
    repetition: selected.run.repetition,
    f1: selected.f1,
    executionEligible: blockReasons.length === 0,
    selectionStatus: blockReasons.length === 0 ? 'selected' : 'blocked',
    blockReasons,
    run: structuredClone(selected.run),
  };
};

export const selectCampaignRepresentatives = (
  runs: readonly ExperimentRunV1[],
): CellRepresentative[] => {
  if (runs.length !== FINAL_EVALUATION_PROTOCOL.matrix.units) {
    throw new RepresentativeSelectionError('complete campaign must contain exactly 45 runs');
  }
  const representatives: CellRepresentative[] = [];
  for (const modelId of FINAL_EVALUATION_PROTOCOL.models) {
    for (const inputMode of FINAL_EVALUATION_PROTOCOL.inputModes) {
      representatives.push(selectCellRepresentative(
        runs.filter((run) => run.modelId === modelId && run.inputMode === inputMode),
      ));
    }
  }
  const formalRunCount = runs.filter(
    (run) => FINAL_EVALUATION_PROTOCOL.models.includes(run.modelId)
      && FINAL_EVALUATION_PROTOCOL.inputModes.includes(run.inputMode),
  ).length;
  if (formalRunCount !== runs.length) {
    throw new RepresentativeSelectionError('campaign contains coordinates outside the frozen protocol');
  }
  return representatives;
};
