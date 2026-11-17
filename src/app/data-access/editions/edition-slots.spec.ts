import { describe, expect, it } from 'vitest';
import { CardMeta, CatalogCard } from '@data/cards/card.model';
import { deckSize, editionMetrics, editionRank, editionSlots, metaEditionId, reprintOrigins, slotsFilled, slotsForColor } from './edition-slots';

const meta = (over: Partial<CardMeta>): CardMeta => ({ id: 'm', cardName: 'X', edition: 'ST2', colorIdentity: 'G', cardNumber: 1, ...over }) as CardMeta;

describe('edition slots', () => {
  it('lays out colors × cards per color, each slot with its card', () => {
    const metas = [meta({ id: 'a', cardNumber: 2, cardName: 'Liolón' }), meta({ id: 'b', edition: 'ST1', cardNumber: 2 })];
    const catalog = [{ id: 'img', meta: metas[0] } as CatalogCard];
    const [green] = editionSlots({ editionId: 'ST2', colors: ['G'], cardsPerColor: 3 }, metas, catalog);
    expect(green.color).toBe('G');
    expect(green.slots.map((s) => s.code)).toEqual(['ST2-G01', 'ST2-G02', 'ST2-G03']);
    expect(green.slots[1].meta?.cardName).toBe('Liolón');
    expect(green.slots[1].card?.id).toBe('img');
    expect(green.slots[0].meta).toBeNull();
  });

  it('widens to the cards the edition has beyond what it declares', () => {
    const metas = [meta({ id: 'a', colorIdentity: 'R', cardNumber: 5 }), meta({ id: 'b', cardNumber: 1 })];
    const groups = editionSlots({ editionId: 'ST2', colors: ['G'], cardsPerColor: 2 }, metas);
    expect(groups.map((g) => [g.color, g.slots.length])).toEqual([['G', 2], ['R', 5]]);
    expect(slotsFilled(groups)).toEqual({ filled: 2, total: 7 });
    // Without declared slots: only what it has
    expect(editionSlots({ editionId: 'ST2' }, metas).map((g) => g.slots.length)).toEqual([1, 5]);
  });

  it('gives each color its own count, and 5 white outside structure decks', () => {
    const e = { editionId: 'E1', colors: ['B', 'W'], cardsPerColor: 25 };
    expect(slotsForColor(e, 'B')).toBe(25);
    expect(slotsForColor(e, 'W')).toBe(5);
    expect(slotsForColor({ ...e, cardsByColor: { W: 4, B: 20 } }, 'W')).toBe(4);
    expect(slotsForColor({ ...e, cardsByColor: { B: 20 } }, 'b')).toBe(20);
    expect(slotsForColor({ editionId: 'ST2', cardsPerColor: 17 }, 'W')).toBe(17);
    const groups = editionSlots(e, []);
    expect(groups.map((g) => [g.color, g.slots.length])).toEqual([
      ['B', 25],
      ['W', 5],
    ]);
  });

  it('reads sub-editions as their own edition', () => {
    expect(metaEditionId({ edition: 'E1', subEdition: '1' })).toBe('E1.1');
    expect(metaEditionId({ edition: 'E1', subEdition: null })).toBe('E1');
  });

  it('counts the cards by rarity, level and type', () => {
    const m = editionMetrics([
      meta({ rarity: 'R', level: 2, cardType: 'creature' }),
      meta({ rarity: 'C', level: 1, cardType: 'creature' }),
      meta({ rarity: 'C', level: null, cardType: 'utility' }),
      meta({ rarity: null, level: 1, cardType: 'creature' }),
    ]);
    expect(m.total).toBe(4);
    expect(m.rarity.map((r) => [r.label, r.value])).toEqual([['C', 2], ['UC', 0], ['R', 1], ['SR', 0], ['SEC', 0], ['Sin rareza', 1]]);
    expect(m.level.map((r) => [r.label, r.value])).toEqual([['Nivel 1', 2], ['Nivel 2', 1], ['Sin nivel', 1]]);
    expect(m.type.map((r) => [r.label, r.value])).toEqual([['Criatura', 3], ['Utilidad', 1]]);
  });

  it('counts the rarities of a structure deck by the copies of each card', () => {
    const m = editionMetrics([
      meta({ rarity: 'C', deckCopies: 3 }),
      meta({ rarity: 'C', deckCopies: 2 }),
      meta({ rarity: 'SR', deckCopies: 1 }),
      meta({ rarity: 'R' }),
    ]);
    expect(m.rarityInDeck.filter((r) => r.value).map((r) => [r.label, r.value])).toEqual([['C', 5], ['SR', 1]]);
  });

  it('adds up a structure deck from its cards copies', () => {
    const groups = editionSlots({ editionId: 'ST2', colors: ['G'], cardsPerColor: 3 }, [
      meta({ id: 'a', cardNumber: 1, deckCopies: 3 }),
      meta({ id: 'b', cardNumber: 2, deckCopies: 1 }),
      meta({ id: 'c', cardNumber: 3 }),
    ]);
    expect(deckSize(groups)).toBe(4);
  });
});

describe('reprints', () => {
  it('orders structure decks first, then editions by number and sub-edition', () => {
    expect(editionRank('ST7')).toEqual([0, 7, 0]);
    expect(editionRank('E1.3')).toEqual([1, 1, 3]);
    expect(editionRank('E2')).toEqual([1, 2, 0]);
  });

  it('marks every later printing with its first one, names alike but for accents, case and hyphens', () => {
    const st = meta({ id: 'st', cardName: 'Eliséo', edition: 'ST1', colorIdentity: 'B', cardNumber: 1 });
    const e1 = meta({ id: 'e1', cardName: 'Eliseo', edition: 'E1', subEdition: null, colorIdentity: 'B', cardNumber: 2 });
    const e2 = meta({ id: 'e2', cardName: 'SAR-2', edition: 'E2', subEdition: '1', colorIdentity: 'B', cardNumber: 9 });
    const e3 = meta({ id: 'e3', cardName: 'SAR 2', edition: 'E3', colorIdentity: 'B', cardNumber: 4 });
    const lone = meta({ id: 'lone', cardName: 'Ephos', edition: 'E1', colorIdentity: 'B', cardNumber: 3 });
    const origins = reprintOrigins([e1, st, e2, e3, lone]);
    expect(origins.get('e1')).toBe('ST1-B01');
    expect(origins.get('e3')).toBe('E2.1-B09');
    expect(origins.has('st')).toBe(false);
    expect(origins.has('e2')).toBe(false);
    expect(origins.has('lone')).toBe(false);
  });

  it('goes by release date when the editions have one', () => {
    const old = meta({ id: 'old', cardName: 'Jhav', edition: 'E2', colorIdentity: 'B', cardNumber: 1 });
    const st = meta({ id: 'st', cardName: 'Jhav', edition: 'ST5', colorIdentity: 'B', cardNumber: 2 });
    const dates = new Map([
      ['ST5', '2026-03-11'],
      ['E2', '2026-04-11'],
    ]);
    expect(reprintOrigins([old, st], dates).get('old')).toBe('ST5-B02');
    // E2 dated before ST5: E2 is the first printing
    expect(reprintOrigins([old, st], new Map([['E2', '2025-01-01'], ['ST5', '2026-03-11']])).get('st')).toBe('E2-B01');
  });
});
