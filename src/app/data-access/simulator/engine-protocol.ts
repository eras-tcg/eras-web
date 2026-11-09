/**
 * What the page and the engine's worker (engine.worker.ts) say to each other. Types only: the worker imports them
 * without pulling anything of the page in, and the page without pulling the engine in.
 */

/** The room the engine plays in the browser and the player's id there, unless the configuration names others. */
export const LOCAL_ROOM_ID = 'local';
export const LOCAL_USER_ID = 'local-player';

/** One kind of card of a deck, as `LocalMatch` reads it (see vendor/eras-engine and DriveManager's `LocalDecks`). */
export interface LocalDeckCard {
  /** The card's metadata, as the site's card API gives it (`CardMeta`). */
  card: object;
  copies: number;
  /** The card's file id (the drive card's): the default is the metadata's id. */
  cardId?: string;
  imageUrl?: string | null;
}

/** A deck `SET_DECK {deckId}` finds: its cards, or (a starter deck) the metadata of each (×3, the Iniciador ×1). */
export type LocalDeckSpec = { deckName: string; cards: LocalDeckCard[] } | { deckName: string; metadata: object[] };

/** `new LocalMatch(config)`: every member optional but `decks`. */
export interface LocalMatchConfig {
  /** The game's chance and the bot's, as a decimal string (64 bits). */
  seed?: string;
  decks: Record<string, LocalDeckSpec>;
  botLevel?: string;
  userId?: string;
  roomId?: string;
  avatar?: string | null;
  playmat?: string | null;
  /** Epoch millis written on every history line; null: the clock's. */
  time?: number | null;
  botClock?: 'ticks' | 'system';
  /** A test room ("Sala de pruebas" without the connection): the player plays both sides, no bot seated. */
  editor?: boolean;
}

/** Where the worker fetches what the engine needs before the first game (absolute URLs). */
export interface EngineAssets {
  cardBundleUrl: string;
  botResourcesUrl: string;
}

/** Page → worker. */
export type ToEngine =
  /** Loads the cards and the bot's resources (once per worker; again is a no-op). */
  | { kind: 'init'; assets: EngineAssets }
  /** A new game (any game before it is dropped). `id` names it: what the worker says of it carries the id. */
  | { kind: 'create'; id: number; config: LocalMatchConfig }
  /** The player's action: the body the board publishes online to /app/room/{id}/action. */
  | { kind: 'action'; id: number; body: string }
  /** The game is over for the page: the bot stops. */
  | { kind: 'dispose'; id: number };

/** One action of the player, as the board sent it, and the bot's moves after it before the next action. */
export interface RecordedStep {
  body: string;
  botMoves: number;
}

/** `LocalMatch.result()`: the game as it ended (the server plays it again and compares). */
export interface MatchResult {
  status: string;
  /** How many times the room reached the post-game (a rematch plays another game in the same room). */
  gamesEnded: number;
  winnerId: string | null;
  endReason: string | null;
  turns: number;
  /** The engine's digest of the game, without the clock's times: the same game gives the same digest on the server. */
  digest: string;
}

/**
 * An offline game that reached its end, as the worker recorded it (offline-record.ts): enough for the server to play it
 * again exactly. `decks`: each deck the actions chose, its card ids one per copy; `actions`: every action since the room
 * was made (a rematch's game carries the games before it in the room).
 */
export interface FinishedGame {
  seed: string;
  botLevel: string | null;
  userId: string;
  startedAt: number;
  endedAt: number;
  decks: Record<string, string[]>;
  actions: RecordedStep[];
  result: MatchResult;
}

/** Worker → page. */
export type FromEngine =
  /** A game of the room reached its post-game: its record, for the rewards once connected. */
  | { kind: 'finished'; id: number; game: FinishedGame }
  | { kind: 'ready'; cards: number; botResources: number }
  | { kind: 'created'; id: number; roomId: string; userId: string }
  /** A message the server would push to /user/queue/room/{id}, byte for byte. */
  | { kind: 'message'; id: number; body: string }
  /** The engine could not start, or a game could not be made (`id`), or it sent nothing for a reason (`lastError`). */
  | { kind: 'error'; id: number | null; message: string };
