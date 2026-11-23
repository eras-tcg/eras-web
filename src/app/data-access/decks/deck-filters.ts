import { CARD_COLORS } from '../cards/card.model';
import { CatalogCard } from '../cards/card.model';
import { fullEditionId } from '../cards/card-rules';
import { Deck } from './deck.model';

/** What a deck is made of, derived from its cards in the catalog. */
export interface DeckSummary {
  colors: string[];
  /** Full edition ids ("E1", "E1.1"…) present in the deck. */
  editions: string[];
}

export interface DeckFilters {
  name: string;
  /** Empty = any author. */
  authors: string[];
  /** Empty = any color; otherwise the deck must use at least one of them. */
  colors: string[];
  /** Empty = any; otherwise the deck must contain cards of this edition. */
  edition: string;
  visibility: 'all' | 'public' | 'private';
  /** Public decks: the system's (ERAS), the players' (community) or both. */
  origin: 'all' | 'system' | 'community';
}

export const EMPTY_DECK_FILTERS: DeckFilters = { name: '', authors: [], colors: [], edition: '', visibility: 'all', origin: 'all' };

export function hasDeckFilters(f: DeckFilters): boolean {
  return !!f.name.trim() || f.authors.length > 0 || f.colors.length > 0 || !!f.edition || f.visibility !== 'all' || f.origin !== 'all';
}

/** Colors (in the usual order) and editions of each deck, by deck id. Cards missing from the catalog are ignored. */
export function summarizeDecks(decks: readonly Deck[], cards: readonly CatalogCard[]): Map<string, DeckSummary> {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = new Map<string, DeckSummary>();
  for (const deck of decks) {
    const colors = new Set<string>();
    const editions = new Set<string>();
    for (const id of new Set(deck.cards)) {
      const card = byId.get(id);
      if (!card) continue;
      if (card.color_identity) colors.add(card.color_identity);
      for (const c of card.meta?.colors ?? []) colors.add(c);
      editions.add(fullEditionId(card));
    }
    out.set(deck.id, {
      colors: CARD_COLORS.filter((c) => colors.has(c)),
      editions: [...editions].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    });
  }
  return out;
}

export function filterDecks(decks: readonly Deck[], f: DeckFilters, summaries: ReadonlyMap<string, DeckSummary>): Deck[] {
  const name = f.name.trim().toLowerCase();
  return decks.filter((deck) => {
    if (name && !deck.deckName.toLowerCase().includes(name)) return false;
    if (f.authors.length && !f.authors.includes(deck.username ?? '')) return false;
    if (f.visibility === 'public' && deck.privateDeck) return false;
    if (f.visibility === 'private' && !deck.privateDeck) return false;
    if (f.origin === 'system' && !deck.systemDeck) return false;
    if (f.origin === 'community' && deck.systemDeck) return false;
    const summary = summaries.get(deck.id);
    if (f.colors.length && !summary?.colors.some((c) => f.colors.includes(c))) return false;
    if (f.edition && !summary?.editions.includes(f.edition)) return false;
    return true;
  });
}

/** The rows of the system's decks in "Mazos públicos", in their order. */
export const SYSTEM_GROUPS: readonly { id: string; label: string }[] = [
  { id: 'st', label: 'Structure' },
  { id: 'e1', label: 'Bloque E1' },
  { id: 'arquetipo', label: 'Arquetipos' },
];

/** The system's decks by row (SYSTEM_GROUPS, empty rows left out), each row in the system's order. */
export function systemRows(decks: readonly Deck[]): { id: string; label: string; decks: Deck[] }[] {
  const system = decks.filter((d) => d.systemDeck).sort((a, b) => (a.systemOrder ?? 0) - (b.systemOrder ?? 0));
  return SYSTEM_GROUPS.map((g) => ({ ...g, decks: system.filter((d) => (d.systemGroup ?? 'arquetipo') === g.id) })).filter((r) => r.decks.length > 0);
}

/** Distinct authors, alphabetically. */
export function deckAuthors(decks: readonly Deck[]): string[] {
  return [...new Set(decks.map((d) => d.username).filter((u): u is string => !!u))].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Editions used by any of the decks, in natural order. */
export function deckEditions(summaries: ReadonlyMap<string, DeckSummary>): string[] {
  const all = new Set([...summaries.values()].flatMap((s) => s.editions));
  return [...all].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}
