import { describe, expect, it } from 'vitest';
import { CardMeta, CatalogCard } from '@data/cards/card.model';
import { editionSlots, metaEditionId, slotsFilled } from './edition-slots';

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

  it('reads sub-editions as their own edition', () => {
    expect(metaEditionId({ edition: 'E1', subEdition: '1' })).toBe('E1.1');
    expect(metaEditionId({ edition: 'E1', subEdition: null })).toBe('E1');
  });
});
