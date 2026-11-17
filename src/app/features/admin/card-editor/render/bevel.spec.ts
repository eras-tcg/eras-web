import { bevelMaps, insideDistance } from './bevel';

/** A w x h alpha with a filled rectangle. */
function rect(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Float32Array {
  const a = new Float32Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * w + x] = 1;
  return a;
}

describe('bevel', () => {
  it('measures the distance to the nearest outside pixel', () => {
    const d = insideDistance(rect(9, 9, 1, 1, 8, 8), 9, 9);
    expect(d[4 * 9 + 4]).toBe(4);
    expect(d[1 * 9 + 4]).toBe(1);
    expect(d[0]).toBe(0);
  });

  it('lights the faces turned to the light and shades the others (light from the lower right)', () => {
    const w = 20;
    const a = rect(w, w, 2, 2, 18, 18);
    const { hi, sh } = bevelMaps(a, w, w, { size: 4, depth: 100, angle: -45, altitude: 30 });
    const at = (m: Float32Array, x: number, y: number) => m[y * w + x];
    // Left and top edges face away from a lower-right light; right and bottom edges face it.
    expect(at(sh, 2, 10)).toBeGreaterThan(0.2);
    expect(at(sh, 10, 2)).toBeGreaterThan(0.2);
    expect(at(hi, 17, 10)).toBeGreaterThan(0.1);
    expect(at(hi, 10, 17)).toBeGreaterThan(0.1);
    // The flat top beyond the bevel size is untouched.
    expect(at(hi, 10, 10)).toBe(0);
    expect(at(sh, 10, 10)).toBe(0);
  });

  it('averages a finer alpha down to the output size', () => {
    const fine = rect(8, 8, 0, 0, 4, 8);
    const { alpha } = bevelMaps(fine, 4, 4, { size: 2, depth: 100, angle: 120, altitude: 30 }, 2);
    expect([...alpha.slice(0, 4)]).toEqual([1, 1, 0, 0]);
  });
});
