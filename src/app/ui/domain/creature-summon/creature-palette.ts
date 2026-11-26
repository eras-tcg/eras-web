/** Two colors to light a summon with: the main one (most of the picture) and a second one. CSS rgb() strings. */
export interface CreaturePalette {
  main: string;
  second: string;
}

const FALLBACK: CreaturePalette = { main: 'rgb(203 213 225)', second: 'rgb(148 163 184)' };

/**
 * The two main colors of a picture (pixels as RGBA bytes): dark and grey pixels left out, the rest grouped in twelve
 * hues, the two biggest groups averaged and brightened to full light (they light the stage, they are not paint).
 */
export function paletteOf(pixels: Uint8ClampedArray): CreaturePalette {
  const groups = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    const max = Math.max(r, g, b);
    // Transparent (outside the cut-out), dark or grey: no light to take from it
    if (a < 128 || max < 70 || max - Math.min(r, g, b) < 45) continue;
    const hue = Math.round(((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI + 360) % 360 / 30) % 12;
    const e = groups.get(hue) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    groups.set(hue, e);
  }
  const top = [...groups.values()]
    .sort((x, y) => y.n - x.n)
    .slice(0, 2)
    .map((e) => {
      const k = 255 / Math.max(e.r / e.n, e.g / e.n, e.b / e.n, 1);
      return `rgb(${Math.round((e.r / e.n) * k)} ${Math.round((e.g / e.n) * k)} ${Math.round((e.b / e.n) * k)})`;
    });
  if (!top.length) return FALLBACK;
  return { main: top[0], second: top[1] ?? top[0] };
}

/** The palette of an image at `url` (read small; the fallback if it cannot be read). */
export function paletteOfImage(url: string): Promise<CreaturePalette> {
  return new Promise((done) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 45;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(FALLBACK);
        ctx.drawImage(img, 0, 0, 32, 45);
        done(paletteOf(ctx.getImageData(0, 0, 32, 45).data));
      } catch {
        done(FALLBACK);
      }
    };
    img.onerror = () => done(FALLBACK);
    img.src = url;
  });
}
