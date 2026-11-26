import { paletteOf } from './creature-palette';

/** Pixels as RGBA bytes: `count` of each color. */
function pixels(...colors: [number, number, number, number, number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [r, g, b, a, count] of colors) for (let i = 0; i < count; i++) out.push(r, g, b, a);
  return new Uint8ClampedArray(out);
}

describe('paletteOf', () => {
  it('takes the two biggest hues, brightened to full light', () => {
    const p = paletteOf(pixels([200, 40, 40, 255, 30], [40, 60, 180, 255, 10]));
    expect(p.main).toBe('rgb(255 51 51)');
    expect(p.second).toBe('rgb(57 85 255)');
  });

  it('leaves out what is transparent, dark or grey', () => {
    const p = paletteOf(pixels([200, 40, 40, 0, 50], [20, 20, 20, 255, 50], [150, 150, 150, 255, 50], [40, 200, 60, 255, 5]));
    expect(p.main).toBe('rgb(51 255 77)');
    expect(p.second).toBe(p.main);
  });

  it('has a quiet fallback when nothing has color', () => {
    expect(paletteOf(pixels([10, 10, 10, 255, 4])).main).toBe('rgb(203 213 225)');
  });
});
