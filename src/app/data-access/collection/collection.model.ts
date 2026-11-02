/** The finish of a copy: plain, foil (holographic) or prism (prismatic, starlight). */
export type Finish = 'plain' | 'foil' | 'prism';

/** Copies of one card, by finish (a finish not there means none). */
export type OwnedCopies = Partial<Record<Finish, number>>;

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
