import { describe, expect, it } from 'vitest';
import {
  selectCampaignRepresentatives,
  selectCellRepresentative,
} from '../services/benchmark/representativeSelector';
import {
  FINAL_EVALUATION_PROTOCOL,
  type OE4InputMode,
  type OE4ModelId,
} from '../services/benchmark/finalEvaluationProtocol';
import type { ExperimentRunV1 } from '../services/benchmark/experimentTypes';

const makeRun = (
  repetition: 1 | 2 | 3 | 4 | 5,
  f1: number,
  modelId: OE4ModelId = FINAL_EVALUATION_PROTOCOL.models[0],
  inputMode: OE4InputMode = 'recommended',
  scriptSafe = true,
): ExperimentRunV1 => ({
  runId: `run:${modelId}:${inputMode}:${repetition}`,
  modelId,
  inputMode,
  repetition,
  sequence: repetition,
  status: 'reviewed',
  diagnosis: { status: 'completed' },
  script: { status: 'completed' },
  automaticEvaluation: {
    diagnosis: { primary: { f1 } },
    script: {
      contractValid: scriptSafe,
      syntaxValid: scriptSafe,
      safe: scriptSafe,
      missingActions: scriptSafe ? [] : ['missing'],
      unsupportedActions: [],
    },
  },
  humanReview: { mean: 3 },
} as unknown as ExperimentRunV1);

const threeRunsWithF1 = (scores: readonly number[]): ExperimentRunV1[] =>
  scores.map((score, index) => makeRun((index + 1) as 1 | 2 | 3 | 4 | 5, score));

describe('OE4 representative selection', () => {
  it('selects the median F1 and uses the lower repetition for a tie', () => {
    const selected = selectCellRepresentative(threeRunsWithF1([0.2, 0.8, 0.5]));

    expect(selected.repetition).toBe(3);
    expect(selected.f1).toBe(0.5);
    expect(selected.selectionStatus).toBe('selected');
  });

  it('selects exactly one representative for each of the nine complete cells', () => {
    const runs = FINAL_EVALUATION_PROTOCOL.models.flatMap((modelId) =>
      FINAL_EVALUATION_PROTOCOL.inputModes.flatMap((inputMode) =>
        ([1, 2, 3] as const).map((repetition) =>
          makeRun(repetition, repetition / 10, modelId, inputMode)),
      ));

    const representatives = selectCampaignRepresentatives(runs);

    expect(representatives).toHaveLength(9);
    expect(new Set(representatives.map((representative) => representative.cellId)).size).toBe(9);
    expect(representatives.every((representative) => representative.repetition === 2)).toBe(true);
  });

  it('selects by median diagnosis before the deterministic script is prepared', () => {
    const runs = threeRunsWithF1([0.1, 0.2, 0.3]).map((run) => ({
      ...run,
      automaticEvaluation: {
        ...run.automaticEvaluation!,
        script: {
          ...run.automaticEvaluation!.script,
          safe: false,
          missingActions: ['rule:null-values|email|column=>requires_human_review'],
        },
      },
    }));

    const selected = selectCellRepresentative(runs);

    expect(selected.repetition).toBe(2);
    expect(selected.selectionStatus).toBe('selected');
    expect(selected.executionEligible).toBe(true);
    expect(selected.blockReasons).toEqual([]);
  });

  it('rejects incomplete cells instead of silently changing the experiment', () => {
    expect(() => selectCellRepresentative(threeRunsWithF1([0.1, 0.2]))).toThrow(
      'exactly 3 repetitions',
    );
  });
});
