import { describe, expect, it } from 'vitest';
import { CatalogCard } from '../cards/card.model';
import { cardsByRarity, groupOpening, openBox, openBoxPacks, openPack, packTier, revealOrder, rollQuantity, shuffle } from './booster-rules';
import { Edition, PackType } from './edition.model';

const card = (id: string, rarity: string | null, over: Partial<CatalogCard> = {}): CatalogCard => ({
  id,
  name: id,
  edition: 'E1',
  sub_edition: '',
  number: Number(id.replace(/\D/g, '')),
  color_identity: 'B',
  image_url: null,
  time_stamp: null,
  meta: { id: 'm' + id, rarity },
  ...over,
});

const catalog = [
  card('c1', 'C'),
  card('c2', 'C'),
  card('c3', null),
  card('r4', 'R'),
  card('s5', 'SR'),
  card('x6', 'C', { sub_edition: '1' }),
  card('n7', 'C', { meta: null }),
];

const pack = (over: Partial<PackType['cardsPerRarity']> = {}): PackType => ({
  name: 'Normal',
  cardsPerRarity: { C: 3, UC: 0, R: 1, SR: 0, SEC: 0, ...over },
});

/** Deterministic "random" cycling through the given values. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('cardsByRarity', () => {
  it('keeps the edition (and sub-edition) cards that have metadata; no rarity counts as C', () => {
    const pool = cardsByRarity(catalog, 'E1');
    expect(pool.get('C')?.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(pool.get('R')?.map((c) => c.id)).toEqual(['r4']);
    expect(cardsByRarity(catalog, 'E1.1').get('C')?.map((c) => c.id)).toEqual(['x6']);
  });
});

describe('openPack', () => {
  it('draws the configured amount per rarity, skipping rarities without cards', () => {
    const pool = cardsByRarity(catalog, 'E1');
    const picked = openPack(pack({ UC: 2 }), pool, seq(0, 0.5, 0.99, 0));
    expect(picked.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'r4']);
  });
});

describe('rollQuantity', () => {
  it('walks the cumulative probabilities', () => {
    const options = [
      { quantity: 1, prob: 0.75 },
      { quantity: 2, prob: 0.25 },
    ];
    expect(rollQuantity(options, () => 0.5)).toBe(1);
    expect(rollQuantity(options, () => 0.9)).toBe(2);
    expect(rollQuantity([{ quantity: 3, prob: 0.2 }], () => 0.9)).toBe(3);
  });
});

describe('openBox', () => {
  it('opens FIXED, then PROB, then fills the rest with FLEX', () => {
    const edition: Edition = {
      editionId: 'E1',
      packTypes: [pack({ C: 1, R: 0 }), { name: 'Rara', cardsPerRarity: { C: 0, UC: 0, R: 0, SR: 1, SEC: 0 } }],
      boxConfig: {
        totalPacks: 5,
        entries: [
          { packTypeName: 'Normal', mode: 'FIXED', quantity: 1, probOptions: [] },
          { packTypeName: 'Rara', mode: 'PROB', quantity: 0, probOptions: [{ quantity: 2, prob: 1 }] },
          { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
        ],
      },
    };
    const picked = openBox(edition, cardsByRarity(catalog, 'E1'), () => 0);
    // 1 fixed Normal + 2 Rara + 2 flex Normal = 5 packs of 1 card
    expect(picked.map((c) => c.id)).toEqual(['c1', 's5', 's5', 'c1', 'c1']);
  });
});

describe('openBoxPacks', () => {
  it('keeps every pack with its type and cards', () => {
    const edition: Edition = {
      editionId: 'E1',
      packTypes: [pack({ C: 1, R: 0 }), { name: 'Rara', cardsPerRarity: { C: 0, UC: 0, R: 0, SR: 1, SEC: 0 } }],
      boxConfig: {
        totalPacks: 3,
        entries: [
          { packTypeName: 'Rara', mode: 'FIXED', quantity: 1, probOptions: [] },
          { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
        ],
      },
    };
    const packs = openBoxPacks(edition, cardsByRarity(catalog, 'E1'), () => 0);
    expect(packs.map((p) => [p.packType, p.cards.map((c) => c.id)])).toEqual([
      ['Rara', ['s5']],
      ['Normal', ['c1']],
      ['Normal', ['c1']],
    ]);
  });
});

describe('packTier', () => {
  const type = (name: string, sr: number, sec: number) => ({ name, cardsPerRarity: { C: 7, UC: 3, R: 1, SR: sr, SEC: sec } });

  it('ranks a pack by what it brings', () => {
    expect(packTier(type('R PACK', 0, 0))).toBe('none');
    expect(packTier(type('SR PACK', 1, 0))).toBe('sr');
    expect(packTier(type('SEC PACK', 0, 1))).toBe('sec');
    expect(packTier(type('Mega', 5, 5))).toBe('god');
    expect(packTier(type('Doble secreta', 0, 2))).toBe('god');
    expect(packTier(type('GOD PACK', 0, 0))).toBe('god');
    expect(packTier(undefined)).toBe('none');
  });
});

describe('shuffle', () => {
  it('keeps every item, in a new order, without touching the original', () => {
    const items = ['a', 'b', 'c', 'd'];
    const out = shuffle(items, seq(0, 0, 0));
    expect([...out].sort()).toEqual(items);
    expect(out).not.toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('revealOrder', () => {
  it('turns the plain cards first and the special ones last, each in their order', () => {
    expect(revealOrder(['C', 'SR', 'UC', 'SEC', 'R'], (r) => r === 'SR' || r === 'SEC')).toEqual({ plain: [0, 2, 4], special: [1, 3] });
  });
});

describe('groupOpening', () => {
  it('counts repeats and orders rarest first', () => {
    const [c1, c2, , r4, s5] = catalog;
    const groups = groupOpening([c2, c1, c1, r4, s5]);
    expect(groups.map((g) => [g.rarity, g.count])).toEqual([
      ['SR', 1],
      ['R', 1],
      ['C', 3],
    ]);
    expect(groups[2].cards.map((c) => [c.card.id, c.count])).toEqual([
      ['c1', 2],
      ['c2', 1],
    ]);
  });
});
