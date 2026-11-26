import { combine, dab, emptyMask, fadeDab, maskFromCutout, shownBox } from './cutout-mask';
import { placeOf, withPlace } from '@ui/domain/creature-summon/cutout-place';

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
    dab(m, 4.5, 4.5, 4, true);
    expect(m.data[4 * 9 + 4]).toBe(255);
    expect(m.data[0]).toBe(0);
    dab(m, 4.5, 4.5, 6, false);
    expect(m.data[4 * 9 + 4]).toBe(0);
  });

  it('a brush one pixel across paints only the pixel under the point', () => {
    const m = emptyMask(5, 5);
    dab(m, 2.7, 1.2, 1, true);
    expect([...m.data].filter((v) => v > 0)).toEqual([255]);
    expect(m.data[1 * 5 + 2]).toBe(255);
  });

  it('the Desvanecer brush fades softly, most in its middle, and a stroke going over itself does not add up', () => {
    const m = emptyMask(21, 21);
    m.data.fill(255);
    const base = m.data.slice();
    const reach = new Float32Array(m.data.length);
    fadeDab(m, base, reach, 10.5, 10.5, 16);
    fadeDab(m, base, reach, 10.5, 10.5, 16);
    const middle = m.data[10 * 21 + 10];
    const nearRim = m.data[10 * 21 + 17];
    expect(middle).toBe(Math.round(255 * 0.2));
    expect(nearRim).toBeGreaterThan(middle);
    expect(nearRim).toBeLessThan(255);
    expect(m.data[0]).toBe(255);
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

  it('puts an old cut-out back where it was, its 16 % edge fade undone', () => {
    const mask = emptyMask(100, 100);
    for (let y = 40; y < 60; y++) for (let x = 0; x < 30; x++) mask.data[y * 100 + x] = 255;
    // As the old saves faded it
    const alpha = new Uint8ClampedArray(mask.data.length);
    for (let i = 0; i < alpha.length; i++) {
      const x = i % 100;
      const y = (i - x) / 100;
      alpha[i] = mask.data[i] * Math.pow(Math.min(1, Math.min(x, 99 - x, y, 99 - y) / 16), 1.5);
    }
    const box = shownBox(alpha, 100, 100, 0)!;
    const crop = new Uint8ClampedArray(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) crop[y * box.w + x] = alpha[(box.y + y) * 100 + box.x + x];
    const back = maskFromCutout(crop, box.w, box.h, { x: box.x, y: box.y, width: 100, height: 100 }, 100, 100);
    expect(back.data[50 * 100 + 20]).toBe(255);
    expect(back.data[50 * 100 + 8]).toBeGreaterThan(240);
    expect(back.data[50 * 100 + 50]).toBe(0);
  });

  it('puts a new cut-out back as it was (no fade to undo)', () => {
    const crop = new Uint8ClampedArray(4 * 4).fill(128);
    const back = maskFromCutout(crop, 4, 4, { x: 0, y: 0, width: 10, height: 10, fade: 0 }, 10, 10);
    expect(back.data[0]).toBe(128);
    expect(back.data[5 * 10 + 5]).toBe(0);
  });

  it('fills the rim an old save cropped off where the figure reached the edge of the picture', () => {
    // A 400×400 picture filled; the old save faded it at 16 % (64 px) and kept 10..389 (the clear rim cropped off)
    const crop = new Uint8ClampedArray(380 * 380);
    for (let y = 0; y < 380; y++)
      for (let x = 0; x < 380; x++) {
        const near = Math.min(x + 10, 389 - x, y + 10, 389 - y);
        crop[y * 380 + x] = 255 * Math.pow(Math.min(1, near / 64), 1.5);
      }
    const back = maskFromCutout(crop, 380, 380, { x: 10, y: 10, width: 400, height: 400 }, 400, 400);
    expect(back.data[200 * 400 + 0]).toBeGreaterThan(240);
    expect(back.data[0]).toBeGreaterThan(240);
    expect(back.data[399 * 400 + 200]).toBeGreaterThan(240);
    expect(back.data[200 * 400 + 200]).toBe(255);
  });
});
