import { describe, expect, it } from 'vitest';
import { CardMeta, CatalogCard } from '../cards/card.model';
import { Deck, DeckEntry } from './deck.model';
import {
  MAX_CARDS,
  addCard,
  canAdd,
  cardsPerPage,
  copiesOfName,
  deckMetrics,
  entriesFromIds,
  exportDeckText,
  groupByType,
  idsFromEntries,
  parseDeckText,
  removeCard,
  resolveCover,
  sortDecks,
  totalCards,
} from './deck-rules';

const card = (id: string, name: string, meta: Partial<CardMeta> | null = {}, over: Partial<CatalogCard> = {}): CatalogCard => ({
  id,
  name,
  edition: 'E1',
  sub_edition: '',
  number: Number(id.replace(/\D/g, '')) || 1,
  color_identity: 'B',
  image_url: `https://img/${id}.jpg`,
  time_stamp: null,
  meta: meta === null ? null : { id: 'm' + id, ...meta },
  ...over,
});

const dragon = card('c1', 'Dragón', { cardType: 'creature', level: 2, cost: 3, rarity: 'R' });
const dragonReprint = card('c2', 'dragón', { cardType: 'creature', level: 2 }, { edition: 'ST1' });
const wall = card('c3', 'Muro', { cardType: 'structure', cost: 1, rarity: 'C' }, { color_identity: 'G' });
const spell = card('c4', 'Hechizo', { cardType: 'utility', specialCost: 2 });
const catalog = [dragon, dragonReprint, wall, spell];

describe('entries', () => {
  it('round-trips card ids and reports unknown ones', () => {
    const { entries, missing } = entriesFromIds(['c3', 'c1', 'c1', 'zz'], catalog);
    expect(entries.map((e) => [e.card.id, e.count])).toEqual([
      ['c1', 2],
      ['c3', 1],
    ]);
    expect(missing).toEqual(['zz']);
    expect(idsFromEntries(entries)).toEqual(['c1', 'c1', 'c3']);
  });

  it('limits copies per name across printings', () => {
    let deck: DeckEntry[] = [];
    for (let i = 0; i < 3; i++) deck = addCard(deck, dragon);
    deck = addCard(deck, dragonReprint);
    expect(copiesOfName(deck, 'DRAGÓN')).toBe(4);
    expect(canAdd(deck, dragon)).toBe(false);
    expect(totalCards(addCard(deck, dragonReprint))).toBe(4);
  });

  it('limits the deck size', () => {
    const many = Array.from({ length: MAX_CARDS }, (_, i) => ({ card: card(`x${i}`, `n${i}`), count: 1 }));
    expect(canAdd(many, wall)).toBe(false);
  });

  it('removes one copy, then the entry', () => {
    const deck = [{ card: dragon, count: 2 }];
    expect(removeCard(deck, 'c1')).toEqual([{ card: dragon, count: 1 }]);
    expect(removeCard(removeCard(deck, 'c1'), 'c1')).toEqual([]);
  });

  it('groups creature, structure, utility in that order', () => {
    const groups = groupByType([
      { card: spell, count: 1 },
      { card: wall, count: 2 },
      { card: dragon, count: 3 },
    ]);
    expect(groups.map((g) => [g.type, g.count])).toEqual([
      ['creature', 3],
      ['structure', 2],
      ['utility', 1],
    ]);
  });

  it('keeps the cover while its card is in the deck', () => {
    const deck = [{ card: wall, count: 1 }, { card: dragon, count: 1 }];
    expect(resolveCover(deck, 'https://img/c1.jpg')).toBe('https://img/c1.jpg');
    expect(resolveCover(deck, 'https://img/gone.jpg')).toBe('https://img/c3.jpg');
    expect(resolveCover([], 'x')).toBeNull();
  });
});

describe('deckMetrics', () => {
  const deck = [
    { card: dragon, count: 2 },
    { card: wall, count: 1 },
    { card: spell, count: 1 },
  ];

  it('counts every dimension', () => {
    const m = deckMetrics(deck, null, null);
    expect(m.types).toEqual({ creature: 2, structure: 1, utility: 1 });
    expect(m.colors).toEqual({ B: 3, G: 1 });
    expect(m.costs).toEqual({ 3: 2, 1: 1 });
    expect(m.specialCosts).toEqual({ 2: 1 });
  });

  it('filters the charts but not the type/color selectors', () => {
    const m = deckMetrics(deck, null, 'G');
    expect(m.types).toEqual({ creature: 2, structure: 1, utility: 1 });
    expect(m.costs).toEqual({ 1: 1 });
    expect(m.rarities).toEqual({ C: 1 });
  });
});

describe('export / import', () => {
  it('round-trips the text list', () => {
    const deck = [
      { card: dragon, count: 2 },
      { card: wall, count: 1 },
    ];
    const text = exportDeckText('Mi mazo', deck);
    expect(text).toContain('  2x Dragón (E1 #1)');
    const parsed = parseDeckText(text, catalog);
    expect(parsed.name).toBe('Mi mazo');
    expect(parsed.entries.map((e) => [e.card.id, e.count])).toEqual([
      ['c1', 2],
      ['c3', 1],
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it('matches sub-editions, reports unknown cards and enforces limits', () => {
    const sub = card('c9', 'Sub', {}, { edition: 'E1', sub_edition: '1', number: 9 });
    const parsed = parseDeckText('Mazo: X\nCREATURE\n  6x Sub (E1.1 #9)\n  1x Nada (E9 #1)\r\n', [sub]);
    expect(parsed.entries).toEqual([{ card: sub, count: 4 }]);
    expect(parsed.warnings).toHaveLength(2);
  });
});

describe('cardsPerPage', () => {
  it('fits 2.5×3.5 in cards inside the margins', () => {
    expect(cardsPerPage('letter', 'portrait', 0.5)).toBe(6);
    expect(cardsPerPage('letter', 'landscape', 0.5)).toBe(8);
    expect(cardsPerPage('letter', 'landscape', 5)).toBe(0);
  });
});

describe('sortDecks', () => {
  const d = (id: string, deckName: string, createdAt: string | null): Deck => ({ id, deckName, cards: [], createdAt });
  it('sorts by name (accent-insensitive) and puts missing dates last', () => {
    const list = [d('1', 'zeta', null), d('2', 'Álamo', '2026-02-01'), d('3', 'beta', '2026-01-01')];
    expect(sortDecks(list, 'name', 'asc').map((x) => x.id)).toEqual(['2', '3', '1']);
    expect(sortDecks(list, 'createdAt', 'desc').map((x) => x.id)).toEqual(['2', '3', '1']);
  });
});
