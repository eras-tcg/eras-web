/**
 * Photoshop "Bevel and Emboss", inner bevel with the chisel hard technique, computed per pixel from a layer's alpha:
 * the surface height is the distance to the shape's edge (capped at the bevel size), its slope is scaled by the
 * depth, and each pixel is lit from the light angle and altitude. Faces turned to the light get the highlight
 * (screen), faces turned away get the shadow (multiply); a flat face gets neither.
 */
export interface BevelLight {
  /** Bevel size in pixels. */
  size: number;
  /** Depth in percent (100 = Photoshop's default). */
  depth: number;
  /** Light angle in degrees, counter-clockwise from +x (Photoshop convention). */
  angle: number;
  /** Light altitude in degrees. */
  altitude: number;
}

export interface BevelMaps {
  /** Layer alpha at 1x, 0..1. */
  alpha: Float32Array;
  /** Highlight strength per pixel, 0..1 (before the effect opacity and the layer alpha). */
  hi: Float32Array;
  /** Shadow strength per pixel, 0..1. */
  sh: Float32Array;
}

const INF = 1e20;

/** 1D squared distance transform (Felzenszwalb–Huttenlocher) of f into d, over n samples. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Euclidean distance from each inside pixel (alpha >= 0.5) to the nearest outside pixel; 0 outside. */
export function insideDistance(alpha: Float32Array, w: number, h: number): Float32Array {
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = alpha[i] >= 0.5 ? INF : 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/**
 * Highlight and shadow strengths of a chisel hard inner bevel. The alpha comes at `scale` times the output size
 * (w x h): the distance is measured on that finer grid and the height averaged down, so curved edges stay smooth.
 */
export function bevelMaps(fine: Float32Array, w: number, h: number, light: BevelLight, scale = 1): BevelMaps {
  const fw = w * scale;
  const dist = insideDistance(fine, fw, h * scale);
  const size = Math.max(1, light.size);
  const height = new Float32Array(w * h);
  const alpha = new Float32Array(w * h);
  const cell = scale * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hs = 0;
      let as = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const j = (y * scale + sy) * fw + x * scale + sx;
          hs += Math.min(dist[j] / scale, size);
          as += fine[j];
        }
      }
      height[y * w + x] = hs / cell;
      alpha[y * w + x] = as / cell;
    }
  }
  const k = light.depth / 100;
  const az = (light.angle * Math.PI) / 180;
  const el = (light.altitude * Math.PI) / 180;
  // Image y grows downwards, so the light's y component flips.
  const lx = Math.cos(az) * Math.cos(el);
  const ly = -Math.sin(az) * Math.cos(el);
  const lz = Math.sin(el);
  const hi = new Float32Array(w * h);
  const sh = new Float32Array(w * h);
  const at = (x: number, y: number) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alpha[i] <= 0) continue;
      // Central differences, one-sided on the borders of the buffer.
      const gx = (at(x + 1, y) - at(x - 1, y)) / (x === 0 || x === w - 1 ? 1 : 2);
      const gy = (at(x, y + 1) - at(x, y - 1)) / (y === 0 || y === h - 1 ? 1 : 2);
      const nx = -gx * k;
      const ny = -gy * k;
      const shade = (nx * lx + ny * ly + lz) / Math.sqrt(nx * nx + ny * ny + 1);
      if (shade > lz) hi[i] = Math.min(1, shade - lz);
      else sh[i] = Math.min(1, lz - shade);
    }
  }
  return { alpha, hi, sh };
}
