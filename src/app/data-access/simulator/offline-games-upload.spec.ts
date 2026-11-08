import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KeyValueStore } from '@core/storage/kv-store';
import { OfflineGameQueue, PendingGame } from './offline-games';
import { OfflineGamesUpload, OfflineGameVerdict, showNotice, summaryText } from './offline-games-upload';

const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function signedIn(): void {
  localStorage.setItem('auth_token', `${encode({ alg: 'none' })}.${encode({ sub: 'u1', permissions: [], exp: Math.floor(Date.now() / 1000) + 3600 })}.x`);
  localStorage.setItem('auth_user', JSON.stringify({ id: 'u1', username: 'ana', permissions: [] }));
}

let n = 0;
const game = (id: string): PendingGame => ({
  id,
  engineBuild: '997a7a6326e9',
  seed: '42',
  botLevel: 'easy',
  userId: 'u1',
  startedAt: 1000,
  endedAt: 2000,
  decks: { 'deck-st1': ['m-a'] },
  actions: [{ body: '{"type":"JOIN_ROOM","payload":{}}', botMoves: 0 }],
  result: { status: 'POST_GAME', gamesEnded: 1, winnerId: 'u1', endReason: 'lives', turns: 9, digest: '0123456789abcdef' },
});

describe('OfflineGamesUpload', () => {
  let store: KeyValueStore;
  let queue: OfflineGameQueue;
  let upload: OfflineGamesUpload;
  let http: HttpTestingController;
  let notices: string[];

  beforeEach(() => {
    signedIn();
    store = new KeyValueStore(`test-offline-upload-${++n}`);
    queue = new OfflineGameQueue(store);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    upload = TestBed.inject(OfflineGamesUpload);
    upload.queue = queue;
    http = TestBed.inject(HttpTestingController);
    notices = [];
    upload.announce = (text) => void notices.push(text);
  });

  afterEach(async () => {
    await store.close();
    localStorage.clear();
  });

  /** The next upload, once it is sent (the queue is read first). */
  async function next(): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request ??= http.match('/api/simulator/offline-games')[0];
      expect(request).toBeDefined();
    });
    return request as TestRequest;
  }

  /** Answers the next upload with the verdict for the game it carries. */
  async function answer(verdict: (id: string) => Partial<OfflineGameVerdict> | { error: number }): Promise<string> {
    const request = await next();
    expect(request.request.method).toBe('POST');
    const id = request.request.body.games[0].id as string;
    const v = verdict(id);
    if ('error' in v) request.flush({ message: 'x' }, { status: v.error, statusText: 'x' });
    else request.flush({ results: [{ id, ...v }] });
    return id;
  }

  it('sends each game, drops those the server decided on, and sums them up', async () => {
    for (const id of ['a', 'b', 'c']) await queue.add('u1', game(id));
    const sent = upload.send('u1');

    expect(await answer(() => ({ status: 'accepted', credit: { won: true, turns: 9, progress: [], matchId: 'm1' } }))).toBe('a');
    expect(await answer(() => ({ status: 'duplicate' }))).toBe('b');
    expect(await answer(() => ({ status: 'accepted', credit: { won: false, turns: 7, progress: [], matchId: 'm2' } }))).toBe('c');

    expect(await sent).toEqual({ accepted: 2, won: 1, rejected: 0, pending: 0 });
    expect(await queue.list('u1')).toEqual([]);
    expect(notices).toEqual(['2 partidas sin conexión registradas · 1 victoria']);
  });

  it('the body is the recorded game as the server reads it', async () => {
    await queue.add('u1', game('a'));
    const sent = upload.send('u1');
    const request = await next();
    expect(request.request.body).toEqual({
      games: [
        {
          id: 'a',
          engineBuild: '997a7a6326e9',
          seed: '42',
          botLevel: 'easy',
          startedAt: 1000,
          endedAt: 2000,
          decks: { 'deck-st1': ['m-a'] },
          actions: [{ body: '{"type":"JOIN_ROOM","payload":{}}', botMoves: 0 }],
          result: { gameNumber: 1, winnerId: 'u1', endReason: 'lives', turns: 9, digest: '0123456789abcdef' },
        },
      ],
    });
    request.flush({ results: [{ id: 'a', status: 'rejected', reason: 'mismatch' }] });
    expect(await sent).toEqual({ accepted: 0, won: 0, rejected: 1, pending: 0 });
    expect(notices).toEqual(['1 partida sin conexión no se pudo registrar']);
  });

  it('keeps what the server leaves for later, or could not be sent, and stops there', async () => {
    for (const id of ['a', 'b', 'c']) await queue.add('u1', game(id));
    const sent = upload.send('u1');
    await answer(() => ({ status: 'accepted', credit: { won: false, turns: 9, progress: [], matchId: null } }));
    await answer(() => ({ status: 'retry', reason: 'busy' }));
    expect(await sent).toEqual({ accepted: 1, won: 0, rejected: 0, pending: 2 });
    expect((await queue.list('u1')).map((g) => g.id)).toEqual(['b', 'c']);
    expect(notices).toEqual(['1 partida sin conexión registrada']);

    // The connection gone: nothing lost, nothing said
    notices.length = 0;
    const again = upload.send('u1');
    await answer(() => ({ error: 0 }));
    expect(await again).toEqual({ accepted: 0, won: 0, rejected: 0, pending: 2 });
    expect(notices).toEqual([]);

    // A body the server can never take is dropped
    const last = upload.send('u1');
    await answer(() => ({ error: 413 }));
    await answer(() => ({ status: 'accepted', credit: { won: true, turns: 3, progress: [], matchId: null } }));
    expect(await last).toEqual({ accepted: 1, won: 1, rejected: 1, pending: 0 });
    expect(notices).toEqual(['1 partida sin conexión registrada · 1 victoria · 1 no se pudo registrar']);
  });

  it('nothing to send says nothing', async () => {
    expect(await upload.send('u1')).toEqual({ accepted: 0, won: 0, rejected: 0, pending: 0 });
    http.expectNone('/api/simulator/offline-games');
    expect(notices).toEqual([]);
  });
});

describe('showNotice', () => {
  it('shows one notice at the bottom of the app for a few seconds', () => {
    vi.useFakeTimers();
    try {
      showNotice('1 partida sin conexión registrada');
      showNotice('2 partidas sin conexión registradas');
      const shown = document.querySelectorAll('[role=status]#eras-offline-notice');
      expect(shown.length).toBe(1);
      expect(shown[0].textContent).toBe('2 partidas sin conexión registradas');
      vi.advanceTimersByTime(5000);
      expect(document.getElementById('eras-offline-notice')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('summaryText', () => {
  it('counts what was registered, the wins and what was refused', () => {
    expect(summaryText({ accepted: 0, won: 0, rejected: 0, pending: 3 })).toBeNull();
    expect(summaryText({ accepted: 3, won: 2, rejected: 2, pending: 0 })).toBe(
      '3 partidas sin conexión registradas · 2 victorias · 2 no se pudieron registrar',
    );
    expect(summaryText({ accepted: 0, won: 0, rejected: 2, pending: 0 })).toBe('2 partidas sin conexión no se pudieron registrar');
  });
});
