import { CatalogCard } from '../cards/card.model';
import { Collection } from './collection.model';
import { altFinish, deckCopies, bestFinish, bestFinishAmong, coverFinish, breakPlan, craftCosts, craftedSummary, missingCards, deckCopyFinishes, ownedFinishes, shineOf, extraCopies, extrasOf, fragmentsFrom, missingCopies, ownedCount } from './collection-rules';

const card = (id: string) => ({ id }) as CatalogCard;
const collection: Collection = { cards: { a: { plain: 1, foil: 1 }, b: { plain: 5, prism: 1 } }, fragments: { C: 40 } };

describe('collection rules', () => {
  it('counts the copies with the alternative art as the same card, and never breaks them', () => {
    const titan = { cards: { t: { plain: 2, 'alt-foil': 1 } }, fragments: {} } as Collection;
    expect(ownedCount(titan, 't')).toBe(3);
    expect(altFinish(titan.cards['t'])).toBe('foil');
    expect(altFinish({ plain: 4 })).toBeNull();
    expect(extrasOf({ plain: 5, 'alt-plain': 2 })).toEqual({ plain: 1 });
    expect(breakPlan({ 'alt-prism': 1, plain: 1 }, 2)).toEqual({ plain: 1 });
  });

  it("plays a deck's alternative art first, then the finest finishes", () => {
    expect(deckCopies({ plain: 1, prism: 1, 'alt-plain': 1 }, 4)).toEqual([
      { finish: 'plain', alt: true },
      { finish: 'prism', alt: false },
      { finish: 'plain', alt: false },
      { finish: null, alt: false },
    ]);
  });

  it('counts every finish of a card', () => {
    expect(ownedCount(collection, 'a')).toBe(2);
    expect(ownedCount(collection, 'z')).toBe(0);
    expect(ownedCount(null, 'a')).toBe(0);
  });

  it('counts the copies a deck lacks, printing by printing', () => {
    expect(missingCopies([{ card: card('a'), count: 3 }, { card: card('b'), count: 4 }, { card: card('z'), count: 1 }], collection)).toBe(2);
  });

  it('keeps the finest copies and counts the rest as extra', () => {
    expect(extrasOf({ plain: 5, prism: 1 })).toEqual({ plain: 2 });
    expect(extrasOf({ foil: 6 })).toEqual({ foil: 2 });
    expect(extrasOf({ plain: 4 })).toEqual({});
    expect(extraCopies(collection)).toBe(2);
  });

  it('breaks the plainest copies first', () => {
    expect(breakPlan({ plain: 1, foil: 2, prism: 1 }, 2)).toEqual({ plain: 1, foil: 1 });
    expect(breakPlan({ prism: 1 }, 3)).toEqual({ prism: 1 });
    expect(fragmentsFrom({ plain: 1, foil: 1 })).toBe(40);
  });

  it('counts what a craft gave by finish', () => {
    expect(craftedSummary(['plain', 'foil', 'plain', 'prism'])).toBe('2 normales, 1 foil, 1 prismática');
    expect(craftedSummary(['plain'])).toBe('1 normal');
  });

  it('puts the finest finishes first, for the list and for a deck\'s copies', () => {
    expect(ownedFinishes({ plain: 2, prism: 1 })).toEqual(['prism', 'plain']);
    expect(bestFinish({ plain: 2, foil: 1 })).toBe('foil');
    expect(bestFinish(undefined)).toBeNull();
    expect(deckCopyFinishes({ plain: 1, foil: 1 }, 4)).toEqual(['foil', 'plain', null, null]);
    expect(shineOf('plain')).toBeNull();
    expect(shineOf('prism')).toBe('prism');
  });

  it('takes the finest finish among the printings of a card', () => {
    expect(bestFinishAmong(collection, ['a', 'b'])).toBe('prism');
    expect(bestFinishAmong(collection, ['a', 'z'])).toBe('foil');
    expect(bestFinishAmong(collection, ['z'])).toBeNull();
    expect(bestFinishAmong(null, ['a'])).toBeNull();
  });

  it('prices crafting a deck\'s missing cards by rarity', () => {
    const sr = { id: 'b', meta: { rarity: 'SR' } } as CatalogCard;
    const c = { id: 'z', meta: { rarity: 'C' } } as CatalogCard;
    const missing = missingCards([{ card: card('a'), count: 2 }, { card: sr, count: 7 }, { card: c, count: 2 }], collection);
    expect(missing.map((m) => [m.card.id, m.count])).toEqual([['b', 1], ['z', 2]]);
    expect(craftCosts(missing, { C: 40 })).toEqual([
      { rarity: 'SR', copies: 1, cost: 30, owned: 0 },
      { rarity: 'C', copies: 2, cost: 60, owned: 40 },
    ]);
  });

  it('shines a deck cover as the finest copy owned of the card it shows', () => {
    const catalog = [{ id: 'a', image_url: 'img/a' }, { id: 'b', image_url: 'img/b' }] as CatalogCard[];
    expect(coverFinish({ cards: ['a', 'b'], deckImage: 'img/b' }, catalog, collection)).toBe('prism');
    expect(coverFinish({ cards: ['a'], deckImage: 'img/a' }, catalog, collection)).toBe('foil');
    expect(coverFinish({ cards: ['a'], deckImage: 'img/b' }, catalog, collection)).toBeNull();
    expect(coverFinish({ cards: ['a'], deckImage: null }, catalog, collection)).toBeNull();
  });
});
