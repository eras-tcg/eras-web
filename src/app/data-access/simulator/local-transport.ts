import { Injectable } from '@angular/core';
import { ENGINE_BUILD } from './engine-build';
import type { EngineAssets, FromEngine, LocalMatchConfig, ToEngine } from './engine-protocol';
import { GameTransport, TransportEvents } from './game-transport';

/** Where the worker finds the engine's data (served from vendor/eras-engine, angular.json assets), versioned by its build. */
export function engineAssets(base: string = document.baseURI): EngineAssets {
  const url = (name: string) => new URL(`engine/${name}?v=${ENGINE_BUILD}`, base).href;
  return { cardBundleUrl: url('card-bundle.json'), botResourcesUrl: url('bot-resources.json') };
}

/** The part of a Worker the engine host uses (a test gives its own). */
export interface EngineWorker {
  postMessage(message: ToEngine): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FromEngine>) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

/**
 * The engine's Web Worker, one for the whole visit: made (and the engine's code and cards loaded) the first time an
 * offline game is opened, then kept, so the next games start at once and still work once the connection is gone.
 */
@Injectable({ providedIn: 'root' })
export class LocalEngine {
  private worker: EngineWorker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private readonly listeners = new Set<(message: FromEngine) => void>();

  /** Makes the worker; the bundler gives the worker (and the engine it imports) a chunk of its own. */
  protected spawn(): EngineWorker {
    return new Worker(new URL('./engine.worker', import.meta.url), { type: 'module', name: 'eras-engine' }) as EngineWorker;
  }

  /** Starts the worker and loads the engine (once; a failure may be tried again). */
  prepare(assets: EngineAssets = engineAssets()): Promise<void> {
    if (this.ready) return this.ready;
    const worker = (this.worker ??= this.listen(this.spawn()));
    const ready = new Promise<void>((resolve, reject) => {
      const off = this.on((m) => {
        if (m.kind === 'ready') resolve();
        else if (m.kind === 'error' && m.id === null) reject(new Error(m.message));
        else return;
        off();
      });
    });
    this.ready = ready;
    ready.catch(() => {
      if (this.ready === ready) this.ready = null;
    });
    worker.postMessage({ kind: 'init', assets });
    return ready;
  }

  /** A new game in the worker: resolves with its id once it is made (any game before it is dropped). */
  async create(config: LocalMatchConfig): Promise<{ id: number; roomId: string; userId: string }> {
    await this.prepare();
    const id = this.nextId++;
    const created = new Promise<{ id: number; roomId: string; userId: string }>((resolve, reject) => {
      const off = this.on((m) => {
        if (m.kind === 'created' && m.id === id) resolve({ id, roomId: m.roomId, userId: m.userId });
        else if (m.kind === 'error' && m.id === id) reject(new Error(m.message));
        else return;
        off();
      });
    });
    this.worker?.postMessage({ kind: 'create', id, config });
    return created;
  }

  action(id: number, body: string): void {
    this.worker?.postMessage({ kind: 'action', id, body });
  }

  dispose(id: number): void {
    this.worker?.postMessage({ kind: 'dispose', id });
  }

  /** Everything the worker says, until the returned function is called. */
  on(listener: (message: FromEngine) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private listen(worker: EngineWorker): EngineWorker {
    worker.addEventListener('message', (e: MessageEvent<FromEngine>) => [...this.listeners].forEach((l) => l(e.data)));
    // The worker's script could not load (offline before it was ever fetched): a new one is made on the next try
    worker.addEventListener('error', (e: ErrorEvent) => {
      e.preventDefault?.();
      [...this.listeners].forEach((l) => l({ kind: 'error', id: null, message: e.message || 'No se pudo cargar el motor del juego' }));
      worker.terminate();
      if (this.worker === worker) this.worker = null;
      this.ready = null;
    });
    return worker;
  }
}

/**
 * Modo solo sin conexión: the room is a `LocalMatch` in the engine's worker. The actions go to it as they would go
 * to the server; its messages, the server's own byte for byte, come back to the store the same way.
 */
export class LocalTransport implements GameTransport {
  readonly local = true;
  private game: number | null = null;
  private off: (() => void) | null = null;

  constructor(
    private readonly engine: LocalEngine,
    private readonly config: LocalMatchConfig,
  ) {}

  get isOpen(): boolean {
    return this.game !== null;
  }

  async open(roomId: string, events: TransportEvents): Promise<void> {
    this.close();
    const { id, roomId: room } = await this.engine.create({ ...this.config, roomId });
    if (room !== roomId) throw new Error(`La partida local abrió la sala ${room}, no ${roomId}`);
    this.game = id;
    this.off = this.engine.on((m) => {
      if (m.kind === 'message' && m.id === id) events.message(m.body);
      // Nothing was sent for an action (an unreadable body, a failure inside the engine): the server would only log it
      else if (m.kind === 'error' && m.id === id) console.warn('[motor local]', m.message);
    });
    events.connected(false);
  }

  publish(_roomId: string, body: string): boolean {
    if (this.game === null) return false;
    this.engine.action(this.game, body);
    return true;
  }

  close(): void {
    this.off?.();
    this.off = null;
    if (this.game !== null) this.engine.dispose(this.game);
    this.game = null;
  }
}
