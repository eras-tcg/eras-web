import { Deck } from '../decks/deck.model';
import { FEATURED_DECK_SLOTS, HomeContent, HomeSaveRequest } from './home.model';

/** Always exactly FEATURED_DECK_SLOTS entries: missing slots become null, extra ones are dropped. */
export function normalizeSlots(decks: readonly (Deck | null | undefined)[] | null | undefined): (Deck | null)[] {
  return Array.from({ length: FEATURED_DECK_SLOTS }, (_, i) => decks?.[i] ?? null);
}

export function toSaveRequest(content: HomeContent): HomeSaveRequest {
  return {
    edition: content.edition,
    decks: normalizeSlots(content.decks).map((deck, i) => ({ deckPosition: String(i), deck })),
  };
}
