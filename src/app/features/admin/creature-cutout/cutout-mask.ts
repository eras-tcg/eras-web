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

/** A round dab of the brush at (x, y), radius r: painting the creature in (or erasing it), soft at its rim. */
export function dab(mask: Mask, x: number, y: number, r: number, add: boolean): void {
  const { width, height, data } = mask;
  const x0 = Math.max(0, Math.floor(x - r));
  const x1 = Math.min(width - 1, Math.ceil(x + r));
  const y0 = Math.max(0, Math.floor(y - r));
  const y1 = Math.min(height - 1, Math.ceil(y + r));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px - x, py - y);
      if (d > r) continue;
      // The last pixel of the dab blends in
      const k = Math.min(1, r - d);
      const i = py * width + px;
      data[i] = add ? Math.max(data[i], 255 * k) : Math.min(data[i], 255 * (1 - k));
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

/** Where a saved cut-out was cropped from its illustration (pixels), and the illustration's size then. */
export interface CutoutPlace {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The PNG text chunk keeping it (the cut-out tool of the batch writes the same). */
const PLACE_KEY = 'eras-cutout';

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

/** A PNG with where it was cropped from written in it (a text chunk before its image data). */
export function withPlace(png: Uint8Array, place: CutoutPlace): Uint8Array<ArrayBuffer> {
  const text = new TextEncoder().encode(`${PLACE_KEY}\0${JSON.stringify(place)}`);
  const chunk = new Uint8Array(12 + text.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, text.length);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // tEXt
  chunk.set(text, 8);
  view.setUint32(8 + text.length, crc32(chunk.subarray(4, 8 + text.length)));
  // Right after the header chunk (IHDR: 8 signature bytes + 25)
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33));
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}

/** Where a saved cut-out was cropped from, read from its PNG; null when it does not say. */
export function placeOf(png: Uint8Array): CutoutPlace | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  while (at + 12 <= png.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === 'IDAT' || type === 'IEND') return null;
    if (type === 'tEXt') {
      const body = new TextDecoder().decode(png.subarray(at + 8, at + 8 + length));
      const [key, value] = [body.slice(0, body.indexOf('\0')), body.slice(body.indexOf('\0') + 1)];
      if (key === PLACE_KEY) {
        try {
          const p = JSON.parse(value) as CutoutPlace;
          if ([p.x, p.y, p.width, p.height].every((n) => typeof n === 'number')) return p;
        } catch {
          return null;
        }
      }
    }
    at += 12 + length;
  }
  return null;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
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
