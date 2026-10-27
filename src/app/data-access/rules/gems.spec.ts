import { describe, expect, it } from 'vitest';
import { INITIAL_GEMS, excess, gemTrack, nextTurn, remaining, spend, spendLimit } from './gems';

describe('gems', () => {
  it('limits spending to your gems plus the rival gems', () => {
    expect(spendLimit(INITIAL_GEMS)).toBe(6);
    const { state } = spend(spend(INITIAL_GEMS, 2).state, 3);
    expect(state.spent).toBe(5);
    expect(remaining(state)).toBe(-2);
    expect(excess(state)).toBe(2);
    expect(spend(state, 2).error).toContain('1 gemas');
    expect(spend(state, 0).state).toBe(state);
  });

  it('gives the excess to the rival and grows both counters up to 5', () => {
    const spent = spend(INITIAL_GEMS, 5).state;
    const { state, message } = nextTurn(spent);
    expect(message).toContain('2 gemas');
    expect(state).toEqual({ playerGems: 4, rivalGems: 3 + 2 + 4, playerCounter: 4, rivalCounter: 4, spent: 0 });
    let s = state;
    for (let i = 0; i < 5; i++) s = nextTurn(s).state;
    expect([s.playerCounter, s.rivalCounter]).toEqual([5, 5]);
  });

  it('paints the track: available, spent from the outside in, and excess on the right', () => {
    const track = gemTrack(spend(INITIAL_GEMS, 4).state);
    expect(track).toHaveLength(21);
    const states = (side: string) => track.filter((t) => t.side === side && t.state !== 'empty').map((t) => `${t.value}:${t.state}`);
    expect(states('player')).toEqual(['3:spent', '2:spent', '1:spent']);
    expect(states('rival')).toEqual(['1:excess']);
    expect(gemTrack(spend(INITIAL_GEMS, 1).state).filter((t) => t.side === 'player' && t.state !== 'empty').map((t) => t.state)).toEqual([
      'spent',
      'available',
      'available',
    ]);
  });
});
