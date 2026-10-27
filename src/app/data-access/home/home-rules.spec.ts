import { describe, expect, it } from 'vitest';
import { Deck } from '../decks/deck.model';
import { normalizeSlots, toSaveRequest } from './home-rules';

const deck = (id: string): Deck => ({ id, deckName: id, cards: [] });

describe('normalizeSlots', () => {
  it('pads missing slots with null', () => {
    expect(normalizeSlots([deck('a')])).toEqual([deck('a'), null, null, null, null, null]);
    expect(normalizeSlots(null)).toHaveLength(6);
  });

  it('drops slots beyond the limit', () => {
    expect(normalizeSlots(Array.from({ length: 8 }, (_, i) => deck(String(i))))).toHaveLength(6);
  });
});

describe('toSaveRequest', () => {
  it('numbers every slot, keeping empty ones', () => {
    const request = toSaveRequest({ edition: null, decks: [null, deck('b')] });
    expect(request.decks.map((d) => d.deckPosition)).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(request.decks[1].deck?.id).toBe('b');
    expect(request.decks[0].deck).toBeNull();
  });
});
