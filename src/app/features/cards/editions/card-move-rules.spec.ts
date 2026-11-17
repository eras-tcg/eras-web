import { CardMeta } from '@data/cards/card.model';
import { chainMetas, finalMoves, placeInSlot, slotCode, splitEdition } from './card-move-rules';

const meta = (id: string, edition: string, subEdition: string | null, cardNumber: number): CardMeta =>
  ({ id, cardName: id, edition, subEdition, colorIdentity: 'B', cardNumber }) as CardMeta;

describe('card-move-rules', () => {
  const ephos = meta('ephos', 'E1', null, 3);
  const jhav = meta('jhav', 'E1', '1', 5);
  const all = [ephos, jhav];

  it('splits an edition code', () => {
    expect(splitEdition('E1.1')).toEqual({ edition: 'E1', subEdition: '1' });
    expect(splitEdition('E2')).toEqual({ edition: 'E2', subEdition: null });
  });

  it('frees the slot of the card in hand', () => {
    expect(chainMetas(all, { moves: [], hand: ephos }).map((m) => m.id)).toEqual(['jhav']);
  });

  it('a slot with a card hands it over, and an empty slot ends the chain', () => {
    let chain = placeInSlot({ moves: [], hand: ephos }, 'E1.1', 5, jhav);
    expect(chain.hand?.id).toBe('jhav');
    expect(chainMetas(all, chain)).toEqual([{ ...ephos, edition: 'E1', subEdition: '1', cardNumber: 5 }]);
    chain = placeInSlot(chain, 'E1', 3, null);
    expect(chain.hand).toBeNull();
    expect(finalMoves(chain, all)).toEqual([
      { id: 'ephos', edition: 'E1', subEdition: '1', cardNumber: 5 },
      { id: 'jhav', edition: 'E1', subEdition: null, cardNumber: 3 },
    ]);
  });

  it('a card back where it started is not saved', () => {
    const chain = placeInSlot({ moves: [], hand: ephos }, 'E1', 3, null);
    expect(finalMoves(chain, all)).toEqual([]);
  });

  it('writes slot codes', () => {
    expect(slotCode('E1', '1', 'b', 5)).toBe('E1.1-B05');
    expect(slotCode('E2', null, 'R', 12)).toBe('E2-R12');
  });
});
