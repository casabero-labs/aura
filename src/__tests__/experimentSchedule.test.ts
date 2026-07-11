import { describe, expect, it } from 'vitest';
import {
  buildExperimentSchedule,
} from '../services/benchmark/experimentSchedule';
import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODES,
} from '../services/benchmark/finalEvaluationProtocol';

describe('OE4 deterministic experiment schedule — Task 5', () => {
  it('builds exactly 45 uniquely identified formal units', () => {
    const schedule = buildExperimentSchedule();

    expect(schedule.units).toHaveLength(45);
    expect(new Set(schedule.units.map((unit) => unit.runId))).toHaveLength(45);
    expect(schedule.units.map((unit) => unit.sequence)).toEqual(
      Array.from({ length: 45 }, (_, index) => index + 1),
    );
  });

  it('runs every model and input-mode pair exactly five times', () => {
    const schedule = buildExperimentSchedule();

    for (const modelId of FINAL_EVALUATION_PROTOCOL.models) {
      for (const inputMode of OE4_INPUT_MODES) {
        const matching = schedule.units.filter(
          (unit) => unit.modelId === modelId && unit.inputMode === inputMode,
        );
        expect(matching).toHaveLength(5);
        expect(matching.map((unit) => unit.repetition).sort()).toEqual([1, 2, 3, 4, 5]);
      }
    }
  });

  it('follows the frozen model rotation and excludes one warm-up per model block', () => {
    const schedule = buildExperimentSchedule();

    expect(schedule.blocks).toHaveLength(15);
    expect(schedule.warmups).toHaveLength(15);

    for (let repetitionIndex = 0; repetitionIndex < 5; repetitionIndex += 1) {
      const repetition = repetitionIndex + 1;
      const blockModels = schedule.blocks
        .filter((block) => block.repetition === repetition)
        .map((block) => block.modelId);
      expect(blockModels).toEqual(
        FINAL_EVALUATION_PROTOCOL.schedule.balancedModelOrders[repetitionIndex],
      );
    }

    for (const block of schedule.blocks) {
      expect(block.unitRunIds).toHaveLength(3);
      expect(block.warmup.excluded).toBe(true);
      expect(block.warmup.modelId).toBe(block.modelId);
      expect(schedule.units.some((unit) => unit.runId === block.warmup.warmupId)).toBe(false);
    }
  });

  it('is deterministic for the frozen schedule seeds', () => {
    const first = buildExperimentSchedule();
    const second = buildExperimentSchedule();

    expect(second).toEqual(first);
    expect(first.scheduleSeed).toBe(FINAL_EVALUATION_PROTOCOL.schedule.seed);
    expect(first.modeOrderSeed).toBe(FINAL_EVALUATION_PROTOCOL.schedule.modeOrderSeed);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.units)).toBe(true);
  });
});
