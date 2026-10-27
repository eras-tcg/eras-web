import { CatalogCard } from '../cards/card.model';
import { cardImageUrl, fullEditionId } from '../cards/card-rules';
import { Deck, DeckEntry, Orientation, PaperSize } from './deck.model';

/** Copies allowed per card name, counting every printing of that name. */
export const MAX_COPIES = 4;
export const MAX_CARDS = 100;

export const CARD_TYPE_ORDER = ['creature', 'structure', 'utility'] as const;
const typeRank = (type: string | null | undefined) => {
  const i = CARD_TYPE_ORDER.indexOf((type ?? '') as (typeof CARD_TYPE_ORDER)[number]);
  return i === -1 ? 99 : i;
};

/** Creature → structure → utility, then level, then card number. */
export function sortEntries(entries: readonly DeckEntry[]): DeckEntry[] {
  return [...entries].sort(
    (a, b) =>
      typeRank(a.card.meta?.cardType) - typeRank(b.card.meta?.cardType) ||
      (a.card.meta?.level ?? 0) - (b.card.meta?.level ?? 0) ||
      (a.card.number ?? 0) - (b.card.number ?? 0),
  );
}

/** Deck card ids (one per copy) → entries. Ids not in the catalog are returned apart. */
export function entriesFromIds(ids: readonly string[], cards: readonly CatalogCard[]): { entries: DeckEntry[]; missing: string[] } {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const entries: DeckEntry[] = [];
  const missing: string[] = [];
  for (const [id, count] of counts) {
    const card = byId.get(id);
    if (card) entries.push({ card, count });
    else missing.push(id);
  }
  return { entries: sortEntries(entries), missing };
}

export function idsFromEntries(entries: readonly DeckEntry[]): string[] {
  return entries.flatMap((e) => Array<string>(e.count).fill(e.card.id));
}

export function totalCards(entries: readonly DeckEntry[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

/** Copies of this card's name in the deck, across printings. */
export function copiesOfName(entries: readonly DeckEntry[], name: string | null | undefined): number {
  const key = (name ?? '').toLowerCase();
  if (!key) return 0;
  return entries.reduce((sum, e) => ((e.card.name ?? '').toLowerCase() === key ? sum + e.count : sum), 0);
}

export function canAdd(entries: readonly DeckEntry[], card: CatalogCard): boolean {
  return totalCards(entries) < MAX_CARDS && copiesOfName(entries, card.name) < MAX_COPIES;
}

/** One more copy, or the same list when a limit is reached. */
export function addCard(entries: readonly DeckEntry[], card: CatalogCard): DeckEntry[] {
  if (!canAdd(entries, card)) return [...entries];
  const found = entries.some((e) => e.card.id === card.id);
  return found ? entries.map((e) => (e.card.id === card.id ? { ...e, count: e.count + 1 } : e)) : [...entries, { card, count: 1 }];
}

export function removeCard(entries: readonly DeckEntry[], cardId: string): DeckEntry[] {
  return entries.flatMap((e) => (e.card.id !== cardId ? [e] : e.count > 1 ? [{ ...e, count: e.count - 1 }] : []));
}

export interface EntryGroup {
  type: string;
  entries: DeckEntry[];
  count: number;
}

export function groupByType(entries: readonly DeckEntry[]): EntryGroup[] {
  const groups = new Map<string, DeckEntry[]>();
  for (const e of sortEntries(entries)) {
    const type = e.card.meta?.cardType ?? 'sin tipo';
    groups.set(type, [...(groups.get(type) ?? []), e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => typeRank(a) - typeRank(b))
    .map(([type, list]) => ({ type, entries: list, count: totalCards(list) }));
}

/** Cover stays when it still belongs to a card in the deck; otherwise the first card's image. */
export function resolveCover(entries: readonly DeckEntry[], current: string | null): string | null {
  if (current && entries.some((e) => cardImageUrl(e.card) === current)) return current;
  return entries[0] ? cardImageUrl(entries[0].card) : null;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface DeckMetrics {
  types: Record<string, number>;
  colors: Record<string, number>;
  costs: Record<number, number>;
  levels: Record<number, number>;
  rarities: Record<string, number>;
  specialCosts: Record<number, number>;
}

const bump = <K extends string | number>(record: Record<K, number>, key: K, n: number) => {
  record[key] = (record[key] ?? 0) + n;
};

/** Type and color always count the whole deck (they act as the filters); the other charts honour them. */
export function deckMetrics(entries: readonly DeckEntry[], typeFilter: string | null, colorFilter: string | null): DeckMetrics {
  const m: DeckMetrics = { types: {}, colors: {}, costs: {}, levels: {}, rarities: {}, specialCosts: {} };
  for (const { card, count } of entries) {
    const meta = card.meta;
    if (meta?.cardType) bump(m.types, meta.cardType, count);
    if (card.color_identity) bump(m.colors, card.color_identity, count);
    if (typeFilter && meta?.cardType !== typeFilter) continue;
    if (colorFilter && card.color_identity !== colorFilter) continue;
    if (meta?.cost != null) bump(m.costs, meta.cost, count);
    if (meta?.level != null) bump(m.levels, meta.level, count);
    if (meta?.rarity) bump(m.rarities, meta.rarity, count);
    if (meta?.specialCost != null) bump(m.specialCosts, meta.specialCost, count);
  }
  return m;
}

// ── Text export / import ────────────────────────────────────────────────────
// Format shared with the legacy page so lists exported there still import here.

export function exportDeckText(name: string, entries: readonly DeckEntry[]): string {
  const lines = [`Mazo: ${name}`, `Total: ${totalCards(entries)} cartas`, ''];
  for (const group of groupByType(entries)) {
    lines.push(group.type.toUpperCase());
    for (const e of group.entries) lines.push(`  ${e.count}x ${e.card.name} (${fullEditionId(e.card)} #${e.card.number})`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface ImportResult {
  name: string | null;
  entries: DeckEntry[];
  warnings: string[];
}

export function parseDeckText(text: string, cards: readonly CatalogCard[]): ImportResult {
  const name = text.match(/^Mazo:\s*(.+)$/m)?.[1].trim() ?? null;
  const line = /^\s+(\d+)x\s+(.+?)\s+\(([^)]+)\s+#(\d+)\)\s*$/;
  let entries: DeckEntry[] = [];
  const warnings: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(line);
    if (!m) continue;
    const [, countText, cardName, edition, numberText] = m;
    const count = parseInt(countText, 10);
    const number = parseInt(numberText, 10);
    const [base, sub = ''] = edition.split('.');
    const card = cards.find(
      (c) => (c.name ?? '').toLowerCase() === cardName.toLowerCase() && c.edition === base && c.number === number && (c.sub_edition ?? '') === sub,
    );
    if (!card) {
      warnings.push(`No encontrada: ${count}x ${cardName} (${edition} #${number})`);
      continue;
    }
    // Limits apply as when adding by hand
    for (let i = 0; i < count; i++) {
      const before = totalCards(entries);
      entries = addCard(entries, card);
      if (totalCards(entries) === before) {
        warnings.push(`Se omitieron copias de ${cardName}: máximo ${MAX_COPIES} por nombre y ${MAX_CARDS} cartas por mazo`);
        break;
      }
    }
  }
  return { name, entries: sortEntries(entries), warnings };
}

// ── Proxies ─────────────────────────────────────────────────────────────────

export const PAPER_SIZES: { value: PaperSize; label: string; width: number; height: number }[] = [
  { value: 'letter', label: 'Carta (8.5 × 11 in)', width: 8.5, height: 11 },
  { value: 'a4', label: 'A4 (210 × 297 mm)', width: 8.27, height: 11.69 },
  { value: 'legal', label: 'Legal (8.5 × 14 in)', width: 8.5, height: 14 },
];
export const PROXY_CARD = { width: 2.5, height: 3.5 };
/** Printers usually cannot print closer to the edge than this (inches). */
export const MIN_PRINT_MARGIN = 0.25;

export function cardsPerPage(paper: PaperSize, orientation: Orientation, margin: number): number {
  const size = PAPER_SIZES.find((p) => p.value === paper) ?? PAPER_SIZES[0];
  const [w, h] = orientation === 'landscape' ? [size.height, size.width] : [size.width, size.height];
  const fit = (length: number, card: number) => Math.max(0, Math.floor((length - margin * 2) / card));
  return fit(w, PROXY_CARD.width) * fit(h, PROXY_CARD.height);
}

// ── Deck lists ──────────────────────────────────────────────────────────────

export type DeckSortKey = 'name' | 'username' | 'createdAt';

export function sortDecks(decks: readonly Deck[], key: DeckSortKey, direction: 'asc' | 'desc'): Deck[] {
  const value = (d: Deck) => (key === 'name' ? d.deckName : key === 'username' ? d.username : d.createdAt) ?? '';
  const sign = direction === 'asc' ? 1 : -1;
  return [...decks].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Decks without the value (e.g. old decks without createdAt) always go last
    if (!va || !vb) return !va && !vb ? 0 : !va ? 1 : -1;
    return va.localeCompare(vb, 'es', { sensitivity: 'base' }) * sign;
  });
}
