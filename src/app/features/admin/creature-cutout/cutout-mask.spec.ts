import { combine, dab, emptyMask, fadedAtEdges, maskFromCutout, placeOf, shownBox, withPlace } from './cutout-mask';

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

describe('cut-out place', () => {
  // A 1×1 PNG: signature, IHDR, IDAT, IEND
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );

  it('is written in the PNG and read back', () => {
    const place = { x: 12, y: 30, width: 600, height: 840 };
    expect(placeOf(withPlace(png, place))).toEqual(place);
    expect(placeOf(png)).toBeNull();
  });

  it('puts the cut-out back where it was, the edge fade undone', () => {
    const mask = emptyMask(100, 100);
    for (let y = 40; y < 60; y++) for (let x = 0; x < 30; x++) mask.data[y * 100 + x] = 255;
    const alpha = fadedAtEdges(mask);
    const box = shownBox(alpha, 100, 100, 0)!;
    const crop = new Uint8ClampedArray(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) crop[y * box.w + x] = alpha[(box.y + y) * 100 + box.x + x];
    const back = maskFromCutout(crop, box.w, box.h, { x: box.x, y: box.y, width: 100, height: 100 }, 100, 100);
    expect(back.data[50 * 100 + 20]).toBe(255);
    expect(back.data[50 * 100 + 8]).toBeGreaterThan(240);
    expect(back.data[50 * 100 + 50]).toBe(0);
  });
});
