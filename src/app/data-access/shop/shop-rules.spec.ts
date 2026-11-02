import { describe, expect, it } from 'vitest';
import { Edition } from '../editions/edition.model';
import { BOX_PRICE, openingQuery, productFor, DAILY_GEMS, PACK_PRICE, STARTING_GEMS, SUB_EDITION_BOX_PRICE, boxPrice, dayOf, isSubEdition, openWallet, shopProducts, spend } from './shop-rules';

const pack = (name: string) => ({ name, cardsPerRarity: { C: 6, UC: 3, R: 1, SR: 0, SEC: 0 } });

describe('dayOf', () => {
  it('uses the local calendar day', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('openWallet', () => {
  it('starts a new wallet with the starting gems and no extra reward', () => {
    expect(openWallet(null, '2026-11-02')).toEqual({ wallet: { gems: STARTING_GEMS, lastReward: '2026-11-02' }, reward: 0 });
  });

  it('gives the daily reward once per day', () => {
    const first = openWallet({ gems: 50, lastReward: '2026-11-01' }, '2026-11-02');
    expect(first).toEqual({ wallet: { gems: 50 + DAILY_GEMS, lastReward: '2026-11-02' }, reward: DAILY_GEMS });
    expect(openWallet(first.wallet, '2026-11-02').reward).toBe(0);
  });

  it('repairs a broken saved wallet', () => {
    expect(openWallet({ gems: Number.NaN, lastReward: '' }, '2026-11-02').wallet.gems).toBe(STARTING_GEMS);
    expect(openWallet({ gems: -20, lastReward: '2026-11-01' }, '2026-11-02').wallet.gems).toBe(DAILY_GEMS);
  });
});

describe('spend', () => {
  it('pays when the gems reach, refuses otherwise', () => {
    expect(spend({ gems: 100, lastReward: 'x' }, 100)?.gems).toBe(0);
    expect(spend({ gems: 99, lastReward: 'x' }, 100)).toBeNull();
  });
});

describe('shopProducts', () => {
  it('sells nothing without pack types', () => {
    expect(shopProducts({ editionId: 'E1' })).toEqual([]);
  });

  it('sells one pack per pack type, with its rarities', () => {
    const products = shopProducts({ editionId: 'E1', packTypes: [pack('Normal'), pack('Premium')] });
    expect(products.map((p) => p.name)).toEqual(['Sobre Normal', 'Sobre Premium']);
    expect(products[0].price).toBe(PACK_PRICE);
    expect(products[0].contents).toEqual([
      { rarity: 'C', count: 6 },
      { rarity: 'UC', count: 3 },
      { rarity: 'R', count: 1 },
    ]);
  });

  it('adds a random pack and the box when a box is configured', () => {
    const edition: Edition = {
      editionId: 'E1',
      packTypes: [pack('Normal')],
      boxConfig: { totalPacks: 24, entries: [{ packTypeName: 'Normal', mode: 'FIXED', quantity: 24, probOptions: [] }] },
    };
    const products = shopProducts(edition);
    expect(products.map((p) => p.kind)).toEqual(['pack', 'random', 'box']);
    expect(products[2]).toMatchObject({ name: 'Caja de 24 sobres', packs: 24, price: BOX_PRICE });
  });
});

describe('boxPrice', () => {
  it('costs less for a sub-edition', () => {
    expect(boxPrice('E1')).toBe(BOX_PRICE);
    expect(boxPrice('E1.2')).toBe(SUB_EDITION_BOX_PRICE);
    expect(isSubEdition('ST1')).toBe(false);
  });
});

describe('productFor and openingQuery', () => {
  const edition: Edition = {
    editionId: 'E1',
    packTypes: [pack('Normal'), pack('Premium')],
    boxConfig: { totalPacks: 24, entries: [{ packTypeName: 'Normal', mode: 'FIXED', quantity: 24, probOptions: [] }] },
  };

  it('finds the product of each opening', () => {
    expect(productFor(edition, { mode: 'box' })?.kind).toBe('box');
    expect(productFor(edition, { mode: 'pack', packType: 'Normal', random: '1' })?.kind).toBe('random');
    expect(productFor(edition, { mode: 'pack', packType: 'Premium' })?.id).toBe('pack:Premium');
    expect(productFor(edition, { mode: 'pack', packType: 'Nope' })).toBeNull();
  });

  it('builds the query back from each product', () => {
    for (const product of shopProducts(edition)) {
      const query = openingQuery(edition, product, () => 'Normal');
      expect(productFor(edition, query)?.id).toBe(product.id);
    }
  });
});

