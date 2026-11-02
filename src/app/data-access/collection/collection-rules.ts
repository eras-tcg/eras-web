import { MAX_COPIES } from '../decks/deck-rules';
import { DeckEntry } from '../decks/deck.model';
import { Collection, Finish, OwnedCopies } from './collection.model';

/** Plainest first. */
export const FINISHES: readonly Finish[] = ['plain', 'foil', 'prism'];

export const FINISH_LABELS: Record<Finish, string> = { plain: 'Normal', foil: 'Foil', prism: 'Prismática' };

/** What 30 fragments of a card's rarity craft: one copy of it (its finish at random, by the packs' odds). */
export const CRAFT_COST = 30;

/** Fragments a broken copy gives, of its card's rarity. */
export const FRAGMENTS_OF: Record<Finish, number> = { plain: 10, foil: 30, prism: 90 };

/** Copies of a card in a collection, every finish together. */
export function ownedCount(collection: Collection | null, cardId: string): number {
  const copies = collection?.cards[cardId];
  return copies ? FINISHES.reduce((sum, f) => sum + (copies[f] ?? 0), 0) : 0;
}

/** Copies a deck needs that the collection lacks, in all (each printing counts by itself). */
export function missingCopies(entries: readonly DeckEntry[], collection: Collection | null): number {
  return entries.reduce((sum, e) => sum + Math.max(0, e.count - ownedCount(collection, e.card.id)), 0);
}

/** The extra copies of a card (beyond MAX_COPIES), by finish: the finest are kept, so the plain ones go first. */
export function extrasOf(copies: OwnedCopies | undefined): OwnedCopies {
  let keep = MAX_COPIES;
  const extra: OwnedCopies = {};
  for (const finish of [...FINISHES].reverse()) {
    const count = copies?.[finish] ?? 0;
    const kept = Math.min(count, keep);
    keep -= kept;
    if (count > kept) extra[finish] = count - kept;
  }
  return extra;
}

/** Every extra copy in a collection, in all. */
export function extraCopies(collection: Collection | null): number {
  return Object.values(collection?.cards ?? {}).reduce(
    (sum, copies) => sum + FINISHES.reduce((n, f) => n + (extrasOf(copies)[f] ?? 0), 0),
    0,
  );
}
