import { MAX_COPIES } from '../decks/deck-rules';
import { CatalogCard } from '../cards/card.model';
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

/** Which copies breaking `count` of a card takes: the plainest first (normal, then foil, then prismatic). */
export function breakPlan(copies: OwnedCopies | undefined, count: number): OwnedCopies {
  const plan: OwnedCopies = {};
  let left = count;
  for (const finish of FINISHES) {
    const n = Math.min(left, copies?.[finish] ?? 0);
    if (n > 0) plan[finish] = n;
    left -= n;
  }
  return plan;
}

/** Fragments a break plan gives. */
export function fragmentsFrom(plan: OwnedCopies): number {
  return FINISHES.reduce((sum, f) => sum + (plan[f] ?? 0) * FRAGMENTS_OF[f], 0);
}

const FINISH_COUNTED: Record<Finish, [string, string]> = {
  plain: ['normal', 'normales'],
  foil: ['foil', 'foil'],
  prism: ['prismática', 'prismáticas'],
};

/** What a craft gave, counted by finish: "120 normales, 9 foil, 1 prismática". */
export function craftedSummary(finishes: readonly Finish[]): string {
  return FINISHES.map((f) => [f, finishes.filter((x) => x === f).length] as const)
    .filter(([, n]) => n > 0)
    .map(([f, n]) => `${n} ${FINISH_COUNTED[f][n === 1 ? 0 : 1]}`)
    .join(', ');
}

/** The finishes of a card a player owns, the finest first (none when they have no copy). */
export function ownedFinishes(copies: OwnedCopies | undefined): Finish[] {
  return [...FINISHES].reverse().filter((f) => (copies?.[f] ?? 0) > 0);
}

/** The finest finish of a card a player owns, or null when they have none. */
export function bestFinish(copies: OwnedCopies | undefined): Finish | null {
  return ownedFinishes(copies)[0] ?? null;
}

/**
 * The finest finish a player owns among some printings of a card (the catalog shows one per name), or null when
 * they own none of them.
 */
export function bestFinishAmong(collection: Collection | null, cardIds: readonly string[]): Finish | null {
  let best: Finish | null = null;
  for (const id of cardIds) {
    const finish = bestFinish(collection?.cards[id]);
    if (finish && (!best || FINISHES.indexOf(finish) > FINISHES.indexOf(best))) best = finish;
  }
  return best;
}

/**
 * The finish of each of a deck's `count` copies of a card, taken from the player's copies the finest first; a copy
 * they lack is null.
 */
export function deckCopyFinishes(copies: OwnedCopies | undefined, count: number): (Finish | null)[] {
  const out: (Finish | null)[] = [];
  for (const finish of ownedFinishes(copies)) {
    for (let i = 0; i < (copies?.[finish] ?? 0) && out.length < count; i++) out.push(finish);
  }
  while (out.length < count) out.push(null);
  return out;
}

/** The shine a finish shows on a card (a plain copy shows none). */
export function shineOf(finish: Finish | null | undefined): 'foil' | 'prism' | null {
  return finish === 'foil' || finish === 'prism' ? finish : null;
}

/** A deck's copies of one card that the player lacks. */
export interface MissingCard {
  card: CatalogCard;
  count: number;
}

/** The copies a deck needs that the collection lacks, card by card. */
export function missingCards(entries: readonly DeckEntry[], collection: Collection | null): MissingCard[] {
  return entries.map((e) => ({ card: e.card, count: e.count - ownedCount(collection, e.card.id) })).filter((m) => m.count > 0);
}

/** What crafting a deck's missing cards takes, by rarity: copies, fragments needed and fragments owned. */
export interface CraftCost {
  rarity: string;
  copies: number;
  cost: number;
  owned: number;
}

/** The cost of crafting every missing card, rarity by rarity (cards without metadata cannot be crafted: left out). */
export function craftCosts(missing: readonly MissingCard[], fragments: Record<string, number>): CraftCost[] {
  const byRarity = new Map<string, number>();
  for (const m of missing) {
    if (!m.card.meta) continue;
    const rarity = m.card.meta.rarity || 'C';
    byRarity.set(rarity, (byRarity.get(rarity) ?? 0) + m.count);
  }
  return [...byRarity].map(([rarity, copies]) => ({ rarity, copies, cost: copies * CRAFT_COST, owned: fragments[rarity] ?? 0 }));
}
