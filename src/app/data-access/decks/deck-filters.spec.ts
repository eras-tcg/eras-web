import { describe, expect, it } from 'vitest';
import { CatalogCard } from '../cards/card.model';
import { Deck } from './deck.model';
import { EMPTY_DECK_FILTERS, deckAuthors, deckEditions, filterDecks, hasDeckFilters, summarizeDecks, systemRows } from './deck-filters';

const card = (id: string, edition: string, color: string, sub = '', colors: string[] = []): CatalogCard => ({
  id,
  name: id,
  edition,
  sub_edition: sub,
  number: 1,
  color_identity: color,
  image_url: null,
  time_stamp: null,
  meta: colors.length ? { id: `m-${id}`, colors } : null,
});
const deck = (id: string, cards: string[], over: Partial<Deck> = {}): Deck => ({ id, deckName: id, cards, ...over });

const cards = [card('a', 'ST1', 'B'), card('b', 'E1', 'R', '1', ['G']), card('c', 'ST2', 'R')];
const decks = [
  deck('Azules', ['a', 'a'], { username: 'ana' }),
  deck('Rojo verde', ['b', 'c'], { username: 'beto', privateDeck: true }),
  deck('Desconocido', ['zzz'], { username: 'ana' }),
];
const summaries = summarizeDecks(decks, cards);
const names = (list: Deck[]) => list.map((d) => d.deckName);

describe('summarizeDecks', () => {
  it('collects colors in the usual order and full edition ids', () => {
    expect(summaries.get('Rojo verde')).toEqual({ colors: ['G', 'R'], editions: ['E1.1', 'ST2'] });
    expect(summaries.get('Azules')).toEqual({ colors: ['B'], editions: ['ST1'] });
  });

  it('ignores cards missing from the catalog', () => {
    expect(summaries.get('Desconocido')).toEqual({ colors: [], editions: [] });
  });
});

describe('filterDecks', () => {
  it('returns everything without filters', () => {
    expect(filterDecks(decks, EMPTY_DECK_FILTERS, summaries)).toHaveLength(3);
    expect(hasDeckFilters(EMPTY_DECK_FILTERS)).toBe(false);
  });

  it('filters by name, author, color, edition and visibility', () => {
    expect(names(filterDecks(decks, { ...EMPTY_DECK_FILTERS, name: 'roJO' }, summaries))).toEqual(['Rojo verde']);
    expect(names(filterDecks(decks, { ...EMPTY_DECK_FILTERS, authors: ['ana'] }, summaries))).toEqual(['Azules', 'Desconocido']);
    expect(names(filterDecks(decks, { ...EMPTY_DECK_FILTERS, colors: ['G', 'B'] }, summaries))).toEqual(['Azules', 'Rojo verde']);
    expect(names(filterDecks(decks, { ...EMPTY_DECK_FILTERS, edition: 'E1.1' }, summaries))).toEqual(['Rojo verde']);
    expect(names(filterDecks(decks, { ...EMPTY_DECK_FILTERS, visibility: 'private' }, summaries))).toEqual(['Rojo verde']);
    expect(filterDecks(decks, { ...EMPTY_DECK_FILTERS, visibility: 'public' }, summaries)).toHaveLength(2);
  });
});

describe('system decks', () => {
  const all = [
    deck('Comunidad', ['a'], { username: 'ana' }),
    deck('Arquetipo', ['a'], { systemDeck: true, systemGroup: 'arquetipo', systemOrder: 5 }),
    deck('ST2', ['a'], { systemDeck: true, systemGroup: 'st', systemOrder: 1 }),
    deck('ST1', ['a'], { systemDeck: true, systemGroup: 'st', systemOrder: 0 }),
  ];

  it('filters by origin: ERAS or community', () => {
    expect(names(filterDecks(all, { ...EMPTY_DECK_FILTERS, origin: 'community' }, summaries))).toEqual(['Comunidad']);
    expect(names(filterDecks(all, { ...EMPTY_DECK_FILTERS, origin: 'system' }, summaries))).toEqual(['Arquetipo', 'ST2', 'ST1']);
    expect(hasDeckFilters({ ...EMPTY_DECK_FILTERS, origin: 'system' })).toBe(true);
  });

  it('groups the system decks in their rows and order, without empty rows', () => {
    const rows = systemRows(all);
    expect(rows.map((r) => r.label)).toEqual(['Structure', 'Arquetipos']);
    expect(names(rows[0].decks)).toEqual(['ST1', 'ST2']);
    expect(names(rows[1].decks)).toEqual(['Arquetipo']);
  });
});

describe('deckAuthors / deckEditions', () => {
  it('lists distinct values in order', () => {
    expect(deckAuthors(decks)).toEqual(['ana', 'beto']);
    expect(deckEditions(summaries)).toEqual(['E1.1', 'ST1', 'ST2']);
  });
});
