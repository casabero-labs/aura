interface TestStoreData {
  keyPath: string;
  indexes: Map<string, string>;
  records: Map<string, unknown>;
}

interface TestDatabaseData {
  version: number;
  stores: Map<string, TestStoreData>;
}

const clone = <T>(value: T): T => structuredClone(value);

const event = (type: string): Event => new Event(type);

class TestRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBRequest<T>, ev: Event) => unknown) | null = null;

  succeed(value: T): void {
    this.result = value;
    this.onsuccess?.call(this as unknown as IDBRequest<T>, event('success'));
  }

  fail(error: DOMException): void {
    this.error = error;
    this.onerror?.call(this as unknown as IDBRequest<T>, event('error'));
  }
}

class TestOpenRequest extends TestRequest<IDBDatabase> {
  onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null = null;
}

class TestTransaction {
  error: DOMException | null = null;
  oncomplete: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  onerror: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  onabort: ((this: IDBTransaction, ev: Event) => unknown) | null = null;
  private readonly workingStores = new Map<string, TestStoreData>();
  private pending = 0;
  private finished = false;
  private aborted = false;
  private completionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly database: TestDatabaseData,
    storeNames: readonly string[],
    private readonly mode: IDBTransactionMode,
  ) {
    for (const name of storeNames) {
      const source = database.stores.get(name);
      if (!source) throw new DOMException(`Unknown object store ${name}`, 'NotFoundError');
      this.workingStores.set(name, {
        keyPath: source.keyPath,
        indexes: new Map(source.indexes),
        records: new Map([...source.records].map(([key, value]) => [key, clone(value)])),
      });
    }
    this.scheduleCompletion();
  }

  objectStore(name: string): IDBObjectStore {
    const store = this.workingStores.get(name);
    if (!store) throw new DOMException(`Store ${name} is not in this transaction`, 'NotFoundError');
    return new TestObjectStore(store, this) as unknown as IDBObjectStore;
  }

  request<T>(operation: () => T): IDBRequest<T> {
    if (this.finished || this.aborted) {
      throw new DOMException('Transaction is not active', 'TransactionInactiveError');
    }
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.completionTimer = null;
    const request = new TestRequest<T>();
    this.pending += 1;
    queueMicrotask(() => {
      if (this.aborted) return;
      try {
        request.succeed(operation());
      } catch (error: unknown) {
        const domError = error instanceof DOMException
          ? error
          : new DOMException(String(error), 'UnknownError');
        request.fail(domError);
      } finally {
        this.pending -= 1;
        this.scheduleCompletion();
      }
    });
    return request as unknown as IDBRequest<T>;
  }

  abort(): void {
    if (this.finished || this.aborted) return;
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.aborted = true;
    this.finished = true;
    this.onabort?.call(this as unknown as IDBTransaction, event('abort'));
  }

  private scheduleCompletion(): void {
    if (this.completionTimer !== null) clearTimeout(this.completionTimer);
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null;
      if (this.pending > 0 || this.finished || this.aborted) return;
      if (this.mode === 'readwrite') {
        for (const [name, store] of this.workingStores) {
          this.database.stores.set(name, {
            keyPath: store.keyPath,
            indexes: new Map(store.indexes),
            records: new Map([...store.records].map(([key, value]) => [key, clone(value)])),
          });
        }
      }
      this.finished = true;
      this.oncomplete?.call(this as unknown as IDBTransaction, event('complete'));
    }, 0);
  }
}

class TestObjectStore {
  constructor(
    private readonly store: TestStoreData,
    private readonly transaction: TestTransaction | null,
  ) {}

  createIndex(name: string, keyPath: string): IDBIndex {
    this.store.indexes.set(name, keyPath);
    return new TestIndex(this.store, keyPath, this.transaction) as unknown as IDBIndex;
  }

  index(name: string): IDBIndex {
    const keyPath = this.store.indexes.get(name);
    if (!keyPath) throw new DOMException(`Unknown index ${name}`, 'NotFoundError');
    return new TestIndex(this.store, keyPath, this.transaction) as unknown as IDBIndex;
  }

  get(key: IDBValidKey): IDBRequest<unknown> {
    return this.run(() => clone(this.store.records.get(String(key))));
  }

  getAll(): IDBRequest<unknown[]> {
    return this.run(() => [...this.store.records.values()].map(clone));
  }

  add(value: unknown): IDBRequest<IDBValidKey> {
    return this.run(() => {
      const key = this.extractKey(value);
      if (this.store.records.has(key)) throw new DOMException(`Duplicate key ${key}`, 'ConstraintError');
      this.store.records.set(key, clone(value));
      return key;
    });
  }

  put(value: unknown): IDBRequest<IDBValidKey> {
    return this.run(() => {
      const key = this.extractKey(value);
      this.store.records.set(key, clone(value));
      return key;
    });
  }

  private extractKey(value: unknown): string {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new DOMException('Stored value must be an object', 'DataError');
    }
    const key = (value as Record<string, unknown>)[this.store.keyPath];
    if (typeof key !== 'string' || key.length === 0) {
      throw new DOMException(`Missing key path ${this.store.keyPath}`, 'DataError');
    }
    return key;
  }

  private run<T>(operation: () => T): IDBRequest<T> {
    if (!this.transaction) throw new DOMException('Upgrade store cannot run requests', 'InvalidStateError');
    return this.transaction.request(operation);
  }
}

class TestIndex {
  constructor(
    private readonly store: TestStoreData,
    private readonly keyPath: string,
    private readonly transaction: TestTransaction | null,
  ) {}

  getAll(query?: IDBValidKey | IDBKeyRange | null): IDBRequest<unknown[]> {
    if (!this.transaction) throw new DOMException('Index is not active', 'InvalidStateError');
    return this.transaction.request(() => [...this.store.records.values()]
      .filter((value) => {
        if (query === undefined || query === null) return true;
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
        return (value as Record<string, unknown>)[this.keyPath] === query;
      })
      .map(clone));
  }
}

class TestDatabase {
  readonly objectStoreNames: DOMStringList;

  constructor(private readonly data: TestDatabaseData) {
    this.objectStoreNames = {
      contains: (name: string) => this.data.stores.has(name),
    } as unknown as DOMStringList;
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
    if (this.data.stores.has(name)) throw new DOMException(`Store ${name} exists`, 'ConstraintError');
    if (typeof options?.keyPath !== 'string') throw new DOMException('A string keyPath is required', 'DataError');
    const store: TestStoreData = {
      keyPath: options.keyPath,
      indexes: new Map(),
      records: new Map(),
    };
    this.data.stores.set(name, store);
    return new TestObjectStore(store, null) as unknown as IDBObjectStore;
  }

  transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    const names = typeof storeNames === 'string' ? [storeNames] : storeNames;
    return new TestTransaction(this.data, names, mode) as unknown as IDBTransaction;
  }

  close(): void {}
}

class TestIndexedDbFactory {
  private readonly databases = new Map<string, TestDatabaseData>();

  open(name: string, version = 1): IDBOpenDBRequest {
    const request = new TestOpenRequest();
    queueMicrotask(() => {
      const existing = this.databases.get(name);
      const oldVersion = existing?.version ?? 0;
      if (existing && version < existing.version) {
        request.fail(new DOMException('Requested version is older', 'VersionError'));
        return;
      }
      const data = existing ?? { version, stores: new Map<string, TestStoreData>() };
      data.version = version;
      this.databases.set(name, data);
      const database = new TestDatabase(data) as unknown as IDBDatabase;
      request.result = database;
      if (!existing || version > oldVersion) {
        const upgradeEvent = event('upgradeneeded') as IDBVersionChangeEvent;
        Object.defineProperties(upgradeEvent, {
          oldVersion: { value: oldVersion },
          newVersion: { value: version },
        });
        request.onupgradeneeded?.call(request as unknown as IDBOpenDBRequest, upgradeEvent);
      }
      request.succeed(database);
    });
    return request as unknown as IDBOpenDBRequest;
  }
}

export const createTestIndexedDbFactory = (): IDBFactory =>
  new TestIndexedDbFactory() as unknown as IDBFactory;
