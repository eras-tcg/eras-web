import { describe, expect, it } from 'vitest';
import { attackableCreatures, fieldRows, legalActions, rulesView } from './legal-actions';
import { CardSlot, GameState } from './simulator.model';

const slot = (id: string, over: Partial<CardSlot> = {}): CardSlot =>
  ({ instanceId: id, cardId: 'c' + id, imageUrl: 'img', faceDown: false, tapped: false, x: 50, y: 25, cardName: 'N' + id, cardType: 'creature',
     strength: 3, specialSummonKind: null, starter: false, strengthModifier: 0, cost: 1, materials: [], resources: [], ...over }) as CardSlot;

const state = {
  players: {},
  legalActions: { me: { a: ['attack'], b: ['summon', 'activate'] } },
  attackTargets: { me: { a: ['t'] } },
} as unknown as GameState;

describe('legal actions', () => {
  it('says what the server says, for the player asking', () => {
    const view = rulesView(state, 'me');
    expect(legalActions(view, slot('a'))).toEqual(['attack']);
    expect(legalActions(view, slot('b'))).toEqual(['summon', 'activate']);
    expect(legalActions(view, slot('c'))).toEqual([]);
    expect(legalActions(rulesView(state, 'other'), slot('a'))).toEqual([]);
  });

  it('attacks only the enemies the server lists', () => {
    const view = rulesView(state, 'me');
    expect(attackableCreatures(view, slot('a'), [slot('t'), slot('u')]).map((c) => c.instanceId)).toEqual(['t']);
    expect(attackableCreatures(view, slot('b'), [slot('t')])).toEqual([]);
  });

  it('with no state, nothing is legal', () => {
    expect(legalActions(rulesView(null, null), slot('a'))).toEqual([]);
  });

  it('splits the field in two rows, left to right', () => {
    const rows = fieldRows([slot('r', { x: 80, y: 25 }), slot('l', { x: 10, y: 25 }), slot('b', { x: 50, y: 75 })]);
    expect(rows.front.map((c) => c.instanceId)).toEqual(['l', 'r']);
    expect(rows.back.map((c) => c.instanceId)).toEqual(['b']);
  });
});
