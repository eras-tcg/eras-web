import { describe, expect, it } from 'vitest';
import { CatalogCard } from '../cards/card.model';
import { BoxEntry, Edition } from '../editions/edition.model';
import { BOX_PRICE, PACK_PRICE, STRUCTURE_PRICE, SUB_EDITION_BOX_PRICE, altArtOdds, boxContents, boxPrice, fromPercent, isSubEdition, openingQuery, packOdds, productFor, shopProducts, toPercent } from './shop-rules';

const pack = (name: string) => ({ name, cardsPerRarity: { C: 6, UC: 3, R: 1, SR: 0, SEC: 0 } });

const box = (entries: BoxEntry[], totalPacks = 24): Edition => ({
  editionId: 'E1',
  packTypes: [pack('Normal'), pack('SR'), pack('SEC')],
  boxConfig: { totalPacks, entries },
});

describe('shopProducts', () => {
  it('sells nothing without pack types', () => {
    expect(shopProducts({ editionId: 'E1' })).toEqual([]);
  });

  it('sells one pack (never a chosen type) and, with a box, the booster box', () => {
    expect(shopProducts({ editionId: 'E1', packTypes: [pack('Normal'), pack('SR')] })).toEqual([{ kind: 'pack', name: 'Sobre', price: PACK_PRICE }]);
    const products = shopProducts(box([{ packTypeName: 'Normal', mode: 'FIXED', quantity: 24, probOptions: [] }]));
    expect(products.map((p) => p.kind)).toEqual(['pack', 'box']);
    expect(products[1]).toMatchObject({ name: 'Booster box', packs: 24, price: BOX_PRICE });
  });
});

describe('structure decks', () => {
  it('sell themselves whole, never in packs', () => {
    const st = { editionId: 'ST1', packTypes: [pack('Normal')] };
    expect(shopProducts(st)).toEqual([{ kind: 'structure', name: 'Structure deck', price: STRUCTURE_PRICE }]);
    expect(productFor(st, { mode: 'structure' })?.kind).toBe('structure');
    expect(openingQuery(st, shopProducts(st)[0])).toEqual({ edition: 'ST1', mode: 'structure' });
  });
});

describe('boxPrice', () => {
  it('costs less for a sub-edition', () => {
    expect(boxPrice('E1')).toBe(BOX_PRICE);
    expect(boxPrice('E1.2')).toBe(SUB_EDITION_BOX_PRICE);
    expect(isSubEdition('ST1')).toBe(false);
  });
});

describe('packOdds', () => {
  const odds = (edition: Edition) => Object.fromEntries(packOdds(edition).map((o) => [o.packType, o.probability]));

  it('is the first pack type without a box', () => {
    expect(odds({ editionId: 'E1', packTypes: [pack('Normal'), pack('SR')] })).toEqual({ Normal: 1, SR: 0 });
  });

  it('follows a fixed box', () => {
    const o = odds(box([
      { packTypeName: 'SR', mode: 'FIXED', quantity: 6, probOptions: [] },
      { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
    ]));
    expect(o['SR']).toBeCloseTo(0.25);
    expect(o['Normal']).toBeCloseTo(0.75);
    expect(o['SEC']).toBe(0);
  });

  it('lists the likeliest pack type first', () => {
    const order = packOdds(box([
      { packTypeName: 'SR', mode: 'FIXED', quantity: 6, probOptions: [] },
      { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
    ])).map((o) => o.packType);
    expect(order[0]).toBe('Normal');
    expect(order[1]).toBe('SR');
  });

  it('weighs every roll of a PROB entry', () => {
    // SEC: 0 packs (50%) or 4 packs (50%) of 24; the rest Normal
    const o = odds(box([
      { packTypeName: 'SEC', mode: 'PROB', quantity: 0, probOptions: [{ quantity: 0, prob: 0.5 }, { quantity: 4, prob: 0.5 }] },
      { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
    ]));
    expect(o['SEC']).toBeCloseTo(0.5 * (4 / 24));
    expect(o['SEC'] + o['Normal'] + o['SR']).toBeCloseTo(1);
  });
});

describe('boxContents', () => {
  it('gives fixed counts, PROB ranges with their chances and the FLEX remainder, the most packs first', () => {
    const contents = boxContents(box([
      { packTypeName: 'SR', mode: 'FIXED', quantity: 2, probOptions: [] },
      { packTypeName: 'SEC', mode: 'PROB', quantity: 0, probOptions: [{ quantity: 3, prob: 0.3 }, { quantity: 1, prob: 0.7 }] },
      { packTypeName: 'Normal', mode: 'FLEX', quantity: 0, probOptions: [] },
    ]));
    expect(contents).toEqual([
      { packType: 'Normal', min: 19, max: 21 },
      { packType: 'SR', min: 2, max: 2 },
      { packType: 'SEC', min: 1, max: 3, options: [{ quantity: 1, probability: 0.7 }, { quantity: 3, probability: 0.3 }] },
    ]);
  });
});

describe('productFor and openingQuery', () => {
  const edition = box([{ packTypeName: 'Normal', mode: 'FIXED', quantity: 24, probOptions: [] }]);

  it('finds the product of each opening and builds its query back', () => {
    expect(productFor(edition, { mode: 'box' })?.kind).toBe('box');
    expect(productFor(edition, { mode: 'pack', packType: 'SR' })?.kind).toBe('pack');
    for (const product of shopProducts(edition)) {
      const query = openingQuery(edition, product);
      expect(productFor(edition, query)?.kind).toBe(product.kind);
    }
    expect(openingQuery(edition, shopProducts(edition)[0])).toEqual({ edition: 'E1', mode: 'pack' });
  });
});

describe('alternative arts in the odds table', () => {
  it('lists every alternative art of the edition with its own odds or the shop odds', () => {
    const titan = { id: 't', name: 'Titan', meta: { id: 'm', altArts: [{ id: 'a', url: 'u1' }, { id: 'b', url: 'u2', odds: 0.01 }] } } as CatalogCard;
    const plain = { id: 'p', name: 'Plain', meta: { id: 'n' } } as CatalogCard;
    expect(altArtOdds([titan, plain], 0.0001).map((r) => [r.card.id, r.art.id, r.number, r.odds])).toEqual([
      ['t', 'a', 1, 0.0001],
      ['t', 'b', 2, 0.01],
    ]);
  });

  it('turns odds into the percent typed and back', () => {
    expect(toPercent(0.0001)).toBe(0.01);
    expect(toPercent(0.05)).toBe(5);
    expect(fromPercent('0,01')).toBe(0.0001);
    expect(fromPercent('5')).toBe(0.05);
    expect(fromPercent('')).toBeNull();
    expect(fromPercent('120')).toBeNull();
    expect(fromPercent('abc')).toBeNull();
  });
});
