import 'fake-indexeddb/auto';
import { KeyValueStore } from './kv-store';

describe('KeyValueStore (IndexedDB)', () => {
  let store: KeyValueStore;
  let name = 0;

  beforeEach(() => {
    store = new KeyValueStore(`eras-test-${++name}`);
  });

  afterEach(() => store.close());

  it('keeps values as they are, by key, and forgets the deleted ones', async () => {
    expect(await store.get('a')).toBeUndefined();
    await store.set('a', { decks: [{ id: 'd1', cards: ['x', 'x'] }], at: 1 });
    await store.set('b', 2);
    expect(await store.get('a')).toEqual({ decks: [{ id: 'd1', cards: ['x', 'x'] }], at: 1 });
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
    await store.delete('a');
    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBe(2);
  });

  it('deletes every key with a prefix, and only those', async () => {
    await store.set('offline-library:u1', 1);
    await store.set('offline-library:u2', 2);
    await store.set('other', 3);
    await store.deletePrefix('offline-library:');
    expect(await store.keys()).toEqual(['other']);
  });

  it('outlives the connection (another page, a reload)', async () => {
    await store.set('k', 'v');
    await store.close();
    expect(await store.get('k')).toBe('v');
  });
});

describe('KeyValueStore in a database made by someone else', () => {
  it('adds its store to a database that exists without it', async () => {
    await new Promise<void>((resolve) => {
      const open = indexedDB.open('eras-foreign', 1);
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const store = new KeyValueStore('eras-foreign');
    await store.set('k', 1);
    expect(await store.get('k')).toBe(1);
    await store.close();
  });
});
