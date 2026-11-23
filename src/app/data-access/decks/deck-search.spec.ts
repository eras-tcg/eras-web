import { describe, expect, it } from 'vitest';
import { CatalogCard } from '../cards/card.model';
import { Deck } from './deck.model';
import {
  EMPTY_DECK_SEARCH,
  compareEditions,
  deckArchetypes,
  deckEditionsOf,
  deckSummons,
  folderOf,
  hasDeckSearch,
  profileDecks,
  searchDecks,
  systemFolders,
} from './deck-search';

const card = (id: string, edition: string, sub: string, color: string, name: string, classes: string[] = [], summon: string | null = null): CatalogCard => ({
  id,
  name,
  edition,
  sub_edition: sub,
  number: 1,
  color_identity: color,
  image_url: null,
  time_stamp: null,
  meta: { id: `m-${id}`, cardName: name, cardType: classes.length ? 'creature' : 'utility', cardClasses: classes, specialSummonKind: summon },
});
const deck = (id: string, cards: string[], over: Partial<Deck> = {}): Deck => ({ id, deckName: id, cards, ...over });

const cards = [
  card('k1', 'ST4', '', 'R', 'Espadón Hábil', ['caballero'], 'promotion'),
  card('k2', 'ST4', '', 'R', 'Golth', ['retador']),
  card('d1', 'E1', '3', 'G', 'Dragón Tormenta', ['dragón'], 'evolution'),
  card('d2', 'E1', '', 'G', 'Duregón', ['dragón']),
  card('u1', 'E1', '1', 'R', 'Krugel', ['caballero', 'mercenario'], 'promotion'),
];
const decks = [
  deck('ST4 Guerreros', ['k1', 'k1', 'k1', 'k2'], { systemDeck: true, systemEdition: 'ST', username: 'ERAS' }),
  deck('E1.3 Dragones', ['d1', 'd2', 'd2'], { systemDeck: true, systemEdition: 'E1.3', username: 'ERAS' }),
  deck('Mi rojo', ['k1', 'u1'], { username: 'Ana' }),
];
const profiles = profileDecks(decks, cards);
const names = (list: Deck[]) => list.map((d) => d.deckName);

describe('profileDecks', () => {
  it('works out color, archetype, summons and the newest edition from the cards', () => {
    expect(profiles.get('ST4 Guerreros')).toMatchObject({ colors: ['R'], archetype: 'caballero', summons: ['promotion'], edition: 'ST4' });
    expect(profiles.get('E1.3 Dragones')).toMatchObject({ colors: ['G'], archetype: 'dragón', summons: ['evolution'], edition: 'E1.3' });
    expect(profiles.get('Mi rojo')?.edition).toBe('E1.1');
  });

  it('lists archetypes by decks, summons in label order and editions in release order', () => {
    expect(deckArchetypes(profiles)).toEqual(['caballero', 'dragón']);
    expect(deckSummons(profiles)).toEqual(['promotion', 'evolution']);
    expect(deckEditionsOf(profiles)).toEqual(['ST4', 'E1.1', 'E1.3']);
    expect(['E1.10', 'E1', 'ST2', 'E1.2'].sort(compareEditions)).toEqual(['ST2', 'E1', 'E1.2', 'E1.10']);
  });
});

describe('searchDecks', () => {
  it('finds by a card in the deck, accents and case aside', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'krugel' }, profiles))).toEqual(['Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'DURE' }, profiles))).toEqual(['E1.3 Dragones']);
  });

  it('every word must match something: name, author, class, card or color', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'rojo espadon' }, profiles))).toEqual(['ST4 Guerreros', 'Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'ana dragon' }, profiles))).toEqual([]);
  });

  it('applies the criteria inside the part and folder open', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, color: 'R', scope: 'community' }, profiles))).toEqual(['Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, color: 'R', scope: 'system' }, profiles))).toEqual(['ST4 Guerreros']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, edition: 'E1.1' }, profiles))).toEqual(['Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, summon: 'evolution' }, profiles))).toEqual(['E1.3 Dragones']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, scope: 'system', folder: 'E1.3' }, profiles))).toEqual(['E1.3 Dragones']);
  });

  it('opening a part or a folder is not a search; a criterion is', () => {
    expect(hasDeckSearch({ ...EMPTY_DECK_SEARCH, scope: 'system', folder: 'ST' })).toBe(false);
    expect(hasDeckSearch({ ...EMPTY_DECK_SEARCH, color: 'R' })).toBe(true);
  });
});

describe('system folders', () => {
  it('one per edition of the system decks, the Structures first', () => {
    expect(decks.filter((d) => d.systemDeck).map(folderOf)).toEqual(['ST', 'E1.3']);
    expect(systemFolders([...decks, deck('E1 Rojo', [], { systemDeck: true, systemEdition: 'E1' })])).toEqual(['ST', 'E1', 'E1.3']);
  });
});
