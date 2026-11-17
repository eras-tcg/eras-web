import { ColorLut, LUT_GRID } from './color-lut';

/** A table that maps every grid point through fn. */
function table(fn: (v: number) => number): Uint8Array {
  const G = LUT_GRID;
  const t = new Uint8Array(G ** 3 * 3);
  for (let i = 0; i < G; i++)
    for (let j = 0; j < G; j++)
      for (let k = 0; k < G; k++) {
        const o = ((i * G + j) * G + k) * 3;
        [i, j, k].forEach((v, c) => (t[o + c] = fn(Math.round((v * 255) / (G - 1)))));
      }
  return t;
}

describe('ColorLut', () => {
  const identity = table((v) => v);
  const half = table((v) => Math.round(v / 2));
  const lut = new ColorLut(new Uint8Array([...half, ...identity]));

  it('maps through the forward table with interpolation, keeping alpha', () => {
    const px = new Uint8ClampedArray([255, 100, 0, 77]);
    lut.forward(px);
    expect([...px]).toEqual([128, 50, 0, 77]);
  });

  it('maps through the inverse table', () => {
    const px = new Uint8ClampedArray([12, 200, 255, 255]);
    lut.inverse(px);
    expect([...px]).toEqual([12, 200, 255, 255]);
  });

  it('rejects a table of the wrong size', () => {
    expect(() => new ColorLut(new Uint8Array(10))).toThrow();
  });
});
