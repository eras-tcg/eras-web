import { CardSlot } from '@data/simulator/simulator.model';
import { sortedHand } from './hand-order';

const card = (instanceId: string, cardType: string | null) => ({ instanceId, cardType }) as CardSlot;

describe('sortedHand', () => {
  it('puts creatures first, then structures, then utilities, keeping the order within each kind', () => {
    const hand = [card('u1', 'utility'), card('c1', 'creature'), card('s1', 'structure'), card('c2', 'creature'), card('u2', 'utility')];
    expect(sortedHand(hand).map((c) => c.instanceId)).toEqual(['c1', 'c2', 's1', 'u1', 'u2']);
  });

  it('leaves cards of an unknown kind (or face down, without one) at the end, in their order', () => {
    const hand = [card('x1', null), card('u1', 'utility'), card('x2', 'other'), card('c1', 'creature')];
    expect(sortedHand(hand).map((c) => c.instanceId)).toEqual(['c1', 'u1', 'x1', 'x2']);
  });

  it('does not change the hand it is given', () => {
    const hand = [card('u1', 'utility'), card('c1', 'creature')];
    sortedHand(hand);
    expect(hand.map((c) => c.instanceId)).toEqual(['u1', 'c1']);
  });
});
