import { MAX_COPIES } from '../decks/deck-rules';
import { CatalogCard } from '../cards/card.model';
import { cardImageUrl } from '../cards/card-rules';
import { Deck, DeckEntry } from '../decks/deck.model';
import { Collection, Finish, OwnedCopies } from './collection.model';

/** Plainest first. */
export const FINISHES: readonly Finish[] = ['plain', 'foil', 'prism'];

export const FINISH_LABELS: Record<Finish, string> = { plain: 'Normal', foil: 'Foil', prism: 'Prismática' };

/** What 30 fragments of a card's rarity craft: one copy of it (its finish at random, by the packs' odds). */
export const CRAFT_COST = 30;

/** Fragments a broken copy gives, of its card's rarity. */
export const FRAGMENTS_OF: Record<Finish, number> = { plain: 10, foil: 30, prism: 90 };

/** The art the single alternative art of before goes by (its copies are kept as "alt-" + finish). */
export const LEGACY_ART_ID = '0';

/** The alternative art of a kept copy ("alt-x1-foil" → "x1", "alt-foil" → the art of before), null for none. */
export function copyArt(key: string): string | null {
  if (!key.startsWith('alt-')) return null;
  const rest = key.slice(4);
  const dash = rest.lastIndexOf('-');
  return dash < 0 ? LEGACY_ART_ID : rest.slice(0, dash);
}

/** The finish of a kept copy ("alt-x1-foil" or "alt-foil" → "foil"). */
export function copyFinish(key: string): Finish {
  return (key.startsWith('alt-') ? key.slice(key.lastIndexOf('-') + 1) : key) as Finish;
}

/** Copies of a card in a collection, every finish and art together (an alternative art is the same card). */
export function ownedCount(collection: Collection | null, cardId: string): number {
  const copies = collection?.cards[cardId];
  return copies ? Object.values(copies).reduce<number>((sum, n) => sum + (n ?? 0), 0) : 0;
}

/** A copy with one of the card's alternative arts: the art and its finish. */
export interface AltCopy {
  art: string;
  finish: Finish;
}

/**
 * The player's copies of a card with an alternative art the card still has (`arts`), the finest finish first: an
 * art removed since leaves its copies with the usual one.
 */
export function altCopies(copies: OwnedCopies | undefined, arts: readonly string[]): AltCopy[] {
  const out: AltCopy[] = [];
  for (const [key, n] of Object.entries(copies ?? {})) {
    const art = copyArt(key);
    if (art === null || !arts.includes(art)) continue;
    for (let k = 0; k < (n ?? 0); k++) out.push({ art, finish: copyFinish(key) });
  }
  return out.sort((a, b) => FINISHES.indexOf(b.finish) - FINISHES.indexOf(a.finish) || a.art.localeCompare(b.art));
}

/** The finest copy of a card with an alternative art (shown instead of its usual art), null when the player has none. */
export function bestAlt(copies: OwnedCopies | undefined, arts: readonly string[]): AltCopy | null {
  return altCopies(copies, arts)[0] ?? null;
}

/** A copy of a deck: its finish (null when the player lacks it) and its alternative art (null for the usual one). */
export interface DeckCopy {
  finish: Finish | null;
  art: string | null;
}

/**
 * Each of a deck's `count` copies of a card, as the table plays them: the copies with an alternative art first (the
 * finest finish first; one whose art was removed shows the usual art), then the finest finishes; null when lacking.
 */
export function deckCopies(copies: OwnedCopies | undefined, count: number, arts: readonly string[]): DeckCopy[] {
  const out: DeckCopy[] = [];
  const alts = Object.entries(copies ?? {})
    .filter(([key]) => copyArt(key) !== null)
    .sort(([a], [b]) => FINISHES.indexOf(copyFinish(b)) - FINISHES.indexOf(copyFinish(a)) || a.localeCompare(b));
  for (const [key, n] of alts) {
    const art = copyArt(key)!;
    for (let k = 0; k < (n ?? 0) && out.length < count; k++) out.push({ finish: copyFinish(key), art: arts.includes(art) ? art : null });
  }
  for (const finish of deckCopyFinishes(copies, count - out.length)) out.push({ finish, art: null });
  return out;
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
 * The finest finish the player owns of a deck's cover card (the deck's cards showing its cover image), or null when
 * they own none.
 */
export function coverFinish(
  deck: Pick<Deck, 'cards' | 'deckImage'>,
  catalog: readonly CatalogCard[],
  collection: Collection | null,
): Finish | null {
  if (!deck.deckImage || !collection) return null;
  const ids = new Set(deck.cards);
  const covers = catalog.filter((c) => ids.has(c.id) && cardImageUrl(c) === deck.deckImage).map((c) => c.id);
  return bestFinishAmong(collection, covers);
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

/**
 * The finish shown for a preferred one: itself when the card comes in it, else the closest it comes in (a tie goes to
 * the plainer one); the preference itself is kept for the next card. Null when the card comes in none.
 */
export function nearestFinish(preferred: Finish, available: readonly Finish[]): Finish | null {
  const at = FINISHES.indexOf(preferred);
  let best: Finish | null = null;
  for (const finish of FINISHES) {
    if (!available.includes(finish)) continue;
    if (best === null || Math.abs(FINISHES.indexOf(finish) - at) < Math.abs(FINISHES.indexOf(best) - at)) best = finish;
  }
  return best;
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
