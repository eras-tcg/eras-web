import { describe, expect, it } from 'vitest';
import { formationGrants, formationPlaces, frontOrder, pointsSide } from './formations';
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

  it('reads the link effects received', () => {
    expect(formationGrants(slot('a', { formationGrants: ['s1|12|Ariel, La Guía', 's2|3|A|B'] }))).toEqual([
      { sourceId: 's1', sourceName: 'Ariel, La Guía' },
      { sourceId: 's2', sourceName: 'A|B' },
    ]);
    expect(formationGrants(slot('b'))).toEqual([]);
  });
});
