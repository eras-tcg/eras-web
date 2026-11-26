import { CutoutPlace } from '@ui/domain/creature-summon/cutout-place';

/**
 * A cut-out's mask: one byte per pixel of the illustration (0 outside the creature, 255 inside), row by row. The editor
 * builds it part by part (parts found by SAM, strokes of a brush) and turns it into the creature's PNG.
 */
export interface Mask {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function emptyMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8ClampedArray(width * height) };
}

/** A part found (same size) added to the mask, or taken out of it. */
export function combine(mask: Mask, part: Uint8ClampedArray | Uint8Array, add: boolean): Mask {
  const data = new Uint8ClampedArray(mask.data.length);
  for (let i = 0; i < data.length; i++) {
    const p = part[i] ? 255 : 0;
    data[i] = add ? Math.max(mask.data[i], p) : Math.min(mask.data[i], 255 - p);
  }
  return { ...mask, data };
}

/**
 * A round dab of the brush at (x, y), `size` pixels across: painting the creature in (or erasing it), soft at its rim.
 * One pixel across is just the pixel under the point, whole.
 */
export function dab(mask: Mask, x: number, y: number, size: number, add: boolean): void {
  const { width, height, data } = mask;
  const put = (i: number, k: number) => (data[i] = add ? Math.max(data[i], 255 * k) : Math.min(data[i], 255 * (1 - k)));
  if (size <= 1) {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px >= 0 && py >= 0 && px < width && py < height) put(py * width + px, 1);
    return;
  }
  const r = size / 2;
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(width - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(height - 1, Math.ceil(y + r));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      // From the pixel's middle; its last pixel blends in
      const k = Math.min(1, r - Math.hypot(px + 0.5 - x, py + 0.5 - y) + 0.5);
      if (k > 0) put(py * width + px, k);
    }
  }
}

/**
 * The mask faded where the figure runs into the picture's edge (a wing cut by the frame): a fade over 16 % of its
 * shorter side, never a straight cut.
 */
export function fadedAtEdges(mask: Mask): Uint8ClampedArray {
  const { width: w, height: h, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + x] = data[y * w + x] * edgeFade(x, y, w, h);
  }
  return out;
}

/** How much of a pixel at (x, y) shows near the picture's edge (0 at the edge, 1 from 16 % of its shorter side in). */
function edgeFade(x: number, y: number, w: number, h: number): number {
  const near = Math.min(x, w - 1 - x, y, h - 1 - y);
  return Math.pow(Math.min(1, near / (0.16 * Math.min(w, h))), 1.5);
}

/**
 * The mask back from a saved cut-out: its alpha put where it was cropped from, the edge fade undone (the very rim,
 * where the fade left nothing, stays out). `place` in the illustration's size then; scaled to `width`×`height`.
 */
export function maskFromCutout(alpha: Uint8ClampedArray, cw: number, ch: number, place: CutoutPlace, width: number, height: number): Mask {
  const mask = emptyMask(width, height);
  const kx = width / place.width;
  const ky = height / place.height;
  for (let y = 0; y < height; y++) {
    const sy = Math.floor(y / ky) - place.y;
    if (sy < 0 || sy >= ch) continue;
    for (let x = 0; x < width; x++) {
      const sx = Math.floor(x / kx) - place.x;
      if (sx < 0 || sx >= cw) continue;
      const a = alpha[sy * cw + sx];
      if (!a) continue;
      const f = edgeFade(x, y, width, height);
      mask.data[y * width + x] = f > 0.02 ? Math.min(255, a / f) : 255;
    }
  }
  return mask;
}

/** The box round what shows of the creature (alpha over 40), with `pad` pixels round it; null when nothing shows. */
export function shownBox(alpha: Uint8ClampedArray, w: number, h: number, pad = 12): { x: number; y: number; w: number; h: number } | null {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] <= 40) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y };
}
