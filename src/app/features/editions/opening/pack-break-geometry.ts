/**
 * The shapes of a pack breaking open (PackBreakComponent), drawn anew for every pack so no two look alike: the
 * cracks, in three stages (one per blow), and the irregular shards it shatters into. Pure: the random source is
 * passed in. Coordinates are in the pack's own units, PACK_W × PACK_H (its card shape), so the shards are not
 * stretched.
 */

export const PACK_W = 63;
export const PACK_H = 88;
/** Where the blows land: a bit above the middle. */
export const IMPACT = { x: PACK_W / 2, y: PACK_H * 0.45 };

export type Random = () => number;
export interface Point {
  x: number;
  y: number;
}

/** A seeded random source (mulberry32), for tests and previews. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inside = (p: Point) => p.x >= 0 && p.x <= PACK_W && p.y >= 0 && p.y <= PACK_H;

/** A jagged line from `from` heading `angle` (radians) for about `length`, in short steps that turn a little each. */
function jagged(from: Point, angle: number, length: number, random: Random, stopAtEdge: boolean): Point[] {
  const points = [from];
  let heading = angle;
  let walked = 0;
  let at = from;
  while (walked < length) {
    const step = 3 + random() * 4;
    heading += (random() - 0.5) * 0.6;
    at = { x: at.x + Math.cos(heading) * step, y: at.y + Math.sin(heading) * step };
    points.push(at);
    walked += step;
    if (stopAtEdge && !inside(at)) break;
  }
  return points;
}

/** The part of a polyline between two fractions of its length (0..1), as points. */
function slice(points: Point[], from: number, to: number): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths[lengths.length - 1] || 1;
  const at = (f: number): Point => {
    const target = f * total;
    for (let i = 1; i < points.length; i++) {
      if (lengths[i] >= target) {
        const t = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
        return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
      }
    }
    return points[points.length - 1];
  };
  const out = [at(from)];
  for (let i = 0; i < points.length; i++) if (lengths[i] > from * total && lengths[i] < to * total) out.push(points[i]);
  out.push(at(to));
  return out;
}

const path = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** Where each blow takes the main cracks, as fractions of their whole length. */
const STAGE_ENDS = [0.22, 0.55, 1];

/**
 * The cracks of a pack in three stages, as SVG path data in pack units: the first blow opens a few short cracks from
 * the impact, the second takes them further and branches them, the third runs them to the edges with more branches.
 * Each stage only holds its new lines (they continue the earlier ones), one path each, so they draw themselves
 * together on its blow. `mains` cracks start at the impact; without `branches` they never split (a plain pack).
 */
export function crackStages(random: Random, mains = 6, branches = true): string[][] {
  const stages: string[][] = [[], [], []];
  for (let m = 0; m < mains; m++) {
    const angle = (m / mains) * Math.PI * 2 + (random() - 0.5) * 0.7;
    const main = jagged(IMPACT, angle, 140, random, true);
    let start = 0;
    STAGE_ENDS.forEach((end, stage) => {
      const part = slice(main, start, end);
      stages[stage].push(path(part));
      // From the second blow on, branches split off the new part
      if (stage > 0 && branches) {
        const count = stage === 1 ? 1 : 1 + Math.floor(random() * 2);
        for (let b = 0; b < count; b++) {
          const from = part[Math.floor(random() * (part.length - 1))];
          const side = random() < 0.5 ? -1 : 1;
          stages[stage].push(path(jagged(from, angle + side * (0.45 + random() * 0.5), 8 + random() * 14, random, true)));
        }
      }
      start = end;
    });
  }
  return stages;
}

/** A shard: its outline in pack units and its middle. */
export interface ShardShape {
  points: Point[];
  center: Point;
}

/** Keeps the part of `polygon` on the side of the line through `mid` facing away from `normal` (Sutherland–Hodgman). */
function clip(polygon: Point[], mid: Point, normal: Point): Point[] {
  const side = (p: Point) => (p.x - mid.x) * normal.x + (p.y - mid.y) * normal.y;
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function centroid(points: Point[]): Point {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  if (Math.abs(area) < 1e-9) return points[0];
  return { x: x / (3 * area), y: y / (3 * area) };
}

/**
 * The pack cut into `count` irregular shards (a Voronoi diagram of random points, more of them near the impact, so
 * the pieces are small where it was struck and bigger at the edges). Together they cover the whole pack.
 */
export function shatter(random: Random, count: number): ShardShape[] {
  const seeds: Point[] = [];
  while (seeds.length < count) {
    const r = Math.pow(random(), 1.4) * 70;
    const a = random() * Math.PI * 2;
    const p = { x: IMPACT.x + Math.cos(a) * r, y: IMPACT.y + Math.sin(a) * r };
    if (inside(p)) seeds.push(p);
  }
  const box: Point[] = [
    { x: 0, y: 0 },
    { x: PACK_W, y: 0 },
    { x: PACK_W, y: PACK_H },
    { x: 0, y: PACK_H },
  ];
  return seeds
    .map((seed, i) => {
      let cell = box;
      for (let j = 0; j < seeds.length && cell.length; j++) {
        if (j === i) continue;
        const other = seeds[j];
        cell = clip(cell, { x: (seed.x + other.x) / 2, y: (seed.y + other.y) / 2 }, { x: other.x - seed.x, y: other.y - seed.y });
      }
      return cell;
    })
    .filter((cell) => cell.length >= 3)
    .map((points) => ({ points, center: centroid(points) }));
}

/** The area of a polygon (for the tests: the shards cover the pack). */
export function area(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
