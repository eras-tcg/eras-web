export type Side = 'player1' | 'player2';
/** A life card at the end of the game: face up or face down. */
export type Life = 'up' | 'down';

export interface PlayerEntry {
  playerName: string;
  deckId: string;
  lives: Life[];
}

/** /api/drive/games (manage_decks). */
export interface Game {
  id?: string;
  player1: PlayerEntry;
  player2: PlayerEntry;
  winner: Side;
  firstPlayer: Side;
  comment?: string | null;
  /** Total seconds. */
  duration?: number | null;
  createdAt?: string | null;
}

/** /api/drive/game-notes (manage_decks). */
export interface GameNote {
  id: string;
  text: string;
  createdAt?: string | null;
}

/** /api/drive/tierlist (read: public, write: manage_decks). */
export interface TierList {
  id?: string;
  pages: TierPage[];
  updatedAt?: string | null;
}

export interface TierPage {
  id: string;
  name: string;
  tiers: TierRow[];
}

export interface TierRow {
  label: string;
  color: string;
  deckIds: string[];
}
