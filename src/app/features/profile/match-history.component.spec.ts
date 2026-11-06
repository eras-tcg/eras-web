import { MatchSummary } from '@data/simulator/matches.api';
import { toRow } from './match-history.component';

const game = (over: Partial<MatchSummary> = {}): MatchSummary => ({
  id: 'm1',
  roomId: 'r1',
  mode: 'solo',
  ranked: true,
  playerIds: ['me', 'bot'],
  players: [
    { userId: 'me', username: 'Ana', deckName: 'ST1' },
    { userId: 'bot', username: 'Bot', bot: true },
  ],
  winnerId: 'me',
  endReason: 'lives',
  turns: 9,
  actions: 120,
  startedAt: '2026-11-05T10:00:00Z',
  endedAt: '2026-11-05T10:14:00Z',
  durationMs: 14 * 60000,
  hasLog: true,
  ...over,
});

describe('match history rows', () => {
  it('shows a game from the player side: result, rival, deck and how it went', () => {
    const row = toRow(game(), 'me');
    expect(row.result).toBe('won');
    expect(row.rival).toBe('Bot');
    expect(row.deck).toBe('ST1');
    expect(row.mode).toBe('Modo solo');
    expect(row.detail).toBe('9 turnos · 14 min · por vidas');
  });

  it('a game lost online, by surrender', () => {
    const row = toRow(
      game({ mode: 'online', ranked: false, winnerId: 'other', endReason: 'surrender', players: [{ userId: 'me', username: 'Ana' }, { userId: 'other', username: 'Beto' }] }),
      'me',
    );
    expect(row.result).toBe('lost');
    expect(row.rival).toBe('Beto');
    expect(row.mode).toBe('Online');
    expect(row.detail).toContain('por rendición');
  });

  it('a game without a winner', () => {
    expect(toRow(game({ winnerId: null }), 'me').result).toBe('none');
  });
});

describe('match history wording', () => {
  it('one turn in singular', () => {
    expect(toRow(game({ turns: 1 }), 'me').detail.startsWith('1 turno ·')).toBe(true);
  });
});

describe('match history replays', () => {
  it('a game with its log kept can be watched again', () => {
    expect(toRow(game(), 'me').replay).toBe(true);
    expect(toRow(game({ hasLog: false }), 'me').replay).toBe(false);
  });
});
