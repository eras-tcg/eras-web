import { describe, expect, it } from 'vitest';
import {
  applyLocalMove,
  creatureNear,
  deckWarnings,
  displayStrength,
  fieldY,
  isHidden,
  postGameOptions,
  sharedIndexForValue,
  sharedValueForIndex,
  targetForViewer,
} from './game-rules';
import { CardSlot, PlayerState } from './simulator.model';

const slot = (id: string, over: Partial<CardSlot> = {}): CardSlot => ({
  instanceId: id,
  cardId: 'c' + id,
  imageUrl: 'img',
  faceDown: false,
  tapped: false,
  x: null,
  y: null,
  cardName: 'N' + id,
  cardType: 'creature',
  strength: 3,
  specialSummonKind: null,
  starter: false,
  strengthModifier: 0,
  materials: [],
  resources: [],
  ...over,
});
const player = (over: Partial<PlayerState> = {}): PlayerState => ({
  userId: 'u',
  username: 'u',
  connected: true,
  deckId: null,
  resourceCount: 0,
  hand: [],
  deck: [],
  originalDeck: [],
  lifeStack: [],
  tributeZone: [],
  discardPile: [],
  field: [],
  ...over,
});

describe('card display', () => {
  it('adds the strength modifier and hides opponent hands and face-down cards', () => {
    expect(displayStrength(slot('1', { strengthModifier: -2 }))).toBe(1);
    expect(displayStrength(slot('1', { strength: null }))).toBeNull();
    expect(isHidden(slot('1'), 'hand', true)).toBe(true);
    expect(isHidden(slot('1'), 'hand', false)).toBe(false);
    expect(isHidden(slot('1', { faceDown: true }), 'field', false)).toBe(true);
  });
});

describe('deckWarnings', () => {
  it('reports incomplete decks, missing images and missing metadata grouped by name', () => {
    const deck = [slot('1', { imageUrl: null }), slot('2', { cardType: null, cardName: 'X' }), slot('3', { cardType: null, cardName: 'X' })];
    expect(deckWarnings(deck)).toEqual(['Mazo incompleto: 3/50 cartas cargadas', '1 carta sin imagen', 'Sin metadatos: ×2 X']);
    expect(deckWarnings(Array.from({ length: 50 }, (_, i) => slot(String(i))))).toEqual([]);
  });
});

describe('targetForViewer', () => {
  it('swaps own/opp zone targets for the other player only', () => {
    expect(targetForViewer('zone:opp:lifeStack', false)).toBe('zone:own:lifeStack');
    expect(targetForViewer('zone:own:tributeZone', false)).toBe('zone:opp:tributeZone');
    expect(targetForViewer('zone:opp:lifeStack', true)).toBe('zone:opp:lifeStack');
    expect(targetForViewer('abc', false)).toBe('abc');
  });
});

describe('applyLocalMove', () => {
  it('places cards on the field at the drop position', () => {
    const p = applyLocalMove(player({ hand: [slot('1')] }), '1', 'hand', 'field', 20, 70);
    expect(p.hand).toEqual([]);
    expect(p.field[0]).toMatchObject({ instanceId: '1', x: 20, y: 70 });
  });

  it('drops attachments to discard and resets the card when it leaves the field', () => {
    const creature = slot('1', { x: 1, y: 2, tapped: true, strengthModifier: 2, materials: [slot('m', { faceDown: true })], resources: [slot('r')] });
    const p = applyLocalMove(player({ field: [creature] }), '1', 'field', 'deck');
    expect(p.field).toEqual([]);
    expect(p.deck[0]).toMatchObject({ faceDown: true, tapped: false, x: null, materials: [], strengthModifier: 0 });
    expect(p.discardPile.map((c) => [c.instanceId, c.faceDown])).toEqual([
      ['m', false],
      ['r', false],
    ]);
  });

  it('ignores unknown cards and keeps the input untouched', () => {
    const before = player({ hand: [slot('1')] });
    expect(applyLocalMove(before, 'zz', 'hand', 'field')).toBe(before);
    applyLocalMove(before, '1', 'hand', 'discardPile');
    expect(before.hand).toHaveLength(1);
  });
});

describe('postGameOptions', () => {
  it('limits the opponent to what the surrenderer allowed', () => {
    expect(postGameOptions(true, 'exit')).toEqual(['new_game', 'change_deck', 'exit']);
    expect(postGameOptions(false, 'exit')).toEqual(['exit']);
    expect(postGameOptions(false, 'change_deck')).toEqual(['change_deck', 'exit']);
    expect(postGameOptions(false, null)).toHaveLength(3);
  });
});

describe('shared counter and field geometry', () => {
  it('mirrors the shared bar for the second player', () => {
    expect(sharedIndexForValue(3, true)).toBe(13);
    expect(sharedIndexForValue(3, false)).toBe(7);
    expect(sharedValueForIndex(7, false)).toBe(3);
    expect(sharedValueForIndex(13, true)).toBe(3);
  });

  it('flips the opponent field and finds nearby creatures', () => {
    expect(fieldY(30, true)).toBe(70);
    expect(fieldY(null, false)).toBe(50);
    const field = [slot('a', { x: 50, y: 50 }), slot('b', { x: 52, y: 51, cardType: 'utility' })];
    expect(creatureNear(field, 53, 49, null)?.instanceId).toBe('a');
    expect(creatureNear(field, 53, 49, 'a')).toBeNull();
    expect(creatureNear(field, 80, 80, null)).toBeNull();
  });
});
