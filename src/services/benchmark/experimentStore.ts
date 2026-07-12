import {
  validateExperimentCampaignV1,
  validateExperimentRunUpdate,
  validateExperimentRunV1,
} from './experimentGuards';
import type {
  AttemptEventV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from './experimentTypes';

export type ExperimentStoreErrorCode =
  | 'CAMPAIGN_INVALID'
  | 'CAMPAIGN_BUNDLE_INVALID'
  | 'CAMPAIGN_EXISTS'
  | 'RUN_INVALID'
  | 'RUN_EXISTS'
  | 'RUN_NOT_FOUND'
  | 'RUN_UPDATE_INVALID'
  | 'EVENT_DUPLICATE'
  | 'EVENT_RUN_MISMATCH'
  | 'EVENT_SNAPSHOT_MISMATCH'
  | 'INDEXEDDB_UNAVAILABLE';

export class ExperimentStoreError extends Error {
  constructor(
    readonly code: ExperimentStoreErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = 'ExperimentStoreError';
  }
}

export interface ExperimentRunnerStore {
  saveRun(run: ExperimentRunV1): Promise<void>;
  listRuns?(campaignId: string): Promise<ExperimentRunV1[]>;
  appendAttemptEvent(
    runId: string,
    event: AttemptEventV1,
    nextRun: ExperimentRunV1,
  ): Promise<void>;
}

export interface ExperimentStore extends ExperimentRunnerStore {
  createCampaign(campaign: ExperimentCampaignV1, runs: readonly ExperimentRunV1[]): Promise<void>;
  listCampaigns(): Promise<ExperimentCampaignV1[]>;
  loadCampaign(campaignId: string): Promise<ExperimentCampaignV1 | null>;
  listRuns(campaignId: string): Promise<ExperimentRunV1[]>;
  loadRun(runId: string): Promise<ExperimentRunV1 | null>;
  listAttemptEvents(runId: string): Promise<AttemptEventV1[]>;
  getNextPlannedRun(campaignId: string): Promise<ExperimentRunV1 | null>;
  close(): void;
}

export interface StoredAttemptEventV1 {
  eventId: string;
  runId: string;
  event: AttemptEventV1;
}

export const cloneExperimentValue = <T>(value: T): T => structuredClone(value);

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const assertCampaignBundle = (
  campaign: ExperimentCampaignV1,
  runs: readonly ExperimentRunV1[],
): void => {
  const campaignValidation = validateExperimentCampaignV1(campaign);
  if (!campaignValidation.valid) {
    throw new ExperimentStoreError('CAMPAIGN_INVALID', campaignValidation.errors.join('; '));
  }

  const runErrors: string[] = [];
  for (const run of runs) {
    const validation = validateExperimentRunV1(run);
    if (!validation.valid) runErrors.push(`${run.runId}: ${validation.errors.join('; ')}`);
    if (run.campaignId !== campaign.campaignId) {
      runErrors.push(`${run.runId}: campaignId does not match campaign`);
    }
  }
  if (runErrors.length > 0) {
    throw new ExperimentStoreError('RUN_INVALID', runErrors.join(' | '));
  }

  const sortedRuns = [...runs].sort((left, right) => left.sequence - right.sequence);
  const runIds = sortedRuns.map((run) => run.runId);
  const sequences = sortedRuns.map((run) => run.sequence);
  const expectedSequences = Array.from({ length: campaign.plannedRuns }, (_, index) => index + 1);
  if (
    runs.length !== campaign.plannedRuns
    || new Set(runIds).size !== runIds.length
    || !sameJson(runIds, campaign.runIds)
    || !sameJson(sequences, expectedSequences)
  ) {
    throw new ExperimentStoreError(
      'CAMPAIGN_BUNDLE_INVALID',
      'Campaign runIds and run sequences must describe the exact 45-unit schedule.',
    );
  }
};

export const assertRunUpdate = (
  previous: ExperimentRunV1,
  next: ExperimentRunV1,
): void => {
  const validation = validateExperimentRunUpdate(previous, next);
  if (!validation.valid) {
    throw new ExperimentStoreError('RUN_UPDATE_INVALID', validation.errors.join('; '));
  }
};

export const assertAttemptAppend = (
  existingRun: ExperimentRunV1,
  runId: string,
  event: AttemptEventV1,
  nextRun: ExperimentRunV1,
): void => {
  if (existingRun.runId !== runId || nextRun.runId !== runId) {
    throw new ExperimentStoreError('EVENT_RUN_MISMATCH', 'Event and run snapshot must target the same run.');
  }
  const appendedEvent = nextRun.attempts.at(-1);
  if (
    nextRun.attempts.length !== existingRun.attempts.length + 1
    || appendedEvent === undefined
    || !sameJson(appendedEvent, event)
  ) {
    throw new ExperimentStoreError(
      'EVENT_SNAPSHOT_MISMATCH',
      'Derived run snapshot must append exactly the supplied event.',
    );
  }
  assertRunUpdate(existingRun, nextRun);
};

export const sortCampaigns = (
  campaigns: readonly ExperimentCampaignV1[],
): ExperimentCampaignV1[] => [...campaigns].sort((left, right) =>
  left.createdAt.localeCompare(right.createdAt) || left.campaignId.localeCompare(right.campaignId));

export const sortRuns = (runs: readonly ExperimentRunV1[]): ExperimentRunV1[] =>
  [...runs].sort((left, right) => left.sequence - right.sequence || left.runId.localeCompare(right.runId));

export const sortEvents = (events: readonly AttemptEventV1[]): AttemptEventV1[] =>
  [...events].sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId));
