import { CardSlot } from '@data/simulator/simulator.model';

/** The order of the kinds in a sorted hand: creatures, then structures, then utilities (anything else last). */
const KINDS = ['creature', 'structure', 'utility'];

/**
 * "Ordenar la mano": creatures, then structures, then utilities; within a kind, as the server has them (the order they
 * came in). A new array; the hand itself is untouched.
 */
export function sortedHand(hand: readonly CardSlot[]): CardSlot[] {
  const rank = (c: CardSlot) => {
    const i = KINDS.indexOf(c.cardType ?? '');
    return i < 0 ? KINDS.length : i;
  };
  return hand
    .map((card, i) => ({ card, i }))
    .sort((a, b) => rank(a.card) - rank(b.card) || a.i - b.i)
    .map((x) => x.card);
}
