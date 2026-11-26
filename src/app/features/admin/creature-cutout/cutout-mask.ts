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
 * A soft dab of the Desvanecer brush at (x, y), `size` across: within one stroke the mask goes down from what it was when
 * the stroke began (`base`) by up to `strength` at the dab's middle, less towards its rim (`reach` keeps how far each
 * pixel was reached in the stroke, so going over it again does not add up). Another stroke fades it further.
 */
export function fadeDab(mask: Mask, base: Uint8ClampedArray, reach: Float32Array, x: number, y: number, size: number, strength = 0.8): void {
  const { width, height, data } = mask;
  const r = Math.max(0.5, size / 2);
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(width - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(height - 1, Math.ceil(y + r));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + 0.5 - x, py + 0.5 - y) / r;
      if (d >= 1) continue;
      // Smooth from the middle to nothing at the rim
      const k = 1 - d * d * (3 - 2 * d);
      const i = py * width + px;
      if (k <= reach[i]) continue;
      reach[i] = k;
      data[i] = base[i] * (1 - strength * k);
    }
  }
}

/** How much of a pixel at (x, y) the old saves left near the picture's edge (`fade` of its shorter side, 0 at it). */
function edgeFade(x: number, y: number, w: number, h: number, fade: number): number {
  if (fade <= 0) return 1;
  const near = Math.min(x, w - 1 - x, y, h - 1 - y);
  return Math.pow(Math.min(1, near / (fade * Math.min(w, h))), 1.5);
}

/**
 * The mask back from a saved cut-out: its alpha put where it was cropped from, the edge fade of the old saves undone
 * (the very rim, where it left nothing, stays out). `place` in the illustration's size then; scaled to `width`×`height`.
 */
export function maskFromCutout(alpha: Uint8ClampedArray, cw: number, ch: number, place: CutoutPlace, width: number, height: number): Mask {
  const mask = emptyMask(width, height);
  const W = place.width;
  const H = place.height;
  const fade = place.fade ?? 0.16;
  // An old save faded the picture's edge out and cropped off the rim it left clear: on the sides it reached, the rim is
  // filled from just inside it (where the fade still kept the picture)
  const inner = fade > 0 ? Math.ceil(0.45 * fade * Math.min(W, H)) : 0;
  const band = 0.08 * Math.min(W, H);
  const lost = {
    left: fade > 0 && place.x <= band,
    top: fade > 0 && place.y <= band,
    right: fade > 0 && W - (place.x + cw) <= band,
    bottom: fade > 0 && H - (place.y + ch) <= band,
  };
  for (let y = 0; y < height; y++) {
    let py = Math.floor((y * H) / height);
    if (lost.top) py = Math.max(py, inner, place.y);
    if (lost.bottom) py = Math.min(py, H - 1 - inner, place.y + ch - 1);
    const sy = py - place.y;
    if (sy < 0 || sy >= ch) continue;
    for (let x = 0; x < width; x++) {
      let px = Math.floor((x * W) / width);
      if (lost.left) px = Math.max(px, inner, place.x);
      if (lost.right) px = Math.min(px, W - 1 - inner, place.x + cw - 1);
      const sx = px - place.x;
      if (sx < 0 || sx >= cw) continue;
      const a = alpha[sy * cw + sx];
      if (!a) continue;
      const f = edgeFade(px, py, W, H, fade);
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
