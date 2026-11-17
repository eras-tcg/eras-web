import { CARD_RARITIES, CARD_TYPE_LABELS, CardMeta, CatalogCard } from '@data/cards/card.model';
import { isStructure } from '@data/shop/shop-rules';
import { Edition } from './edition.model';

/** One place of an edition: its code and the card in it, if any (its metadata and, when it has one, its image). */
export interface EditionSlot {
  color: string;
  number: number;
  code: string;
  meta: CardMeta | null;
  card: CatalogCard | null;
}

/** The colors in the order the site shows them. */
const COLOR_ORDER = ['B', 'G', 'P', 'R', 'W'];

/** The edition a card's metadata belongs to: "E1.1" for edition E1, sub-edition 1. */
export function metaEditionId(m: Pick<CardMeta, 'edition' | 'subEdition'>): string {
  return m.subEdition ? `${m.edition}.${m.subEdition}` : (m.edition ?? '');
}

/** White cards an edition other than a structure deck has when it does not say: always 5. */
export const WHITE_SLOTS = 5;

/**
 * How many cards of a color an edition has: its own count, else 5 white in an edition other than a structure deck,
 * else the cards per color.
 */
export function slotsForColor(
  edition: Pick<Edition, 'editionId' | 'cardsPerColor' | 'cardsByColor'>,
  color: string,
): number {
  const own = edition.cardsByColor?.[color.toUpperCase()];
  if (own != null) return own;
  if (color.toUpperCase() === 'W' && !isStructure(edition.editionId)) return WHITE_SLOTS;
  return edition.cardsPerColor ?? 0;
}

/**
 * An edition's slots by color: the colors and count it declares (slotsForColor), widened by the cards it
 * already has (a color or number beyond them still shows). Each slot carries its card when there is one: the
 * metadata by code, and the catalog card (with the image) of that metadata.
 */
export function editionSlots(
  edition: Pick<Edition, 'editionId' | 'colors' | 'cardsPerColor' | 'cardsByColor'>,
  metas: readonly CardMeta[],
  catalog: readonly CatalogCard[] = [],
): { color: string; slots: EditionSlot[] }[] {
  const id = edition.editionId;
  const mine = metas.filter((m) => metaEditionId(m) === id && m.cardNumber != null && m.colorIdentity);
  const byMeta = new Map(catalog.filter((c) => c.meta).map((c) => [c.meta!.id, c]));
  const colors = new Set<string>([...(edition.colors ?? []), ...mine.map((m) => m.colorIdentity!.toUpperCase())]);
  const order = [...colors].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b));
  return order.map((color) => {
    const here = mine.filter((m) => m.colorIdentity!.toUpperCase() === color);
    const count = Math.max(slotsForColor(edition, color), ...here.map((m) => m.cardNumber!), 0);
    const slots: EditionSlot[] = [];
    for (let n = 1; n <= count; n++) {
      const meta = here.find((m) => m.cardNumber === n) ?? null;
      slots.push({
        color,
        number: n,
        code: `${id}-${color}${String(n).padStart(2, '0')}`,
        meta,
        card: meta ? (byMeta.get(meta.id) ?? null) : null,
      });
    }
    return { color, slots };
  });
}

/** How many of its slots have a card, out of how many. */
export function slotsFilled(groups: readonly { slots: readonly EditionSlot[] }[]): { filled: number; total: number } {
  const all = groups.flatMap((g) => g.slots);
  return { filled: all.filter((s) => s.meta).length, total: all.length };
}

/** One count of a metric: its key, what it reads and how many cards. */
export interface MetricCount {
  key: string;
  label: string;
  value: number;
}

/**
 * How many of the edition's cards there are by rarity, by level and by card type (each in its usual order), and, for a
 * structure deck, its rarities counting each card's copies in the deck.
 */
export function editionMetrics(metas: readonly CardMeta[]): {
  total: number;
  rarity: MetricCount[];
  rarityInDeck: MetricCount[];
  level: MetricCount[];
  type: MetricCount[];
} {
  const count = (keyOf: (m: CardMeta) => string, weight: (m: CardMeta) => number = () => 1) => {
    const out = new Map<string, number>();
    for (const m of metas) out.set(keyOf(m), (out.get(keyOf(m)) ?? 0) + weight(m));
    return out;
  };
  const rarities = count((m) => m.rarity || '');
  const inDeck = count((m) => m.rarity || '', (m) => m.deckCopies ?? 0);
  const rarityKeys = [...CARD_RARITIES, ...[...rarities.keys()].filter((k) => !(CARD_RARITIES as readonly string[]).includes(k))];
  const levels = count((m) => (m.level == null ? '' : String(m.level)));
  const levelKeys = [...levels.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : Number(a) - Number(b)));
  const types = count((m) => m.cardType || 'creature');
  const typeOrder = Object.keys(CARD_TYPE_LABELS);
  const typeKeys = [...types.keys()].sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
  return {
    total: metas.length,
    rarity: rarityKeys
      .filter((k) => rarities.has(k) || k !== '')
      .map((k) => ({ key: k || 'none', label: k || 'Sin rareza', value: rarities.get(k) ?? 0 })),
    rarityInDeck: rarityKeys
      .filter((k) => rarities.has(k) || k !== '')
      .map((k) => ({ key: k || 'none', label: k || 'Sin rareza', value: inDeck.get(k) ?? 0 })),
    level: levelKeys.map((k) => ({ key: k || 'none', label: k ? `Nivel ${k}` : 'Sin nivel', value: levels.get(k) ?? 0 })),
    type: typeKeys.map((k) => ({ key: k, label: CARD_TYPE_LABELS[k] ?? k, value: types.get(k) ?? 0 })),
  };
}

/** A structure deck's size: the copies its cards bring (a card without a number counts none). */
export function deckSize(groups: readonly { slots: readonly EditionSlot[] }[]): number {
  return groups.flatMap((g) => g.slots).reduce((sum, s) => sum + (s.meta?.deckCopies ?? 0), 0);
}
