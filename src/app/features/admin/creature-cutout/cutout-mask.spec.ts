import { combine, dab, emptyMask, fadedAtEdges, shownBox } from './cutout-mask';

describe('cutout mask', () => {
  it('adds a part and takes one out', () => {
    let m = emptyMask(4, 1);
    m = combine(m, new Uint8Array([1, 1, 0, 0]), true);
    expect([...m.data]).toEqual([255, 255, 0, 0]);
    m = combine(m, new Uint8Array([0, 1, 1, 0]), false);
    expect([...m.data]).toEqual([255, 0, 0, 0]);
  });

  it('paints a round dab and erases it', () => {
    const m = emptyMask(9, 9);
    dab(m, 4, 4, 2, true);
    expect(m.data[4 * 9 + 4]).toBe(255);
    expect(m.data[0]).toBe(0);
    dab(m, 4, 4, 3, false);
    expect(m.data[4 * 9 + 4]).toBe(0);
  });

  it('fades the figure where it meets the edge, not inside', () => {
    const m = emptyMask(100, 100);
    m.data.fill(255);
    const a = fadedAtEdges(m);
    expect(a[0]).toBe(0);
    expect(a[50 * 100 + 50]).toBe(255);
    expect(a[50 * 100 + 5]).toBeGreaterThan(0);
    expect(a[50 * 100 + 5]).toBeLessThan(255);
  });

  it('finds the box round what shows', () => {
    const alpha = new Uint8ClampedArray(20 * 20);
    alpha[5 * 20 + 6] = 200;
    alpha[9 * 20 + 10] = 200;
    expect(shownBox(alpha, 20, 20, 2)).toEqual({ x: 4, y: 3, w: 9, h: 9 });
    expect(shownBox(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });
});
