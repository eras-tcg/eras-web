import { CatalogCard } from '../cards/card.model';
import { Collection } from './collection.model';
import { bestFinish, breakPlan, craftedSummary, deckCopyFinishes, ownedFinishes, shineOf, extraCopies, extrasOf, fragmentsFrom, missingCopies, ownedCount } from './collection-rules';

const card = (id: string) => ({ id }) as CatalogCard;
const collection: Collection = { cards: { a: { plain: 1, foil: 1 }, b: { plain: 5, prism: 1 } }, fragments: { C: 40 } };

describe('collection rules', () => {
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
});
