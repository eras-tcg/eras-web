import { Deck } from '../decks/deck.model';
import { Edition } from '../editions/edition.model';

export const FEATURED_DECK_SLOTS = 6;

/** A news item of the home's carousel (edited by manage_home). */
export interface HomeNews {
  /** Set by the server on its first save. */
  id?: string | null;
  title: string;
  /** ISO date and time, "2026-11-23T20:00". */
  date: string;
  excerpt: string;
  /** Up to MAX_NEWS_CARDS cards shown whole beside it (catalog ids). */
  cardIds: string[];
  /** An optional button to a page of the site ("/cards?edition=E1.3") and its text. */
  linkRoute?: string | null;
  linkLabel?: string | null;
}

export const MAX_NEWS_CARDS = 3;

/** GET /api/drive/front-content/home. `decks` has one entry per slot (null = empty). */
export interface HomeContent {
  id?: string;
  edition: Edition | null;
  decks: (Deck | null)[];
  /** The carousel's news in order; null until first saved (the site shows DEFAULT_NEWS until then). */
  news?: HomeNews[] | null;
}

/** Body of POST /api/drive/front-content/home. */
export interface HomeSaveRequest {
  edition: Edition | null;
  decks: { deckPosition: string; deck: Deck | null }[];
  /** All the news, in order; left out to keep them as they are. */
  news?: HomeNews[];
}
