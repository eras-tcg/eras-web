import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { EditModeService } from '@core/auth/edit-mode.service';
import type { FromEngine, LocalMatchConfig, ToEngine } from './engine-protocol';
import { GameTransport, TransportEvents } from './game-transport';
import { GameTransports } from './game-transports';
import { GameStore } from './game.store';
import { EngineWorker, LocalEngine, LocalTransport, engineAssets } from './local-transport';
import { RoomsApi } from './rooms.api';
import { provideHttpClient } from '@angular/common/http';

/** A transport the test drives: what the store publishes, and the messages it is sent. */
class FakeTransport implements GameTransport {
  events: TransportEvents | null = null;
  room: string | null = null;
  published: string[] = [];
  closed = false;
  isOpen = false;
  constructor(readonly local: boolean) {}
  open(roomId: string, events: TransportEvents): Promise<void> {
    this.room = roomId;
    this.events = events;
    this.isOpen = true;
    events.connected(false);
    return Promise.resolve();
  }
  publish(_roomId: string, body: string): boolean {
    this.published.push(body);
    return this.isOpen;
  }
  close(): void {
    this.closed = true;
    this.isOpen = false;
  }
}

const state = (extra: object = {}) =>
  JSON.stringify({ roomId: 'r', status: 'WAITING', bot: true, players: { u1: { userId: 'u1', username: 'yo', hand: [], field: [], deck: [] } }, ...extra });

describe('GameStore transports', () => {
  let made: FakeTransport[];
  let localConfigs: LocalMatchConfig[];
  let editMode: ReturnType<typeof signal<boolean>>;
  let store: GameStore;

  beforeEach(() => {
    made = [];
    localConfigs = [];
    editMode = signal(false);
    localStorage.setItem('auth_user', JSON.stringify({ id: 'u1', username: 'yo', permissions: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: EditModeService, useValue: { active: editMode } },
        {
          provide: GameTransports,
          useValue: {
            stomp: () => made[made.push(new FakeTransport(false)) - 1],
            local: (config: LocalMatchConfig) => {
              localConfigs.push(config);
              return made[made.push(new FakeTransport(true)) - 1];
            },
          },
        },
      ],
    });
    store = TestBed.inject(GameStore);
  });

  it('online: the room goes over the server transport; its messages are the state, actions are published to it', async () => {
    await store.connect('abc');
    const [stomp] = made;
    expect(stomp.local).toBe(false);
    expect(stomp.room).toBe('abc');
    expect(store.connected()).toBe(true);
    expect(store.local()).toBe(false);

    stomp.events!.message(state());
    expect(store.state()?.roomId).toBe('r');
    store.joinRoom(null);
    expect(JSON.parse(stomp.published[0])).toEqual({ type: 'JOIN_ROOM', payload: { deckId: null, username: 'yo' } });

    // Back by itself after a drop: in the room again
    stomp.events!.connected(true);
    expect(JSON.parse(stomp.published[1]).type).toBe('JOIN_ROOM');
  });

  it('offline: the local transport takes the room "local" with the configuration and the decks; the same messages make the state', async () => {
    const decks = [{ id: 'deck-st1', deckName: 'ST1', cards: [] }];
    await store.connectLocal({ decks: {}, userId: 'u1' }, decks);
    const [local] = made;
    expect(local.local).toBe(true);
    expect(local.room).toBe('local');
    expect(localConfigs[0].userId).toBe('u1');
    expect(store.local()).toBe(true);
    expect(store.roomId()).toBe('local');
    expect(store.localDecks()).toEqual(decks);

    local.events!.message(state({ roomId: 'local' }));
    expect(store.state()?.roomId).toBe('local');
    expect(store.botRoom()).toBe(true);
    store.setDeck('deck-st1');
    expect(JSON.parse(local.published[0])).toEqual({ type: 'SET_DECK', payload: { deckId: 'deck-st1' } });
    // A refused action comes back as an error update, as online
    local.events!.message(JSON.stringify({ roomId: 'local', error: 'No es tu turno', actorId: 'u1' }));
    expect(store.error()).toBe('No es tu turno');
  });

  it('offline there are no manual actions, even with the site edit mode on', async () => {
    editMode.set(true);
    await store.connect('abc');
    expect(store.editorMode()).toBe(true);
    await store.connectLocal({ decks: {} }, []);
    expect(store.editorMode()).toBe(false);
  });

  it('switching closes the transport before, and what it still says is ignored', async () => {
    await store.connect('abc');
    await store.connectLocal({ decks: {} }, []);
    const [stomp, local] = made;
    expect(stomp.closed).toBe(true);
    stomp.events!.message(state({ roomId: 'stale' }));
    stomp.events!.disconnected();
    expect(store.state()).toBeNull();
    expect(store.connected()).toBe(true);

    await store.connect('xyz');
    expect(local.closed).toBe(true);
    expect(store.local()).toBe(false);
    expect(made[2].room).toBe('xyz');
  });

  it('the offline room is reached only while its game is open', async () => {
    await expect(store.connect('local')).rejects.toThrow();
    expect(made).toHaveLength(0);
    await store.connectLocal({ decks: {} }, []);
    await store.connect('local');
    expect(made).toHaveLength(1);
    store.disconnect();
    expect(made[0].closed).toBe(true);
    expect(store.local()).toBe(false);
  });

  it('RoomsApi: "local" is made without the server and described from the game (404 when there is none)', async () => {
    const rooms = TestBed.inject(RoomsApi);
    expect(await firstValueFrom(rooms.createLocal())).toEqual({ roomId: 'local' });
    const missing = await firstValueFrom(rooms.get('local')).catch((e: unknown) => e);
    expect(missing instanceof HttpErrorResponse && missing.status).toBe(404);

    await store.connectLocal({ decks: {} }, []);
    made[0].events!.message(state({ roomId: 'local' }));
    expect(await firstValueFrom(rooms.get('local'))).toEqual({
      roomId: 'local',
      status: 'WAITING',
      playerIds: ['u1'],
      players: ['yo'],
      playerCount: 1,
      ranked: false,
    });
  });
});

/** A worker that answers as engine.worker.ts does, without the engine. */
class FakeWorker implements EngineWorker {
  sent: ToEngine[] = [];
  terminated = false;
  private messages: ((e: MessageEvent<FromEngine>) => void)[] = [];
  private errors: ((e: ErrorEvent) => void)[] = [];
  addEventListener(type: 'message' | 'error', listener: never): void {
    (type === 'message' ? this.messages : this.errors).push(listener);
  }
  postMessage(message: ToEngine): void {
    this.sent.push(message);
    if (message.kind === 'init') queueMicrotask(() => this.say({ kind: 'ready', cards: 358, botResources: 3 }));
    if (message.kind === 'create') queueMicrotask(() => this.say({ kind: 'created', id: message.id, roomId: message.config.roomId ?? 'local', userId: 'u1' }));
  }
  say(message: FromEngine): void {
    this.messages.forEach((l) => l({ data: message } as MessageEvent<FromEngine>));
  }
  fail(message: string): void {
    this.errors.forEach((l) => l({ message, preventDefault: () => undefined } as ErrorEvent));
  }
  terminate(): void {
    this.terminated = true;
  }
}

class TestEngine extends LocalEngine {
  workers: FakeWorker[] = [];
  protected override spawn(): EngineWorker {
    return this.workers[this.workers.push(new FakeWorker()) - 1];
  }
}

describe('LocalTransport and the engine worker', () => {
  const assets = engineAssets('https://erastcg.com/');

  it('versions the assets by the engine build', () => {
    expect(assets.cardBundleUrl).toMatch(/^https:\/\/erastcg\.com\/engine\/card-bundle\.json\?v=.+/);
    expect(assets.botResourcesUrl).toMatch(/^https:\/\/erastcg\.com\/engine\/bot-resources\.json\?v=.+/);
  });

  it('loads the engine once, makes the game, forwards its messages and its actions, and disposes it on close', async () => {
    const engine = new TestEngine();
    await engine.prepare(assets);
    await engine.prepare(assets);
    expect(engine.workers).toHaveLength(1);
    const worker = engine.workers[0];
    expect(worker.sent).toEqual([{ kind: 'init', assets }]);

    const transport = new LocalTransport(engine, { decks: {}, userId: 'u1' });
    const events = { message: vi.fn(), connected: vi.fn(), disconnected: vi.fn(), failed: vi.fn() };
    expect(transport.publish('local', '{}')).toBe(false);
    await transport.open('local', events);
    expect(events.connected).toHaveBeenCalledWith(false);
    const create = worker.sent[1];
    expect(create).toEqual({ kind: 'create', id: 1, config: { decks: {}, userId: 'u1', roomId: 'local' } });

    expect(transport.publish('local', '{"type":"SET_READY"}')).toBe(true);
    expect(worker.sent[2]).toEqual({ kind: 'action', id: 1, body: '{"type":"SET_READY"}' });
    worker.say({ kind: 'message', id: 1, body: 'a' });
    worker.say({ kind: 'message', id: 99, body: 'other game' });
    expect(events.message.mock.calls).toEqual([['a']]);

    transport.close();
    expect(worker.sent[3]).toEqual({ kind: 'dispose', id: 1 });
    worker.say({ kind: 'message', id: 1, body: 'late' });
    expect(events.message).toHaveBeenCalledTimes(1);
    expect(transport.isOpen).toBe(false);
  });

  it('a worker that could not load (offline before it was fetched) is replaced on the next try', async () => {
    const engine = new TestEngine();
    const first = engine.workers;
    const failing = engine.prepare(assets);
    // The script failed to load
    first[0].fail('Failed to fetch');
    await expect(failing).rejects.toThrow('Failed to fetch');
    expect(first[0].terminated).toBe(true);
    await engine.prepare(assets);
    expect(engine.workers).toHaveLength(2);
  });
});
