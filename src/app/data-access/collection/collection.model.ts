/** The finish of a copy: plain, foil (holographic) or prism (prismatic, starlight). */
export type Finish = 'plain' | 'foil' | 'prism';

/**
 * How a copy is kept: its finish, or "alt-" + art id + "-" + finish when it has one of the card's alternative arts
 * ("alt-" + finish for the card's single art of before, the art "0").
 */
export type CopyKey = Finish | `alt-${string}`;

/** Copies of one card, by finish and art (a key not there means none). */
export type OwnedCopies = Partial<Record<CopyKey, number>>;

/** A player's collection as the server keeps it: copies by card id, fragments by rarity. */
export interface Collection {
  cards: Record<string, OwnedCopies>;
  fragments: Record<string, number>;
}

/** What a craft gave: the finishes crafted, in order, and the collection after it. */
export interface Crafted {
  finishes: Finish[];
  collection: Collection;
}
