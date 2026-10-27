import { Deck } from '../decks/deck.model';
import { Edition } from '../editions/edition.model';

export const FEATURED_DECK_SLOTS = 6;

/** GET /api/drive/front-content/home. `decks` has one entry per slot (null = empty). */
export interface HomeContent {
  id?: string;
  edition: Edition | null;
  decks: (Deck | null)[];
}

/** Body of POST /api/drive/front-content/home. */
export interface HomeSaveRequest {
  edition: Edition | null;
  decks: { deckPosition: string; deck: Deck | null }[];
}
