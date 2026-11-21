import { describe, expect, it } from 'vitest';
import { MAX_TILT, cardEdge, lightOf, tiltFromDrag } from './card-tilt';

describe('card tilt', () => {
  it('turns the card the way it is dragged, from where it was', () => {
    const flat = { rx: 0, ry: 0 };
    expect(tiltFromDrag(flat, 50, 0, 400, 560)).toEqual({ rx: 0, ry: 11.25 });
    expect(tiltFromDrag(flat, 0, -56, 400, 560)).toEqual({ rx: 9, ry: 0 });
    expect(tiltFromDrag({ rx: 5, ry: 10 }, -40, 0, 400, 560)).toEqual({ rx: 5, ry: 1 });
  });

  it('never turns past the limit', () => {
    expect(tiltFromDrag({ rx: 0, ry: 0 }, 5000, 5000, 400, 560)).toEqual({ rx: -MAX_TILT, ry: MAX_TILT });
  });

  it('moves the glare against the turn and brightens it the more it turns', () => {
    const flat = lightOf({ rx: 0, ry: 0 });
    expect(flat).toEqual({ x: 50, y: 50, glare: 0.2, shade: 0, glossX: 50, glossY: 50, gloss: 0.25 });
    const turned = lightOf({ rx: 0, ry: MAX_TILT });
    expect(turned.x).toBe(0);
    // The gloss band slides the other way, and shines brighter
    expect(turned.glossX).toBe(100);
    expect(turned.gloss).toBeCloseTo(0.85);
    expect(turned.glare).toBeCloseTo(0.8);
    expect(turned.shade).toBeCloseTo(0.55);
  });

  it('stacks the thickness behind the face, lighter in the middle', () => {
    const edge = cardEdge(4, 4);
    expect(edge.map((e) => e.z)).toEqual([-1, -2, -3, -4]);
    expect(edge[1].lit).toBe(1);
    expect(edge[3].lit).toBe(0);
    expect(edge[0].lit).toBeCloseTo(0.71);
  });
});
