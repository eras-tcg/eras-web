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

/**
 * Where an edition sits among the others when telling an original from its reprints: structure decks first (each
 * chain starts in one: ST1–4 are reprinted in E1, ST5–8 in E2), then E1, E1.1 … E2, E2.1 …
 */
export function editionRank(editionId: string): number[] {
  const m = /^([A-Z]+)(\d+)(?:\.(\d+))?$/i.exec(editionId);
  if (!m) return [9, 0, 0];
  return [m[1].toUpperCase() === 'ST' ? 0 : 1, Number(m[2]), Number(m[3] ?? 0)];
}

const sameName = (name: string | null | undefined) =>
  (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, ' ')
    .trim();

/**
 * The reprints among the cards: for each card printed earlier under the same name (accents, case and hyphens aside),
 * the code of its first printing. The first printing itself is not a reprint. Earlier is by the editions' release dates;
 * an edition without one goes after the dated ones, by editionRank.
 */
export function reprintOrigins(
  metas: readonly CardMeta[],
  releaseDates: ReadonlyMap<string, string> = new Map(),
): Map<string, string> {
  const byName = new Map<string, CardMeta[]>();
  for (const m of metas) {
    const key = sameName(m.cardName);
    if (!key || !m.edition || m.cardNumber == null) continue;
    byName.set(key, [...(byName.get(key) ?? []), m]);
  }
  const dateOf = (m: CardMeta) => releaseDates.get(metaEditionId(m)) || '\uffff';
  const before = (a: CardMeta, b: CardMeta) => {
    const byDate = dateOf(a).localeCompare(dateOf(b));
    if (byDate !== 0) return byDate;
    const ra = editionRank(metaEditionId(a));
    const rb = editionRank(metaEditionId(b));
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  };
  const out = new Map<string, string>();
  for (const printings of byName.values()) {
    if (printings.length < 2) continue;
    const first = [...printings].sort(before)[0];
    const code = `${metaEditionId(first)}-${(first.colorIdentity ?? '').toUpperCase()}${String(first.cardNumber).padStart(2, '0')}`;
    for (const m of printings) if (m !== first && before(m, first) !== 0) out.set(m.id, code);
  }
  return out;
}

/** The card's other printings: the cards with its name (accents, case and hyphens aside) in other slots. */
export function otherPrintings(name: string | null | undefined, id: string | null, metas: readonly CardMeta[]): CardMeta[] {
  const key = sameName(name);
  if (!key) return [];
  return metas.filter((m) => m.id !== id && sameName(m.cardName) === key && m.edition && m.cardNumber != null);
}

/**
 * What another printing takes when its card is edited: the whole card (text, numbers, design) but what belongs to
 * that printing: its slot (edition, sub-edition, number, color), its rarity and its regulation.
 */
export function printingPayload<T extends Partial<CardMeta>>(edited: T, printing: CardMeta): T {
  return {
    ...edited,
    edition: printing.edition,
    subEdition: printing.subEdition ?? '',
    cardNumber: printing.cardNumber,
    colorIdentity: printing.colorIdentity,
    rarity: printing.rarity ?? null,
    regulation: printing.regulation ?? null,
  };
}
