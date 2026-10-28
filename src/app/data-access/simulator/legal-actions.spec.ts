import { describe, expect, it } from 'vitest';
import { RulesView, canPay, fieldRows, legalActions, playCost, rulesView } from './legal-actions';
import { CardSlot, GameState } from './simulator.model';

const slot = (id: string, over: Partial<CardSlot> = {}): CardSlot => ({
  instanceId: id,
  cardId: 'c' + id,
  imageUrl: 'img',
  faceDown: false,
  tapped: false,
  x: 50,
  y: 25,
  cardName: 'N' + id,
  cardType: 'creature',
  strength: 3,
  specialSummonKind: null,
  starter: false,
  strengthModifier: 0,
  cost: 1,
  materials: [],
  resources: [],
  ...over,
});

const open: RulesView = { inProgress: true, myTurn: true, phase: 'MAIN', closed: false, gems: 2, opponentMarker: 1 };

describe('legalActions', () => {
  it('attacks with an active creature of the Línea frontal and 0 or more gems', () => {
    expect(legalActions(open, slot('a'), 'field')).toEqual(['attack']);
    expect(legalActions({ ...open, gems: 0 }, slot('a'), 'field')).toEqual(['attack']);
    expect(legalActions({ ...open, gems: -1 }, slot('a'), 'field')).toEqual([]);
    expect(legalActions(open, slot('a', { tapped: true }), 'field')).toEqual([]);
    expect(legalActions(open, slot('a', { y: 75 }), 'field')).toEqual([]);
    expect(legalActions(open, slot('a', { cardType: 'structure' }), 'field')).toEqual([]);
  });

  it('only on your turn, in the main phase, with nothing pending', () => {
    expect(legalActions({ ...open, myTurn: false }, slot('a'), 'field')).toEqual([]);
    expect(legalActions({ ...open, phase: 'END_PHASE' }, slot('a'), 'field')).toEqual([]);
    expect(legalActions({ ...open, closed: true }, slot('a'), 'field')).toEqual([]);
  });

  it('summons creatures and plays the rest from the hand when the cost can be paid', () => {
    expect(legalActions(open, slot('h', { cost: 3 }), 'hand')).toEqual(['summon']);
    // 2 gems − 4 = −2 < −1 (opponent's Marcador)
    expect(legalActions(open, slot('h', { cost: 4 }), 'hand')).toEqual([]);
    expect(legalActions(open, slot('h', { cost: null }), 'hand')).toEqual([]);
    expect(legalActions(open, slot('u', { cardType: 'utility', cost: 1 }), 'hand')).toEqual(['play']);
  });

  it('Caza Nocturna costs 1 less below 0 gems', () => {
    const caza = slot('c', { cardType: 'utility', cardName: 'Caza Nocturna', cost: 1 });
    expect(playCost({ ...open, gems: -1 }, caza)).toBe(0);
    expect(playCost(open, caza)).toBe(1);
    expect(canPay({ ...open, gems: -1 }, 0)).toBe(true);
  });
});

describe('rulesView', () => {
  it('reads gems from the shared Contador (the first player counts it negatively)', () => {
    const state = {
      status: 'IN_PROGRESS',
      currentTurnUserId: 'p1',
      currentPhase: 'MAIN',
      sharedCounter: -3,
      players: { p1: { resourceCount: 2 }, p2: { resourceCount: 4 } },
    } as unknown as GameState;
    expect(rulesView(state, 'p1')).toMatchObject({ myTurn: true, gems: 3, opponentMarker: 4, closed: false });
    expect(rulesView(state, 'p2')).toMatchObject({ myTurn: false, gems: -3, opponentMarker: 2 });
    expect(rulesView({ ...state, combat: {} } as GameState, 'p1').closed).toBe(true);
  });
});

describe('fieldRows', () => {
  it('splits the field into the two lines, left to right', () => {
    const rows = fieldRows([slot('b', { x: 70 }), slot('r', { y: 75, x: 10 }), slot('a', { x: 20 })]);
    expect(rows.front.map((s) => s.instanceId)).toEqual(['a', 'b']);
    expect(rows.back.map((s) => s.instanceId)).toEqual(['r']);
  });
});
