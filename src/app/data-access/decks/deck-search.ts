import { CARD_COLORS, CatalogCard, SPECIAL_SUMMON_LABELS } from '../cards/card.model';
import { fullEditionId } from '../cards/card-rules';
import { Deck } from './deck.model';

/**
 * What a public deck is about, worked out from its cards in the catalog: the common criteria of the deck search in
 * "Mazos públicos" (color, archetype, special summon, edition) and what the search box looks in (its classes and cards).
 */
export interface DeckProfile {
  /** Colors in the usual order. */
  colors: string[];
  /** The class with the most creature copies ("caballero"), or null without creatures. */
  archetype: string | null;
  /** Every class of its creatures, most copies first. */
  classes: string[];
  /** Its special summon methods ("promotion"…), most copies first. */
  summons: string[];
  /** The newest edition it has cards of ("E1.2"; a Structure's own deck: "ST4"), or null without known cards. */
  edition: string | null;
  /** Its card names, lowercase without accents (the search box finds a deck by a card in it). */
  cardNames: string[];
}

/** Where the search looks: every public deck, the system's or the community's. */
export type DeckScope = '' | 'system' | 'community';

/** The criteria of the deck search; empty strings mean any. */
export interface DeckSearch {
  text: string;
  color: string;
  archetype: string;
  summon: string;
  edition: string;
  scope: DeckScope;
  /** Inside "Mazos del sistema": the edition folder open ("E1.2", "ST"), or "" for the folders. */
  folder: string;
}

export const EMPTY_DECK_SEARCH: DeckSearch = { text: '', color: '', archetype: '', summon: '', edition: '', scope: '', folder: '' };

/** Editions in release order: the Structures first, then E1, E1.1… (numbers compared as numbers). */
export function compareEditions(a: string, b: string): number {
  const st = (e: string) => (e.startsWith('ST') ? 0 : 1);
  return st(a) - st(b) || a.localeCompare(b, 'es', { numeric: true });
}

/** How an edition folder is named: "ST" is the Structures'. */
export function folderLabel(folder: string): string {
  return folder === 'ST' ? 'Structure' : folder;
}

/** Lowercase, without accents: how the search box compares. */
export function plain(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function profileDecks(decks: readonly Deck[], cards: readonly CatalogCard[]): Map<string, DeckProfile> {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const out = new Map<string, DeckProfile>();
  for (const deck of decks) {
    const colors = new Set<string>();
    const classes = new Map<string, number>();
    const summons = new Map<string, number>();
    const editions = new Set<string>();
    const names = new Set<string>();
    for (const id of deck.cards) {
      const card = byId.get(id);
      if (!card) continue;
      const meta = card.meta;
      if (card.color_identity) colors.add(card.color_identity);
      for (const c of meta?.colors ?? []) colors.add(c);
      editions.add(fullEditionId(card));
      names.add(plain(meta?.cardName ?? card.name ?? ''));
      if (meta?.cardType === 'creature') for (const k of meta.cardClasses ?? []) classes.set(k.toLowerCase(), (classes.get(k.toLowerCase()) ?? 0) + 1);
      if (meta?.specialSummonKind) summons.set(meta.specialSummonKind, (summons.get(meta.specialSummonKind) ?? 0) + 1);
    }
    const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([k]) => k);
    const sorted = [...editions].sort(compareEditions);
    out.set(deck.id, {
      colors: CARD_COLORS.filter((c) => colors.has(c)),
      archetype: byCount(classes)[0] ?? null,
      classes: byCount(classes),
      summons: byCount(summons),
      edition: sorted[sorted.length - 1] ?? null,
      cardNames: [...names].filter(Boolean),
    });
  }
  return out;
}

/** The edition folder of a system deck ("ST" for the Structures'). */
export function folderOf(deck: Deck): string {
  return deck.systemEdition ?? 'ST';
}

export function hasDeckSearch(s: DeckSearch): boolean {
  return !!(s.text.trim() || s.color || s.archetype || s.summon || s.edition);
}

const COLOR_WORDS: Record<string, string> = { B: 'azul', G: 'verde', P: 'violeta', R: 'rojo', W: 'blanco' };

/**
 * The decks that meet every criterion, in the scope and folder open. The search box looks in the deck's name, its
 * author, its classes, its colors and its cards (accents and case aside), each word on its own: "rojo krugel" finds red
 * decks with Krugel.
 */
export function searchDecks(decks: readonly Deck[], s: DeckSearch, profiles: ReadonlyMap<string, DeckProfile>): Deck[] {
  const words = plain(s.text).split(/\s+/).filter(Boolean);
  return decks.filter((deck) => {
    const p = profiles.get(deck.id);
    if (s.scope === 'system' && !deck.systemDeck) return false;
    if (s.scope === 'community' && deck.systemDeck) return false;
    if (s.folder && (!deck.systemDeck || folderOf(deck) !== s.folder)) return false;
    if (s.color && !p?.colors.includes(s.color)) return false;
    if (s.archetype && p?.archetype !== s.archetype) return false;
    if (s.summon && !p?.summons.includes(s.summon)) return false;
    if (s.edition && p?.edition !== s.edition) return false;
    if (words.length) {
      const name = plain(deck.deckName);
      const author = plain(deck.username ?? '');
      const classes = (p?.classes ?? []).map(plain);
      const cards = p?.cardNames ?? [];
      const colorNames = (p?.colors ?? []).map((c) => COLOR_WORDS[c] ?? '');
      for (const w of words) {
        const found =
          name.includes(w) || author.includes(w) || classes.some((k) => k.includes(w)) || cards.some((c) => c.includes(w)) || colorNames.includes(w);
        if (!found) return false;
      }
    }
    return true;
  });
}

/** The edition folders of the system's decks, in release order. */
export function systemFolders(decks: readonly Deck[]): string[] {
  return [...new Set(decks.filter((d) => d.systemDeck).map(folderOf))].sort(compareEditions);
}

/** The archetypes the decks have, by how many decks have each (then by name). */
export function deckArchetypes(profiles: ReadonlyMap<string, DeckProfile>): string[] {
  const n = new Map<string, number>();
  for (const p of profiles.values()) if (p.archetype) n.set(p.archetype, (n.get(p.archetype) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([k]) => k);
}

/** The special summon methods the decks use, in the labels' order. */
export function deckSummons(profiles: ReadonlyMap<string, DeckProfile>): string[] {
  const used = new Set([...profiles.values()].flatMap((p) => p.summons));
  return Object.keys(SPECIAL_SUMMON_LABELS).filter((k) => used.has(k));
}

/** The editions the decks belong to, in release order. */
export function deckEditionsOf(profiles: ReadonlyMap<string, DeckProfile>): string[] {
  return [...new Set([...profiles.values()].map((p) => p.edition).filter((e): e is string => !!e))].sort(compareEditions);
}

/** "muerto viviente" → "Muerto viviente". */
export function archetypeLabel(k: string): string {
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : k;
}
