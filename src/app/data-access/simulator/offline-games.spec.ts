import 'fake-indexeddb/auto';
import { KeyValueStore } from '@core/storage/kv-store';
import { MAX_PENDING_GAMES, OfflineGameQueue, PendingGame, newGameId, toUpload } from './offline-games';

let n = 0;
const game = (id = `g${++n}`, userId = 'u1'): PendingGame => ({
  id,
  engineBuild: '997a7a6326e9',
  seed: '42',
  botLevel: null,
  userId,
  startedAt: 1000,
  endedAt: 2000,
  decks: { 'deck-st1': ['m-a', 'm-a', 'm-a'] },
  actions: [{ body: '{"type":"JOIN_ROOM","payload":{}}', botMoves: 0 }],
  result: { status: 'POST_GAME', gamesEnded: 1, winnerId: userId, endReason: 'lives', turns: 9, digest: '0123456789abcdef' },
});

describe('OfflineGameQueue', () => {
  let store: KeyValueStore;

  beforeEach(() => {
    store = new KeyValueStore(`test-offline-games-${++n}`);
  });

  afterEach(() => store.close());

  it('keeps each player’s games on the device, across a reload', async () => {
    const queue = new OfflineGameQueue(store);
    await queue.add('u1', game('a'));
    await queue.add('u2', game('b', 'u2'));
    // Another page (a reload): the same store
    const reloaded = new OfflineGameQueue(store);
    expect((await reloaded.list('u1')).map((g) => g.id)).toEqual(['a']);
    expect((await reloaded.list('u2')).map((g) => g.id)).toEqual(['b']);
    expect(await reloaded.list('u3')).toEqual([]);
  });

  it('keeps at most the cap, the oldest going first', async () => {
    const queue = new OfflineGameQueue(store, 3);
    for (const id of ['a', 'b', 'c', 'd']) await queue.add('u1', game(id));
    expect((await queue.list('u1')).map((g) => g.id)).toEqual(['b', 'c', 'd']);
    expect(MAX_PENDING_GAMES).toBe(50);
  });

  it('keeps two games that end together, and removes the ones the server answered', async () => {
    const queue = new OfflineGameQueue(store);
    await Promise.all([queue.add('u1', game('a')), queue.add('u1', game('b')), queue.add('u1', game('c'))]);
    expect((await queue.list('u1')).map((g) => g.id)).toEqual(['a', 'b', 'c']);
    await queue.remove('u1', ['a', 'c']);
    expect((await queue.list('u1')).map((g) => g.id)).toEqual(['b']);
    await queue.remove('u1', ['b']);
    expect(await store.keys()).toEqual([]);
  });
});

describe('toUpload', () => {
  it('is what the server reads: the game number is the post-games the room reached', () => {
    const upload = toUpload(game('x'));
    expect(upload.result).toEqual({ gameNumber: 1, winnerId: 'u1', endReason: 'lives', turns: 9, digest: '0123456789abcdef' });
    expect(Object.keys(upload)).toEqual(['id', 'engineBuild', 'seed', 'botLevel', 'startedAt', 'endedAt', 'decks', 'actions', 'result']);
  });

  it('gives each game a new UUID', () => {
    const a = newGameId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newGameId()).not.toBe(a);
  });
});
