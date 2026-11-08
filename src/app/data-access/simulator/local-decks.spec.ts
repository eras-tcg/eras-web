import { describe, expect, it } from 'vitest';
import { CardMeta, DriveCard } from '../cards/card.model';
import { Deck } from '../decks/deck.model';
import { offlineDecks, starterDeckSpec, userDeckSpec } from './local-decks';

const drive = (id: string, name: string, edition: string, extra: Partial<DriveCard> = {}): DriveCard => ({
  id,
  name,
  edition,
  sub_edition: '',
  number: 1,
  color_identity: 'B',
  image_url: `https://img.example/cards/${id}.jpg?v=1`,
  time_stamp: '',
  ...extra,
});
const meta = (id: string, cardName: string, edition: string, extra: Partial<CardMeta> = {}): CardMeta => ({ id, cardName, edition, ...extra });

describe('userDeckSpec (as DeckLoader.slots seats a deck list)', () => {
  const images = [drive('f-fhalid', 'Fhalid', 'ST1'), drive('f-hez', 'hez', 'ST1'), drive('f-roto', 'Roto-G0', 'E1')];
  const metas = [
    meta('m-fhalid', 'Fhalid', 'ST1', { cardType: 'creature' }),
    meta('m-hez', 'Hez', 'ST1', { starter: true }),
    meta('m-hez-2', 'HEZ', 'ST1'),
    meta('m-roto-e2', 'Roto-G0', 'E2'),
  ];

  it('keeps each file id as the card id, the drive card image and the metadata matched by name (any case) and edition', () => {
    const spec = userDeckSpec({ deckName: 'Mío', cards: ['f-fhalid', 'f-hez'] }, images, metas);
    expect(spec).toEqual({
      deckName: 'Mío',
      cards: [
        { card: metas[0], copies: 1, cardId: 'f-fhalid', imageUrl: 'https://img.example/cards/f-fhalid.jpg?v=1' },
        // Two metadata with the same key: the first wins (DeckLoader's toMap merge)
        { card: metas[1], copies: 1, cardId: 'f-hez', imageUrl: 'https://img.example/cards/f-hez.jpg?v=1' },
      ],
    });
  });

  it('counts runs of the same card as copies, keeping the list order', () => {
    const spec = userDeckSpec({ deckName: 'D', cards: ['f-fhalid', 'f-fhalid', 'f-hez', 'f-fhalid'] }, images, metas);
    expect('cards' in spec && spec.cards.map((c) => [c.cardId, c.copies])).toEqual([
      ['f-fhalid', 2],
      ['f-hez', 1],
      ['f-fhalid', 1],
    ]);
  });

  it('seats a card without metadata (another edition) or without drive card with a bare metadata', () => {
    const spec = userDeckSpec({ deckName: 'D', cards: ['f-roto', 'f-gone'] }, images, metas);
    expect('cards' in spec && spec.cards).toEqual([
      { card: { id: 'f-roto', cardName: 'Roto-G0' }, copies: 1, cardId: 'f-roto', imageUrl: 'https://img.example/cards/f-roto.jpg?v=1' },
      { card: { id: 'f-gone', cardName: null }, copies: 1, cardId: 'f-gone', imageUrl: null },
    ]);
  });

  it('reads the card API\'s "" as no name or edition (the server\'s null)', () => {
    const spec = userDeckSpec({ deckName: 'D', cards: ['f-x'] }, [drive('f-x', '', '')], [meta('m', '', '')]);
    expect('cards' in spec && spec.cards[0].card).toEqual({ id: 'f-x', cardName: null });
  });
});

describe('starterDeckSpec', () => {
  const starter = { deckName: 'ST1', metadata: [meta('m-fhalid', 'Fhalid', 'ST1'), meta('m-flur', 'Flureteus', 'ST1', { starter: true })] };

  it('without the catalog keeps the file form (each card x3, the Iniciador x1, no images)', () => {
    expect(starterDeckSpec(starter, [])).toEqual(starter);
  });

  it('with the catalog gives each card its drive card (id and image); one not found keeps its metadata id', () => {
    const spec = starterDeckSpec(starter, [drive('f-fhalid', 'FHALID', 'ST1'), drive('f-other', 'Flureteus', 'E1')]);
    expect(spec).toEqual({
      deckName: 'ST1',
      cards: [
        { card: starter.metadata[0], copies: 3, cardId: 'f-fhalid', imageUrl: 'https://img.example/cards/f-fhalid.jpg?v=1' },
        { card: starter.metadata[1], copies: 1, cardId: 'm-flur' },
      ],
    });
  });
});

describe('offlineDecks', () => {
  const starters = {
    format: 'eras-starter-decks/1',
    decks: { 'deck-st1': { deckName: 'ST1', metadata: [meta('m-a', 'A', 'ST1'), meta('m-s', 'S', 'ST1', { starter: true })] } },
  };
  const mine: Deck[] = [
    { id: 'd1', deckName: 'Mío', cards: ['f-a', 'f-a'], deckImage: 'cover.jpg', userId: 'u1', username: 'yo' },
    { id: 'd-empty', deckName: 'Vacío', cards: [] },
  ];
  const images = [drive('f-a', 'A', 'ST1'), drive('f-s', 'S', 'ST1')];
  const metas = [meta('m-a', 'A', 'ST1'), meta('m-s', 'S', 'ST1', { starter: true })];

  it('offers the starter decks always, and my decks with cards only with the catalog loaded', () => {
    const offline = offlineDecks({ starters, mine, images: [], meta: [] });
    expect(Object.keys(offline.specs)).toEqual(['deck-st1']);
    expect(offline.list).toEqual([{ id: 'deck-st1', deckName: 'ST1', cards: ['m-a', 'm-a', 'm-a', 'm-s'], deckImage: null }]);

    const loaded = offlineDecks({ starters, mine, images, meta: metas });
    expect(Object.keys(loaded.specs)).toEqual(['deck-st1', 'd1']);
    expect(loaded.list).toEqual([
      // The starter's cover is its Iniciador's picture
      { id: 'deck-st1', deckName: 'ST1', cards: ['f-a', 'f-a', 'f-a', 'f-s'], deckImage: 'https://img.example/cards/f-s.jpg?v=1' },
      { id: 'd1', deckName: 'Mío', cards: ['f-a', 'f-a'], deckImage: 'cover.jpg', userId: 'u1', username: 'yo', privateDeck: undefined },
    ]);
  });

  it('works without the starter decks file', () => {
    expect(offlineDecks({ starters: null, mine: [], images: [], meta: [] })).toEqual({ specs: {}, list: [] });
  });
});
