import { KeyValueStore, erasStore } from '@core/storage/kv-store';
import type { FinishedGame } from './engine-protocol';

/**
 * An offline game kept on the device until the server counts it: the worker's record (offline-record.ts), the id the
 * site gave it (the server counts an id once) and the engine's build that played it.
 */
export interface PendingGame extends FinishedGame {
  id: string;
  engineBuild: string;
}

/** What `POST /api/simulator/offline-games` takes for one game (DriveManager's OfflineGame). */
export interface OfflineGameUpload {
  id: string;
  engineBuild: string;
  seed: string;
  botLevel: string | null;
  startedAt: number;
  endedAt: number;
  decks: Record<string, string[]>;
  actions: { body: string; botMoves: number }[];
  result: { gameNumber: number; winnerId: string | null; endReason: string | null; turns: number; digest: string };
}

export function toUpload(game: PendingGame): OfflineGameUpload {
  return {
    id: game.id,
    engineBuild: game.engineBuild,
    seed: game.seed,
    botLevel: game.botLevel,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    decks: game.decks,
    actions: game.actions,
    result: {
      gameNumber: game.result.gamesEnded,
      winnerId: game.result.winnerId,
      endReason: game.result.endReason,
      turns: game.result.turns,
      digest: game.result.digest,
    },
  };
}

/** The most games kept per player: past it the oldest go (the server counts a few a day anyway). */
export const MAX_PENDING_GAMES = 50;

interface StoredQueue {
  userId: string;
  games: PendingGame[];
}

const USER_PREFIX = 'offline-games:';
const keyOf = (userId: string) => USER_PREFIX + userId;

/** A new game id (a UUID): the server counts each once. */
export function newGameId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * The offline games each player played on this device and the server has not counted yet (IndexedDB, `eras`/`kv`, key
 * `offline-games:<userId>`): kept across reloads and offline starts, at most MAX_PENDING_GAMES (the oldest go first),
 * sent when the player connects (offline-games-upload.ts). Signing out keeps them: they are the player's, and go when
 * they sign in again. One change at a time, so two games ending together are both kept.
 */
export class OfflineGameQueue {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore = erasStore,
    private readonly cap = MAX_PENDING_GAMES,
  ) {}

  async list(userId: string): Promise<PendingGame[]> {
    await this.chain.catch(() => undefined);
    const stored = await this.store.get<StoredQueue>(keyOf(userId));
    return stored && stored.userId === userId ? stored.games : [];
  }

  /** Keeps a game (one with the same id replaces it); the oldest go past the cap. */
  add(userId: string, game: PendingGame): Promise<void> {
    return this.change(userId, (games) => [...games.filter((g) => g.id !== game.id), game].slice(-this.cap));
  }

  /** The games the server answered for good (counted, already counted or refused). */
  remove(userId: string, ids: readonly string[]): Promise<void> {
    const gone = new Set(ids);
    return this.change(userId, (games) => games.filter((g) => !gone.has(g.id)));
  }

  private change(userId: string, update: (games: PendingGame[]) => PendingGame[]): Promise<void> {
    const next = this.chain
      .catch(() => undefined)
      .then(async () => {
        const stored = await this.store.get<StoredQueue>(keyOf(userId));
        const games = update(stored && stored.userId === userId ? stored.games : []);
        if (games.length) await this.store.set(keyOf(userId), { userId, games });
        else await this.store.delete(keyOf(userId));
      });
    this.chain = next;
    return next;
  }
}

export const offlineGameQueue = new OfflineGameQueue();
