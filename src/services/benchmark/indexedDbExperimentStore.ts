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

export const AURA_EXPERIMENT_DATABASE_NAME = 'aura-experiment-lab-v1';
export const AURA_EXPERIMENT_DATABASE_VERSION = 1;

const CAMPAIGNS_STORE = 'campaigns';
const RUNS_STORE = 'runs';
const EVENTS_STORE = 'events';
const ARTIFACTS_STORE = 'artifacts';
const CAMPAIGN_ID_INDEX = 'campaignId';
const RUN_ID_INDEX = 'runId';

export interface IndexedDbExperimentStoreOptions {
  indexedDB?: IDBFactory;
  databaseName?: string;
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });

const abortQuietly = (transaction: IDBTransaction): void => {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have completed after a failed request.
  }
};

/**
 * IndexedDB transactions may become inactive after an awaited promise in some
 * browsers. Issue writes synchronously from the final read callback instead.
 */
const chainTransactionRequests = (
  transaction: IDBTransaction,
  reads: readonly IDBRequest<unknown>[],
  buildWrites: (values: readonly unknown[]) => readonly IDBRequest<unknown>[],
): Promise<void> => new Promise((resolve, reject) => {
  const values: unknown[] = Array.from({ length: reads.length });
  let pendingReads = reads.length;
  let settled = false;

  const fail = (error: unknown): void => {
    if (settled) return;
    settled = true;
    abortQuietly(transaction);
    reject(error);
  };

  const startWrites = (): void => {
    let writes: readonly IDBRequest<unknown>[];
    try {
      writes = buildWrites(values);
    } catch (error: unknown) {
      fail(error);
      return;
    }
    if (writes.length === 0) {
      settled = true;
      resolve();
      return;
    }
    let pendingWrites = writes.length;
    for (const request of writes) {
      request.onerror = () => fail(request.error ?? new Error('IndexedDB write failed.'));
      request.onsuccess = () => {
        pendingWrites -= 1;
        if (pendingWrites === 0 && !settled) {
          settled = true;
          resolve();
        }
      };
    }
  };

  if (reads.length === 0) {
    startWrites();
    return;
  }
  reads.forEach((request, index) => {
    request.onerror = () => fail(request.error ?? new Error('IndexedDB read failed.'));
    request.onsuccess = () => {
      values[index] = request.result;
      pendingReads -= 1;
      if (pendingReads === 0 && !settled) startWrites();
    };
  });
});

const openDatabase = (
  factory: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = factory.open(databaseName, AURA_EXPERIMENT_DATABASE_VERSION);
  request.onerror = () => reject(request.error ?? new Error('Could not open experiment database.'));
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(CAMPAIGNS_STORE)) {
      database.createObjectStore(CAMPAIGNS_STORE, { keyPath: 'campaignId' });
    }
    if (!database.objectStoreNames.contains(RUNS_STORE)) {
      const runs = database.createObjectStore(RUNS_STORE, { keyPath: 'runId' });
      runs.createIndex(CAMPAIGN_ID_INDEX, 'campaignId', { unique: false });
    }
    if (!database.objectStoreNames.contains(EVENTS_STORE)) {
      const events = database.createObjectStore(EVENTS_STORE, { keyPath: 'eventId' });
      events.createIndex(RUN_ID_INDEX, 'runId', { unique: false });
    }
    if (!database.objectStoreNames.contains(ARTIFACTS_STORE)) {
      const artifacts = database.createObjectStore(ARTIFACTS_STORE, { keyPath: 'artifactId' });
      artifacts.createIndex(CAMPAIGN_ID_INDEX, 'campaignId', { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
});

export const createIndexedDbExperimentStore = (
  options: IndexedDbExperimentStoreOptions = {},
): ExperimentStore => {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory) {
    throw new ExperimentStoreError(
      'INDEXEDDB_UNAVAILABLE',
      'This browser does not provide IndexedDB.',
    );
  }
  const databaseName = options.databaseName ?? AURA_EXPERIMENT_DATABASE_NAME;
  let databasePromise: Promise<IDBDatabase> | null = null;
  const database = (): Promise<IDBDatabase> => {
    databasePromise ??= openDatabase(factory, databaseName);
    return databasePromise;
  };

  const createCampaign = async (
    campaign: ExperimentCampaignV1,
    runs: readonly ExperimentRunV1[],
  ): Promise<void> => {
    assertCampaignBundle(campaign, runs);
    const db = await database();
    const transaction = db.transaction([CAMPAIGNS_STORE, RUNS_STORE], 'readwrite');
    const completed = transactionToPromise(transaction);
    try {
      const campaignStore = transaction.objectStore(CAMPAIGNS_STORE);
      const runStore = transaction.objectStore(RUNS_STORE);
      const reads: IDBRequest<unknown>[] = [
        campaignStore.get(campaign.campaignId),
        ...runs.map((run) => runStore.get(run.runId)),
      ];
      await chainTransactionRequests(transaction, reads, (values) => {
        if (values[0] !== undefined) {
          throw new ExperimentStoreError('CAMPAIGN_EXISTS', `Campaign ${campaign.campaignId} already exists.`);
        }
        const duplicateIndex = values.slice(1).findIndex((run) => run !== undefined);
        if (duplicateIndex >= 0) {
          throw new ExperimentStoreError('RUN_EXISTS', `Run ${runs[duplicateIndex].runId} already exists.`);
        }
        return [
          campaignStore.add(cloneExperimentValue(campaign)),
          ...runs.map((run) => runStore.add(cloneExperimentValue(run))),
        ];
      });
      await completed;
    } catch (error: unknown) {
      abortQuietly(transaction);
      await completed.catch(() => undefined);
      throw error;
    }
  };

  const listCampaigns = async (): Promise<ExperimentCampaignV1[]> => {
    const db = await database();
    const transaction = db.transaction(CAMPAIGNS_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const values = await requestToPromise(transaction.objectStore(CAMPAIGNS_STORE).getAll());
    await completed;
    return cloneExperimentValue(sortCampaigns(values as ExperimentCampaignV1[]));
  };

  const loadCampaign = async (campaignId: string): Promise<ExperimentCampaignV1 | null> => {
    const db = await database();
    const transaction = db.transaction(CAMPAIGNS_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const value = await requestToPromise(transaction.objectStore(CAMPAIGNS_STORE).get(campaignId));
    await completed;
    return value === undefined ? null : cloneExperimentValue(value as ExperimentCampaignV1);
  };

  const listRuns = async (campaignId: string): Promise<ExperimentRunV1[]> => {
    const db = await database();
    const transaction = db.transaction(RUNS_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const values = await requestToPromise(
      transaction.objectStore(RUNS_STORE).index(CAMPAIGN_ID_INDEX).getAll(campaignId),
    );
    await completed;
    return cloneExperimentValue(sortRuns(values as ExperimentRunV1[]));
  };

  const loadRun = async (runId: string): Promise<ExperimentRunV1 | null> => {
    const db = await database();
    const transaction = db.transaction(RUNS_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const value = await requestToPromise(transaction.objectStore(RUNS_STORE).get(runId));
    await completed;
    return value === undefined ? null : cloneExperimentValue(value as ExperimentRunV1);
  };

  const saveRun = async (run: ExperimentRunV1): Promise<void> => {
    const db = await database();
    const transaction = db.transaction(RUNS_STORE, 'readwrite');
    const completed = transactionToPromise(transaction);
    try {
      const store = transaction.objectStore(RUNS_STORE);
      await chainTransactionRequests(transaction, [store.get(run.runId)], ([previous]) => {
        if (previous === undefined) {
          throw new ExperimentStoreError('RUN_NOT_FOUND', `Run ${run.runId} does not exist.`);
        }
        assertRunUpdate(previous as ExperimentRunV1, run);
        return [store.put(cloneExperimentValue(run))];
      });
      await completed;
    } catch (error: unknown) {
      abortQuietly(transaction);
      await completed.catch(() => undefined);
      throw error;
    }
  };

  const appendAttemptEvent = async (
    runId: string,
    event: AttemptEventV1,
    nextRun: ExperimentRunV1,
  ): Promise<void> => {
    const db = await database();
    const transaction = db.transaction([RUNS_STORE, EVENTS_STORE], 'readwrite');
    const completed = transactionToPromise(transaction);
    try {
      const runStore = transaction.objectStore(RUNS_STORE);
      const eventStore = transaction.objectStore(EVENTS_STORE);
      await chainTransactionRequests(
        transaction,
        [runStore.get(runId), eventStore.get(event.eventId)],
        ([previous, duplicate]) => {
          if (previous === undefined) {
            throw new ExperimentStoreError('RUN_NOT_FOUND', `Run ${runId} does not exist.`);
          }
          if (duplicate !== undefined) {
            throw new ExperimentStoreError('EVENT_DUPLICATE', `Event ${event.eventId} already exists.`);
          }
          assertAttemptAppend(previous as ExperimentRunV1, runId, event, nextRun);
          const persistedEvent: StoredAttemptEventV1 = {
            eventId: event.eventId,
            runId,
            event: cloneExperimentValue(event),
          };
          return [
            eventStore.add(persistedEvent),
            runStore.put(cloneExperimentValue(nextRun)),
          ];
        },
      );
      await completed;
    } catch (error: unknown) {
      abortQuietly(transaction);
      await completed.catch(() => undefined);
      throw error;
    }
  };

  const listAttemptEvents = async (runId: string): Promise<AttemptEventV1[]> => {
    const db = await database();
    const transaction = db.transaction(EVENTS_STORE, 'readonly');
    const completed = transactionToPromise(transaction);
    const values = await requestToPromise(
      transaction.objectStore(EVENTS_STORE).index(RUN_ID_INDEX).getAll(runId),
    ) as StoredAttemptEventV1[];
    await completed;
    return cloneExperimentValue(sortEvents(values.map((record) => record.event)));
  };

  const getNextPlannedRun = async (campaignId: string): Promise<ExperimentRunV1 | null> => {
    const runs = await listRuns(campaignId);
    return runs.find((run) => run.status === 'planned') ?? null;
  };

  const close = (): void => {
    if (databasePromise) void databasePromise.then((db) => db.close());
    databasePromise = null;
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
    close,
  };
};
