import { describe, expect, it } from 'vitest';
import { CatalogCard } from '../cards/card.model';
import { Deck } from './deck.model';
import { EMPTY_DECK_SEARCH, deckArchetypes, deckSummons, folderOf, hasDeckSearch, profileDecks, searchDecks } from './deck-search';

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
  deck('ST4 Guerreros', ['k1', 'k1', 'k1', 'k2'], { systemDeck: true, systemGroup: 'st', username: 'ERAS' }),
  deck('Dragones', ['d1', 'd2', 'd2'], { systemDeck: true, systemGroup: 'e1', username: 'ERAS' }),
  deck('Mi rojo', ['k1', 'u1'], { username: 'Ana' }),
];
const profiles = profileDecks(decks, cards);
const names = (list: Deck[]) => list.map((d) => d.deckName);

describe('profileDecks', () => {
  it('works out color, archetype, summons and format from the cards', () => {
    expect(profiles.get('ST4 Guerreros')).toMatchObject({ colors: ['R'], archetype: 'caballero', summons: ['promotion'], format: 'st' });
    expect(profiles.get('Dragones')).toMatchObject({ colors: ['G'], archetype: 'dragón', summons: ['evolution'], format: 'e1' });
    expect(profiles.get('Mi rojo')?.format).toBe('mixed');
  });

  it('lists the archetypes by how many decks have each and the summons in label order', () => {
    expect(deckArchetypes(profiles)).toEqual(['caballero', 'dragón']);
    expect(deckSummons(profiles)).toEqual(['promotion', 'evolution']);
  });
});

describe('searchDecks', () => {
  it('finds by a card in the deck, accents and case aside', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'krugel' }, profiles))).toEqual(['Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'DURE' }, profiles))).toEqual(['Dragones']);
  });

  it('every word must match something: name, author, class, card or color', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'rojo espadon' }, profiles))).toEqual(['ST4 Guerreros', 'Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'ana dragon' }, profiles))).toEqual([]);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, text: 'dragon' }, profiles))).toEqual(['Dragones']);
  });

  it('applies the criteria and the open folder', () => {
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, color: 'R', origin: 'community' }, profiles))).toEqual(['Mi rojo']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, archetype: 'caballero', format: 'st' }, profiles))).toEqual(['ST4 Guerreros']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, summon: 'evolution' }, profiles))).toEqual(['Dragones']);
    expect(names(searchDecks(decks, { ...EMPTY_DECK_SEARCH, folder: 'e1' }, profiles))).toEqual(['Dragones']);
  });

  it('a folder alone is not a search; a criterion is', () => {
    expect(hasDeckSearch({ ...EMPTY_DECK_SEARCH, folder: 'st' })).toBe(false);
    expect(hasDeckSearch({ ...EMPTY_DECK_SEARCH, color: 'R' })).toBe(true);
  });

  it('keeps each deck in its folder', () => {
    expect(decks.map(folderOf)).toEqual(['st', 'e1', 'community']);
  });
});
