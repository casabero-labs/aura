import {
  FINAL_EVALUATION_PROTOCOL,
  OE4_INPUT_MODES,
  type OE4InputMode,
  type OE4ModelId,
} from './finalEvaluationProtocol';

type Repetition = 1 | 2 | 3 | 4 | 5;

export interface ScheduledExperimentUnitV1 {
  runId: string;
  sequence: number;
  blockId: string;
  modelId: OE4ModelId;
  inputMode: OE4InputMode;
  repetition: Repetition;
}

export interface ExcludedWarmupV1 {
  warmupId: string;
  blockId: string;
  modelId: OE4ModelId;
  repetition: Repetition;
  excluded: true;
}

export interface ExperimentModelBlockV1 {
  blockId: string;
  blockSequence: number;
  modelId: OE4ModelId;
  repetition: Repetition;
  modeOrder: OE4InputMode[];
  unitRunIds: string[];
  warmup: ExcludedWarmupV1;
}

export interface ExperimentScheduleV1 {
  contractId: 'aura.experiment-schedule.v1';
  protocolId: string;
  protocolVersion: string;
  scheduleSeed: number;
  modeOrderSeed: number;
  units: ScheduledExperimentUnitV1[];
  blocks: ExperimentModelBlockV1[];
  warmups: ExcludedWarmupV1[];
}

const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const seededModeOrder = (seed: number): OE4InputMode[] => {
  const modes = [...OE4_INPUT_MODES];
  const random = mulberry32(seed);
  for (let index = modes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [modes[index], modes[swapIndex]] = [modes[swapIndex], modes[index]];
  }
  return modes;
};

const rotateModes = (
  modes: readonly OE4InputMode[],
  offset: number,
): OE4InputMode[] => modes.map((_, index) => modes[(index + offset) % modes.length]);

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

/** Builds the complete formal OE4 order. Warm-ups are explicit but never runs. */
export const buildExperimentSchedule = (): ExperimentScheduleV1 => {
  const units: ScheduledExperimentUnitV1[] = [];
  const blocks: ExperimentModelBlockV1[] = [];
  const warmups: ExcludedWarmupV1[] = [];
  const baseModeOrder = seededModeOrder(FINAL_EVALUATION_PROTOCOL.schedule.modeOrderSeed);
  let blockSequence = 0;
  let sequence = 0;

  FINAL_EVALUATION_PROTOCOL.schedule.balancedModelOrders.forEach((modelOrder, repetitionIndex) => {
    const repetition = (repetitionIndex + 1) as Repetition;
    modelOrder.forEach((modelId) => {
      blockSequence += 1;
      const modelIndex = FINAL_EVALUATION_PROTOCOL.models.indexOf(modelId) + 1;
      const blockId = `block:oe4:r${repetition}:m${modelIndex}`;
      const warmup: ExcludedWarmupV1 = {
        warmupId: `warmup:oe4:s${FINAL_EVALUATION_PROTOCOL.schedule.seed}:r${repetition}:m${modelIndex}`,
        blockId,
        modelId,
        repetition,
        excluded: true,
      };
      const modeOrder = rotateModes(baseModeOrder, (blockSequence - 1) % OE4_INPUT_MODES.length);
      const unitRunIds: string[] = [];

      for (const inputMode of modeOrder) {
        sequence += 1;
        const runId = `run:oe4:s${FINAL_EVALUATION_PROTOCOL.schedule.seed}:r${repetition}:m${modelIndex}:${inputMode}`;
        unitRunIds.push(runId);
        units.push({ runId, sequence, blockId, modelId, inputMode, repetition });
      }

      warmups.push(warmup);
      blocks.push({
        blockId,
        blockSequence,
        modelId,
        repetition,
        modeOrder,
        unitRunIds,
        warmup,
      });
    });
  });

  if (
    units.length !== FINAL_EVALUATION_PROTOCOL.matrix.units
    || blocks.length !== FINAL_EVALUATION_PROTOCOL.schedule.expectedModelBlocks
    || warmups.length !== FINAL_EVALUATION_PROTOCOL.schedule.expectedWarmupCalls
  ) {
    throw new Error('Frozen OE4 schedule cardinality drift detected.');
  }

  return deepFreeze({
    contractId: 'aura.experiment-schedule.v1',
    protocolId: FINAL_EVALUATION_PROTOCOL.id,
    protocolVersion: FINAL_EVALUATION_PROTOCOL.version,
    scheduleSeed: FINAL_EVALUATION_PROTOCOL.schedule.seed,
    modeOrderSeed: FINAL_EVALUATION_PROTOCOL.schedule.modeOrderSeed,
    units,
    blocks,
    warmups,
  });
};
