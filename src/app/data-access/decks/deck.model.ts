/** Deck as returned by GET /api/drive/decklists */
export interface Deck {
  id: string;
  deckName: string;
  /** Card ids, one entry per copy. */
  cards: string[];
  /** URL of the cover image. */
  deckImage?: string | null;
  privateDeck?: boolean;
  userId?: string;
  username?: string | null;
  createdAt?: string | null;
}
