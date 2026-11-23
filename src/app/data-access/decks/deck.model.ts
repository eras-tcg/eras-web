import { CatalogCard } from '../cards/card.model';

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
  /** One of the decks the bot may play in ranked Modo solo (set by a simulator administrator). */
  botDeck?: boolean;
  /** Proposed by the system (author ERAS): only these may go to the bot. */
  systemDeck?: boolean;
}

/** Body of POST / PUT /api/drive/decklists (manage_decks, own decks only). */
export interface DeckSaveRequest {
  deckName: string;
  cards: string[];
  deckImage: string | null;
  userId: string;
  username: string;
  privateDeck: boolean;
}

/** One distinct card in a deck and how many copies. */
export interface DeckEntry {
  card: CatalogCard;
  count: number;
}

export type PaperSize = 'letter' | 'a4' | 'legal';
export type Orientation = 'portrait' | 'landscape';

/** Body of POST /api/drive/proxy-print (answers a PDF). */
export interface ProxyPrintRequest {
  cardIds: string[];
  paperSize: PaperSize;
  orientation: Orientation;
  /** Inches. */
  margin: number;
  /** 0..100 */
  brightness: number;
  /** 0..100 */
  contrast: number;
}
