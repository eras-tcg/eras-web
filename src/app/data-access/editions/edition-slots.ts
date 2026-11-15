import { CardMeta, CatalogCard } from '@data/cards/card.model';
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

/**
 * An edition's slots by color: the colors and count it declares (colors × cards per color), widened by the cards it
 * already has (a color or number beyond them still shows). Each slot carries its card when there is one: the
 * metadata by code, and the catalog card (with the image) of that metadata.
 */
export function editionSlots(
  edition: Pick<Edition, 'editionId' | 'colors' | 'cardsPerColor'>,
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
    const count = Math.max(edition.cardsPerColor ?? 0, ...here.map((m) => m.cardNumber!), 0);
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
