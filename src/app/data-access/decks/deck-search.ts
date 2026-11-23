import { CARD_COLORS, CatalogCard, SPECIAL_SUMMON_LABELS } from '../cards/card.model';
import { fullEditionId } from '../cards/card-rules';
import { Deck } from './deck.model';

/**
 * What a public deck is about, worked out from its cards in the catalog: the common criteria of the deck search in
 * "Mazos públicos" (color, archetype, special summon, format) and what the search box looks in (its classes and cards).
 */
export interface DeckProfile {
  /** Colors in the usual order. */
  colors: string[];
  /** The class with the most creature copies ("caballero"), or null without creatures. */
  archetype: string | null;
  /** Every class of its creatures. */
  classes: string[];
  /** Its special summon methods ("promotion"…), most copies first. */
  summons: string[];
  /** "st": only cards of one Structure; "e1": only the E1 block; "mixed": anything else. */
  format: 'st' | 'e1' | 'mixed';
  /** Its card names, lowercase without accents (the search box finds a deck by a card in it). */
  cardNames: string[];
}

/** The criteria of the deck search; empty strings mean any. */
export interface DeckSearch {
  text: string;
  color: string;
  archetype: string;
  summon: string;
  format: string;
  origin: '' | 'system' | 'community';
  /** A quick-access folder ("st", "e1", "arquetipo", "community"), or "" for every deck. */
  folder: string;
}

export const EMPTY_DECK_SEARCH: DeckSearch = { text: '', color: '', archetype: '', summon: '', format: '', origin: '', folder: '' };

export const FORMAT_LABELS: Record<DeckProfile['format'], string> = { st: 'Structure', e1: 'Bloque E1', mixed: 'Mixto' };

/** The quick-access folders of "Mazos públicos", in order (the system's rows, then the players' decks). */
export const DECK_FOLDERS: readonly { id: string; label: string; color: 'amber' | 'blue' | 'violet' | 'slate' }[] = [
  { id: 'st', label: 'Structure', color: 'amber' },
  { id: 'e1', label: 'Bloque E1', color: 'blue' },
  { id: 'arquetipo', label: 'Arquetipos', color: 'violet' },
  { id: 'community', label: 'Comunidad', color: 'slate' },
];

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
    const ed = [...editions];
    const sts = new Set(ed.filter((e) => /^ST\d/.test(e)));
    const format: DeckProfile['format'] =
      ed.length > 0 && sts.size === 1 && ed.every((e) => sts.has(e)) ? 'st' : ed.length > 0 && ed.every((e) => e === 'E1' || e.startsWith('E1.')) ? 'e1' : 'mixed';
    out.set(deck.id, {
      colors: CARD_COLORS.filter((c) => colors.has(c)),
      archetype: byCount(classes)[0] ?? null,
      classes: byCount(classes),
      summons: byCount(summons),
      format,
      cardNames: [...names].filter(Boolean),
    });
  }
  return out;
}

/** The folder a public deck is kept in: its system row, or the community. */
export function folderOf(deck: Deck): string {
  return deck.systemDeck ? (deck.systemGroup ?? 'arquetipo') : 'community';
}

export function hasDeckSearch(s: DeckSearch): boolean {
  return !!(s.text.trim() || s.color || s.archetype || s.summon || s.format || s.origin);
}

/**
 * The decks that meet every criterion. The search box looks in the deck's name, its author, its classes and its cards
 * (accents and case aside), each word on its own: "rojo krugel" finds red decks with Krugel.
 */
export function searchDecks(decks: readonly Deck[], s: DeckSearch, profiles: ReadonlyMap<string, DeckProfile>): Deck[] {
  const words = plain(s.text).split(/\s+/).filter(Boolean);
  return decks.filter((deck) => {
    const p = profiles.get(deck.id);
    if (s.folder && folderOf(deck) !== s.folder) return false;
    if (s.origin === 'system' && !deck.systemDeck) return false;
    if (s.origin === 'community' && deck.systemDeck) return false;
    if (s.color && !p?.colors.includes(s.color)) return false;
    if (s.archetype && p?.archetype !== s.archetype) return false;
    if (s.summon && !p?.summons.includes(s.summon)) return false;
    if (s.format && p?.format !== s.format) return false;
    if (words.length) {
      const name = plain(deck.deckName);
      const author = plain(deck.username ?? '');
      const classes = (p?.classes ?? []).map(plain);
      const cards = p?.cardNames ?? [];
      const colorNames = (p?.colors ?? []).map((c) => plain(COLOR_WORDS[c] ?? ''));
      for (const w of words) {
        const found =
          name.includes(w) || author.includes(w) || classes.some((k) => k.includes(w)) || cards.some((c) => c.includes(w)) || colorNames.includes(w);
        if (!found) return false;
      }
    }
    return true;
  });
}

const COLOR_WORDS: Record<string, string> = { B: 'azul', G: 'verde', P: 'violeta', R: 'rojo', W: 'blanco' };

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

/** "muerto viviente" → "Muerto viviente". */
export function archetypeLabel(k: string): string {
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : k;
}
