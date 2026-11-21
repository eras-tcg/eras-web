import { CARD_H, CARD_W, edgePoint, shatterShape } from './shatter-shape';

/** The area of a polygon (shoelace). */
const area = (pts: { x: number; y: number }[]) =>
  Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0)) / 2;

describe('shatterShape', () => {
  it('breaks the same card the same way', () => {
    expect(shatterShape('abc')).toEqual(shatterShape('abc'));
    expect(shatterShape('abc')).not.toEqual(shatterShape('xyz'));
  });

  it('splits the whole card into pieces around the impact, inside the card', () => {
    for (const id of ['a', 'b', 'card-123', 'ec467f1d']) {
      const s = shatterShape(id);
      expect(s.pieces.length).toBeGreaterThanOrEqual(6);
      const all = s.pieces.flatMap((p) => p.outline);
      expect(all.every((p) => p.x >= 0 && p.x <= CARD_W && p.y >= 0 && p.y <= CARD_H)).toBe(true);
      const total = s.pieces.reduce((sum, p) => sum + area(p.outline), 0);
      expect(total).toBeCloseTo(CARD_W * CARD_H, 0);
    }
  });

  it('runs a crack from the impact to the edge between pieces, each with a branch', () => {
    const s = shatterShape('abc');
    expect(s.cracks.length).toBe(s.pieces.length * 2);
    expect(s.cracks[0][0]).toEqual(s.impact);
  });

  it('finds where a ray leaves the card', () => {
    expect(edgePoint({ x: 31.5, y: 44 }, 0)).toEqual({ x: CARD_W, y: 44 });
    expect(edgePoint({ x: 31.5, y: 44 }, Math.PI / 2).y).toBeCloseTo(CARD_H);
  });
});
