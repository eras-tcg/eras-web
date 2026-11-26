import { describe, expect, it } from 'vitest';
import { drawnFrontRow, formationGrants, formationPlaces, formationRanks, frontOrder, pointsSide } from './formations';
import { CardSlot, PlayerState } from './simulator.model';

const slot = (id: string, over: Partial<CardSlot> = {}): CardSlot =>
  ({ instanceId: id, cardId: 'c' + id, imageUrl: 'img', faceDown: false, tapped: false, x: 50, y: 25, cardName: 'N' + id, cardType: 'creature',
     strength: 3, specialSummonKind: null, starter: false, strengthModifier: 0, materials: [], resources: [], ...over }) as CardSlot;

describe('formations', () => {
  it('orders the Línea frontal by x, ties by field order, creatures only', () => {
    const field = [slot('b', { x: 40 }), slot('a', { x: 40 }), slot('l', { x: 10 }), slot('r', { x: 20, y: 75 }), slot('u', { x: 5, cardType: 'utility' })];
    expect(frontOrder(field).map((c) => c.instanceId)).toEqual(['l', 'b', 'a']);
  });

  it('points to a neighbour with the arrow toward it while active', () => {
    const a = slot('a', { x: 10, arrows: ['right'] });
    const b = slot('b', { x: 20, arrows: ['left', 'right'] });
    const order = [a, b];
    expect(pointsSide(order, a, 'right')).toBe(true);
    expect(pointsSide(order, a, 'left')).toBe(false);
    expect(pointsSide(order, b, 'left')).toBe(true);
    // No neighbour on its right
    expect(pointsSide(order, b, 'right')).toBe(false);
    expect(pointsSide([{ ...a, tapped: true }, b], { ...a, tapped: true }, 'right')).toBe(false);
  });

  it('marks where each formation starts and ends in the row', () => {
    const row = [slot('a'), slot('b'), slot('c'), slot('d'), slot('e')];
    const player = { formations: [['b', 'a'], ['d', 'e']] } as unknown as PlayerState;
    const places = formationPlaces(player, row);
    expect(places.get('a')).toEqual({ index: 0, start: true, end: false });
    expect(places.get('b')).toEqual({ index: 0, start: false, end: true });
    expect(places.has('c')).toBe(false);
    expect(places.get('d')).toEqual({ index: 1, start: true, end: false });
    expect(places.get('e')).toEqual({ index: 1, start: false, end: true });
  });

  it('draws a creature left between two members of a formation it is not in at the end of the row', () => {
    const player = { formations: [['a', 'b']] } as unknown as PlayerState;
    const ids = (row: CardSlot[]) => drawnFrontRow(player, row).map((c) => c.instanceId);
    expect(ids([slot('a'), slot('s'), slot('b'), slot('c')])).toEqual(['a', 'b', 'c', 's']);
    // Two of them at once; a utility among them is not a creature (it stays where it is)
    expect(ids([slot('a'), slot('s'), slot('u', { cardType: 'utility' }), slot('t'), slot('b')])).toEqual(['a', 'u', 'b', 's', 't']);
    // Next to a formation (not between its members), or between two formations: where it stands
    expect(ids([slot('a'), slot('b'), slot('s')])).toEqual(['a', 'b', 's']);
    const two = { formations: [['a', 'b'], ['c', 'd']] } as unknown as PlayerState;
    expect(drawnFrontRow(two, [slot('a'), slot('b'), slot('s'), slot('c'), slot('d')]).map((c) => c.instanceId)).toEqual(['a', 'b', 's', 'c', 'd']);
    // The formation is drawn whole
    const places = formationPlaces(player, drawnFrontRow(player, [slot('a'), slot('s'), slot('b')]));
    expect(places.get('a')).toEqual({ index: 0, start: true, end: false });
    expect(places.get('b')).toEqual({ index: 0, start: false, end: true });
  });

  it('ranks each formation by its highest level, under its middle', () => {
    const row = [slot('a', { level: 2 }), slot('b', { level: 4 }), slot('c', { level: 1 }), slot('x', { level: 5 }), slot('d', { level: 3 }), slot('e', { level: 1 })];
    const player = { formations: [['a', 'b', 'c'], ['d', 'e']] } as unknown as PlayerState;
    const ranks = formationRanks(formationPlaces(player, row), row);
    // Three members: on the middle one; two: between them (on the left one's right edge); a creature apart has none
    expect(ranks.get('b')).toEqual({ rank: 4, between: false });
    expect(ranks.get('d')).toEqual({ rank: 3, between: true });
    expect(ranks.size).toBe(2);
  });

  it('reads the link effects received', () => {
    expect(formationGrants(slot('a', { formationGrants: ['s1|12|Ariel, La Guía', 's2|3|A|B'] }))).toEqual([
      { sourceId: 's1', sourceName: 'Ariel, La Guía' },
      { sourceId: 's2', sourceName: 'A|B' },
    ]);
    expect(formationGrants(slot('b'))).toEqual([]);
  });
});
