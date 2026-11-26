/*
 * Where a saved creature cut-out was cropped from its illustration: a text chunk of its PNG (written by the cut-out
 * editor and the batch tool), so the editor can go on from a saved cut-out.
 */
/** Where a saved cut-out was cropped from its illustration (pixels), and the illustration's size then. */
export interface CutoutPlace {
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * How far in from the picture's edges the save faded the figure out, as a share of the picture's shorter side, and from
   * which edges (the editor's "Desvanecer bordes"). Cut-outs saved before say nothing: all four edges at 0.16.
   */
  fade?: number;
  edges?: CutoutEdges;
}

/** The picture's edges a cut-out fades out from. */
export interface CutoutEdges {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export const ALL_EDGES: CutoutEdges = { top: true, right: true, bottom: true, left: true };
export const NO_EDGES: CutoutEdges = { top: false, right: false, bottom: false, left: false };

/** The PNG text chunk keeping it (the cut-out tool of the batch writes the same). */
const PLACE_KEY = 'eras-cutout';

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
