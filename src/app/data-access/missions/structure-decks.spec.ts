import { describe, expect, it } from 'vitest';
import { CatalogCard } from '@data/cards/card.model';
import { Deck } from '@data/decks/deck.model';
import { structureDeck, structureList, structureLore, structureStyle } from './structure-decks';

const card = (id: string): CatalogCard => ({ id, name: id, edition: 'ST1', meta: null }) as CatalogCard;

describe('structure decks', () => {
  it('tells how each of the four structure decks plays', () => {
    for (const id of ['ST1', 'ST2', 'ST3', 'ST4']) expect(structureStyle(id)?.philosophy.length).toBeGreaterThan(50);
    expect(structureStyle('st2')?.color).toBe('Verde');
    expect(structureStyle('E1')).toBeNull();
  });

  it('shows the lore only when it is not a placeholder', () => {
    expect(structureLore('rellenar')).toBeNull();
    expect(structureLore(null)).toBeNull();
    expect(structureLore('Estructura de los dragones del mundo mágico.')).toBe('Estructura de los dragones del mundo mágico.');
  });

  it('finds the deck named after the structure and counts its copies in order', () => {
    const decks = [{ id: '1', deckName: ' st1 ', cards: ['b', 'a', 'b', 'x'] }] as Deck[];
    expect(structureDeck(decks, 'ST1')?.id).toBe('1');
    expect(structureDeck(decks, 'ST2')).toBeNull();
    expect(structureList(decks[0].cards, [card('a'), card('b')]).map((e) => [e.card.id, e.copies])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });
});
