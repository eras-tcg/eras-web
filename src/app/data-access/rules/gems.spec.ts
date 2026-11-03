import { describe, expect, it } from 'vitest';
import { PRACTICE_START, canAttack, counterTrack, endTurn, gemsOf, pay, payLimit } from './gems';

describe('gems', () => {
  it('lets you pay down to minus the rival Marcador, and the rival has what you lose', () => {
    expect(payLimit(PRACTICE_START)).toBe(6);
    const { game } = pay(PRACTICE_START, 5);
    expect(gemsOf(game, 'you')).toBe(-2);
    expect(gemsOf(game, 'rival')).toBe(2);
    expect(pay(game, 2).error).toContain('1 gema más');
    expect(pay(game, 0).game).toBe(game);
  });

  it('forbids attacking while you are in debt', () => {
    expect(canAttack(PRACTICE_START)).toBe(true);
    expect(canAttack(pay(PRACTICE_START, 3).game)).toBe(true);
    expect(canAttack(pay(PRACTICE_START, 4).game)).toBe(false);
  });

  it('loses unspent gems at the end of the turn, but a debt goes to the rival', () => {
    const plain = endTurn(PRACTICE_START);
    expect(plain.game).toEqual({ counter: -4, markers: { you: 3, rival: 4 }, turn: 'rival' });
    expect(plain.message).toContain('arranca con 4 gemas');

    const debt = endTurn(pay(PRACTICE_START, 5).game);
    expect(gemsOf(debt.game, 'rival')).toBe(6);
    expect(debt.message).toContain('4 + 2');
  });

  it('raises each Marcador up to 5', () => {
    let g = PRACTICE_START;
    for (let i = 0; i < 8; i++) g = endTurn(g).game;
    expect(g.markers).toEqual({ you: 5, rival: 5 });
    expect(gemsOf(g, g.turn)).toBe(5);
  });

  it('draws the Contador from your 10 to the rival 10, with the token and the paying limit', () => {
    const track = counterTrack(pay(PRACTICE_START, 1).game);
    expect(track).toHaveLength(21);
    expect(track.filter((s) => s.state === 'you').map((s) => s.value)).toEqual([2, 1]);
    expect(track.find((s) => s.current)?.value).toBe(2);
    const limit = track.find((s) => s.limit);
    expect([limit?.side, limit?.value]).toEqual(['rival', 3]);
  });
});
