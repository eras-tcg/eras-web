import { describe, expect, it } from 'vitest';
import { Deck } from '../decks/deck.model';
import { EMPTY_STATS_FILTER, addDecks, deckStats, emptyGame, formatDuration, moveDeck, normalizeTierList, timeline } from './games-rules';
import { Game } from './games.model';

const deck = (id: string, deckName: string): Deck => ({ id, deckName, cards: [] });
const game = (p1: [string, string], p2: [string, string], winner: 'player1' | 'player2', createdAt: string): Game => ({
  player1: { playerName: p1[0], deckId: p1[1], lives: [] },
  player2: { playerName: p2[0], deckId: p2[1], lives: [] },
  winner,
  firstPlayer: 'player1',
  createdAt,
});

describe('emptyGame / formatDuration', () => {
  it('keeps players and decks from the previous game', () => {
    const next = emptyGame(game(['Ana', 'd1'], ['Beto', 'd2'], 'player2', ''));
    expect(next.player1).toEqual({ playerName: 'Ana', deckId: 'd1', lives: [] });
    expect(next.winner).toBe('player1');
  });
  it('formats minutes and seconds', () => {
    expect(formatDuration(725)).toBe('12:05');
    expect(formatDuration(null)).toBeNull();
  });
});

describe('timeline', () => {
  it('merges games and notes newest first', () => {
    const items = timeline([game(['a', 'x'], ['b', 'y'], 'player1', '2026-01-02')], [{ id: 'n', text: 't', createdAt: '2026-01-03' }]);
    expect(items.map((i) => i.type)).toEqual(['note', 'game']);
  });
});

describe('deckStats', () => {
  const decks = [deck('d1', 'Dragones'), deck('d2', 'Bestias'), deck('d3', 'Nunca jugado')];
  const games = [
    game(['Ana', 'd1'], ['Beto', 'd2'], 'player1', '2026-01-01T10:00:00Z'),
    game(['Beto', 'd2'], ['Ana', 'd1'], 'player1', '2026-01-05T10:00:00Z'),
    game(['Ana', 'd1'], ['Cata', 'd2'], 'player1', '2026-02-01T10:00:00Z'),
  ];
  const row = (rows: ReturnType<typeof deckStats>, id: string) => rows.find((r) => r.deck.id === id);

  it('counts both seats', () => {
    const rows = deckStats(games, decks, EMPTY_STATS_FILTER);
    expect(row(rows, 'd1')).toMatchObject({ played: 3, won: 2 });
    expect(row(rows, 'd2')).toMatchObject({ played: 3, won: 1 });
    expect(row(rows, 'd3')).toMatchObject({ played: 0, ratio: 0 });
  });

  it('filters by date range and players', () => {
    expect(row(deckStats(games, decks, { ...EMPTY_STATS_FILTER, from: '2026-01-02', to: '2026-01-31' }), 'd1')).toMatchObject({ played: 1, won: 0 });
    const vsCata = deckStats(games, decks, { ...EMPTY_STATS_FILTER, player: 'ana', opponent: 'cata' });
    expect(vsCata.map((r) => [r.deck.id, r.played, r.won])).toEqual([['d1', 1, 1]]);
  });
});

describe('tier list', () => {
  it('migrates the single-page format and never returns zero pages', () => {
    expect(normalizeTierList({ tiers: [{ label: 'S', color: '#f00', deckIds: ['a'] }] }).pages[0].name).toBe('Principal');
    expect(normalizeTierList({}).pages[0].tiers).toHaveLength(5);
  });

  it('moves, removes and adds decks without duplicates', () => {
    let page = { id: '1', name: 'P', tiers: [{ label: 'S', color: '', deckIds: ['a'] }, { label: 'A', color: '', deckIds: [] }] };
    page = moveDeck(page, 'a', 'A');
    expect(page.tiers.map((t) => t.deckIds)).toEqual([[], ['a']]);
    page = addDecks(page, ['a', 'b'], 'S');
    expect(page.tiers.map((t) => t.deckIds)).toEqual([['b'], ['a']]);
    expect(moveDeck(page, 'a', null).tiers.map((t) => t.deckIds)).toEqual([['b'], []]);
  });
});
