import { describe, expect, it } from 'vitest';
import { Deck } from './deck.model';
import { DeckBox } from './deckbox.model';
import { boxNameError, boxOf, cleanBoxName, deckBoxColor, decksIn, dropBoxOn, looseDecks, moveBox, withDeckIn } from './deckbox-rules';

const deck = (id: string): Deck => ({ id, deckName: id, cards: [] });
const box = (id: string, name: string, deckIds: string[], order = 0): DeckBox => ({ id, userId: 'u', name, color: 'blue', order, deckIds });

const decks = [deck('d1'), deck('d2'), deck('d3'), deck('d4')];
const boxes = [box('a', 'Competitivos', ['d2', 'd1']), box('b', 'Casuales', ['gone', 'd3'], 1), box('c', 'Vacía', [], 2)];

describe('deckbox rules', () => {
  it('finds the deckbox of a deck, the loose decks and a deckbox’s decks in order', () => {
    expect(boxOf('d3', boxes)?.id).toBe('b');
    expect(boxOf('d4', boxes)).toBeNull();
    expect(looseDecks(decks, boxes).map((d) => d.id)).toEqual(['d4']);
    expect(decksIn(boxes[0], decks).map((d) => d.id)).toEqual(['d2', 'd1']);
    // Ids of deleted decks are skipped
    expect(decksIn(boxes[1], decks).map((d) => d.id)).toEqual(['d3']);
  });

  it('puts a deck in one deckbox only', () => {
    const moved = withDeckIn(boxes, 'd1', 'b');
    expect(moved.map((b) => b.deckIds)).toEqual([['d2'], ['gone', 'd3', 'd1'], []]);
    expect(withDeckIn(moved, 'd1', null).map((b) => b.deckIds)).toEqual([['d2'], ['gone', 'd3'], []]);
    // Already there: unchanged
    expect(withDeckIn(boxes, 'd2', 'a')[0]).toBe(boxes[0]);
  });

  it('reorders deckboxes by dropping one on another or a step at a time', () => {
    expect(dropBoxOn(boxes, 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(dropBoxOn(boxes, 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(dropBoxOn(boxes, 'a', 'a')).toEqual(['a', 'b', 'c']);
    expect(moveBox(boxes, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveBox(boxes, 'a', -1)).toEqual(['a', 'b', 'c']);
  });

  it('checks names like the server', () => {
    expect(cleanBoxName('  Mis   mazos ')).toBe('Mis mazos');
    expect(boxNameError('  ', boxes)).toBe('Escribe un nombre');
    expect(boxNameError('x'.repeat(31), boxes)).toContain('30');
    expect(boxNameError('competitivos', boxes)).toContain('Ya tienes');
    expect(boxNameError('Competitivos', boxes, 'a')).toBeNull();
  });

  it('colors come from the tokens', () => {
    expect(deckBoxColor({ color: 'teal' })).toBe('var(--color-deckbox-teal)');
  });
});
