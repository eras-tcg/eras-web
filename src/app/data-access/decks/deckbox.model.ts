/** A deckbox as returned by GET /api/drive/deckboxes: a box holding some of the player's own decks, in order. */
export interface DeckBox {
  id: string;
  userId: string;
  name: string;
  /** Key of DECKBOX_COLORS. */
  color: DeckBoxColor;
  /** Position among the player's deckboxes, 0 first. */
  order: number;
  /** Decks in it (a deck is in one deckbox at most; the rest are loose). */
  deckIds: string[];
  createdAt?: string | null;
}

/** Body of POST / PUT /api/drive/deckboxes[/{id}] (manage_decks). */
export interface DeckBoxSaveRequest {
  name?: string;
  color?: DeckBoxColor;
}

export const DECKBOX_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'slate'] as const;
export type DeckBoxColor = (typeof DECKBOX_COLORS)[number];
