/**
 * The card is designed in CMYK. The editor draws it in "naive RGB" (R = 255·(1−C)(1−K)…), which converts back to the
 * same CMYK for print, but looks too saturated on screen. Photoshop's "Guardar para Web" shows it through the CMYK
 * profile instead; these tables reproduce that conversion, learned from the designer's own pairs of exports
 * (card-maker/make_color_lut.py):
 *   forward: naive RGB -> screen sRGB (preview and PNG)
 *   inverse: screen sRGB -> naive RGB (art uploaded in sRGB, so it ends up as Photoshop would print and show it)
 */
export const LUT_GRID = 33;

export class ColorLut {
  private readonly forwardTable: Uint8Array;
  private readonly inverseTable: Uint8Array;

  constructor(data: Uint8Array) {
    const n = LUT_GRID ** 3 * 3;
    if (data.length !== n * 2) throw new Error('Tabla de color inválida');
    this.forwardTable = data.subarray(0, n);
    this.inverseTable = data.subarray(n);
  }

  /** Naive RGB -> screen sRGB, in place over RGBA pixels. */
  forward(px: Uint8ClampedArray): void {
    apply(this.forwardTable, px);
  }

  /** Screen sRGB -> naive RGB, in place over RGBA pixels. */
  inverse(px: Uint8ClampedArray): void {
    apply(this.inverseTable, px);
  }
}

/** Trilinear lookup of every RGBA pixel's RGB in a 33³ table (alpha untouched). */
function apply(t: Uint8Array, px: Uint8ClampedArray): void {
  const G = LUT_GRID;
  const step = 255 / (G - 1);
  const at = (i: number, j: number, k: number, c: number) => t[((i * G + j) * G + k) * 3 + c];
  for (let p = 0; p < px.length; p += 4) {
    const fr = px[p] / step;
    const fg = px[p + 1] / step;
    const fb = px[p + 2] / step;
    const r0 = Math.min(G - 2, Math.floor(fr));
    const g0 = Math.min(G - 2, Math.floor(fg));
    const b0 = Math.min(G - 2, Math.floor(fb));
    const tr = fr - r0;
    const tg = fg - g0;
    const tb = fb - b0;
    for (let c = 0; c < 3; c++) {
      const c00 = at(r0, g0, b0, c) * (1 - tb) + at(r0, g0, b0 + 1, c) * tb;
      const c01 = at(r0, g0 + 1, b0, c) * (1 - tb) + at(r0, g0 + 1, b0 + 1, c) * tb;
      const c10 = at(r0 + 1, g0, b0, c) * (1 - tb) + at(r0 + 1, g0, b0 + 1, c) * tb;
      const c11 = at(r0 + 1, g0 + 1, b0, c) * (1 - tb) + at(r0 + 1, g0 + 1, b0 + 1, c) * tb;
      const v = (c00 * (1 - tg) + c01 * tg) * (1 - tr) + (c10 * (1 - tg) + c11 * tg) * tr;
      px[p + c] = Math.round(v);
    }
  }
}

/** Runs a conversion over a whole canvas. */
export function convertCanvas(
  canvas: HTMLCanvasElement,
  run: (px: Uint8ClampedArray) => void,
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  run(img.data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
