/**
 * A small key-value store over IndexedDB (database "eras", one object store), for what must outlive the page and is
 * too big for localStorage: the decks and cards kept for playing without the connection. Values are stored as they
 * are (structured clone). Without IndexedDB (a private window that blocks it, an old browser) every read finds
 * nothing and every write is skipped: the site works the same, it just remembers nothing.
 */
export class KeyValueStore {
  private db: Promise<IDBDatabase | null> | null = null;

  constructor(
    private readonly dbName = 'eras',
    private readonly storeName = 'kv',
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    return (await this.run<T | undefined>('readonly', (store) => store.get(key))) ?? undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.run('readwrite', (store) => store.put(value, key));
  }

  async delete(key: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(key));
  }

  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return (keys ?? []).map(String);
  }

  /** Deletes every key that starts with {@code prefix}. */
  async deletePrefix(prefix: string): Promise<void> {
    const range = IDBKeyRange.bound(prefix, prefix + '￿');
    await this.run('readwrite', (store) => store.delete(range));
  }

  /** Closes the connection (tests delete the database between cases). */
  async close(): Promise<void> {
    const db = await this.db;
    db?.close();
    this.db = null;
  }

  private open(): Promise<IDBDatabase | null> {
    this.db ??= this.connect();
    return this.db;
  }

  /** Opens the database, making the store if it is missing (also in a database someone made without it). */
  private connect(version?: number): Promise<IDBDatabase | null> {
    return new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        request = version ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);
      } catch {
        return resolve(null);
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const next = db.version + 1;
          db.close();
          return resolve(this.connect(next));
        }
        // Another tab upgrading the database: let it, and open again next time
        db.onversionchange = () => {
          db.close();
          this.db = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction(this.storeName, mode);
        const request = action(tx.objectStore(this.storeName));
        let result: T | undefined;
        request.onsuccess = () => (result = request.result as T);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve(undefined);
        tx.onabort = () => resolve(undefined);
      } catch {
        // The connection closed meanwhile, or the value cannot be cloned
        resolve(undefined);
      }
    });
  }
}

/** The site's store (one connection per page). */
export const erasStore = new KeyValueStore();
