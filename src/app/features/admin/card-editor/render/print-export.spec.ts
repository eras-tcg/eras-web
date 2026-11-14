import { cmykTiff, rgbaToCmyk } from './print-export';

describe('print-export', () => {
  it('converts RGB to CMYK with the full-black inverse', () => {
    const px = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0]);
    expect([...rgbaToCmyk(px)]).toEqual([0, 0, 0, 0, 0, 0, 0, 255, 0, 255, 255, 0, 0, 0, 0, 0]);
  });

  it('round-trips a Photoshop CMYK color through RGB', () => {
    // C 72.94 M 87.84 Y 6.67 K 0 → RGB (69, 31, 238) → back to CMYK.
    const [c, m, y, k] = rgbaToCmyk(new Uint8Array([69, 31, 238, 255]));
    expect(k).toBe(17);
    expect(c).toBeGreaterThan(180);
    expect(m).toBeGreaterThan(220);
    expect(y).toBe(0);
  });

  it('writes a little-endian CMYK TIFF header', async () => {
    const blob = cmykTiff({ width: 2, height: 1, data: new Uint8Array(8) });
    const v = new DataView(await blob.arrayBuffer());
    expect(v.getUint16(0)).toBe(0x4949);
    expect(v.getUint16(2, true)).toBe(42);
    expect(blob.size).toBeGreaterThan(8);
  });
});
