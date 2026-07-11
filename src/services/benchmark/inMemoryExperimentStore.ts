import type {
  AttemptEventV1,
  ExperimentCampaignV1,
  ExperimentRunV1,
} from './experimentTypes';
import {
  assertAttemptAppend,
  assertCampaignBundle,
  assertRunUpdate,
  cloneExperimentValue,
  ExperimentStoreError,
  sortCampaigns,
  sortEvents,
  sortRuns,
  type ExperimentStore,
  type StoredAttemptEventV1,
} from './experimentStore';

export interface InMemoryExperimentState {
  campaigns: Map<string, ExperimentCampaignV1>;
  runs: Map<string, ExperimentRunV1>;
  events: Map<string, StoredAttemptEventV1>;
}

export interface InMemoryExperimentStoreOptions {
  state?: InMemoryExperimentState;
}

export const createInMemoryExperimentState = (): InMemoryExperimentState => ({
  campaigns: new Map(),
  runs: new Map(),
  events: new Map(),
});

export const createInMemoryExperimentStore = (
  options: InMemoryExperimentStoreOptions = {},
): ExperimentStore => {
  const state = options.state ?? createInMemoryExperimentState();

  const createCampaign = async (
    campaign: ExperimentCampaignV1,
    runs: readonly ExperimentRunV1[],
  ): Promise<void> => {
    assertCampaignBundle(campaign, runs);
    if (state.campaigns.has(campaign.campaignId)) {
      throw new ExperimentStoreError('CAMPAIGN_EXISTS', `Campaign ${campaign.campaignId} already exists.`);
    }
    const duplicateRun = runs.find((run) => state.runs.has(run.runId));
    if (duplicateRun) {
      throw new ExperimentStoreError('RUN_EXISTS', `Run ${duplicateRun.runId} already exists.`);
    }

    state.campaigns.set(campaign.campaignId, cloneExperimentValue(campaign));
    for (const run of runs) state.runs.set(run.runId, cloneExperimentValue(run));
  };

  const listCampaigns = async (): Promise<ExperimentCampaignV1[]> =>
    cloneExperimentValue(sortCampaigns([...state.campaigns.values()]));

  const loadCampaign = async (campaignId: string): Promise<ExperimentCampaignV1 | null> => {
    const campaign = state.campaigns.get(campaignId);
    return campaign ? cloneExperimentValue(campaign) : null;
  };

  const listRuns = async (campaignId: string): Promise<ExperimentRunV1[]> =>
    cloneExperimentValue(sortRuns(
      [...state.runs.values()].filter((run) => run.campaignId === campaignId),
    ));

  const loadRun = async (runId: string): Promise<ExperimentRunV1 | null> => {
    const run = state.runs.get(runId);
    return run ? cloneExperimentValue(run) : null;
  };

  const saveRun = async (run: ExperimentRunV1): Promise<void> => {
    const previous = state.runs.get(run.runId);
    if (!previous) throw new ExperimentStoreError('RUN_NOT_FOUND', `Run ${run.runId} does not exist.`);
    assertRunUpdate(previous, run);
    state.runs.set(run.runId, cloneExperimentValue(run));
  };

  const appendAttemptEvent = async (
    runId: string,
    event: AttemptEventV1,
    nextRun: ExperimentRunV1,
  ): Promise<void> => {
    const previous = state.runs.get(runId);
    if (!previous) throw new ExperimentStoreError('RUN_NOT_FOUND', `Run ${runId} does not exist.`);
    if (state.events.has(event.eventId)) {
      throw new ExperimentStoreError('EVENT_DUPLICATE', `Event ${event.eventId} already exists.`);
    }
    assertAttemptAppend(previous, runId, event, nextRun);

    state.events.set(event.eventId, {
      eventId: event.eventId,
      runId,
      event: cloneExperimentValue(event),
    });
    state.runs.set(runId, cloneExperimentValue(nextRun));
  };

  const listAttemptEvents = async (runId: string): Promise<AttemptEventV1[]> =>
    cloneExperimentValue(sortEvents(
      [...state.events.values()]
        .filter((record) => record.runId === runId)
        .map((record) => record.event),
    ));

  const getNextPlannedRun = async (campaignId: string): Promise<ExperimentRunV1 | null> => {
    const next = sortRuns(
      [...state.runs.values()].filter(
        (run) => run.campaignId === campaignId && run.status === 'planned',
      ),
    )[0];
    return next ? cloneExperimentValue(next) : null;
  };

  return {
    createCampaign,
    listCampaigns,
    loadCampaign,
    listRuns,
    loadRun,
    saveRun,
    appendAttemptEvent,
    listAttemptEvents,
    getNextPlannedRun,
    close: () => undefined,
  };
};
