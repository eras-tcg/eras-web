/**
 * How a destroyed card breaks, in its own units (a 63 × 88 card): where it is struck, the pieces it splits into
 * (wedges from the point of impact to its edges, between the cracks) and the cracks themselves (jagged lines along the
 * pieces' edges, with a branch each). The same card always breaks the same way (the shape follows its id).
 */
export interface ShatterShape {
  impact: Point;
  /** Each piece's outline (to clip the card's picture to it) and the direction it is pushed away. */
  pieces: { outline: Point[]; push: Point }[];
  /** Each crack as a polyline, from the impact outwards; branches start on a crack. */
  cracks: Point[][];
}

export interface Point {
  x: number;
  y: number;
}

export const CARD_W = 63;
export const CARD_H = 88;

/** A repeatable random sequence from a text (the card's id): 0–1. */
export function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a ray from `from` at `angle` (radians) leaves the card. */
export function edgePoint(from: Point, angle: number): Point {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ts = [
    dx > 0 ? (CARD_W - from.x) / dx : dx < 0 ? -from.x / dx : Infinity,
    dy > 0 ? (CARD_H - from.y) / dy : dy < 0 ? -from.y / dy : Infinity,
  ];
  const t = Math.min(...ts);
  return { x: clamp(from.x + dx * t, 0, CARD_W), y: clamp(from.y + dy * t, 0, CARD_H) };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
/** An angle brought into 0–2π. */
const norm = (a: number) => ((a % TAU) + TAU) % TAU;

export function shatterShape(id: string): ShatterShape {
  const rnd = seeded(id || 'card');
  const impact = { x: CARD_W * (0.4 + rnd() * 0.2), y: CARD_H * (0.35 + rnd() * 0.2) };
  const count = 6 + Math.floor(rnd() * 2);
  const start = rnd() * TAU;
  const angles = Array.from({ length: count }, (_, i) => norm(start + (i / count) * TAU + (rnd() - 0.5) * (TAU / count) * 0.5)).sort((a, b) => a - b);
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: CARD_W, y: 0 },
    { x: CARD_W, y: CARD_H },
    { x: 0, y: CARD_H },
  ];
  const cornerAngles = corners.map((c) => ({ c, a: norm(Math.atan2(c.y - impact.y, c.x - impact.x)) }));
  const pieces = angles.map((a, i) => {
    const b = i === count - 1 ? angles[0] + TAU : angles[i + 1];
    const inside = cornerAngles
      .map(({ c, a: ca }) => ({ c, a: ca < a ? ca + TAU : ca }))
      .filter(({ a: ca }) => ca > a && ca < b)
      .sort((p, q) => p.a - q.a)
      .map(({ c }) => c);
    const mid = (a + b) / 2;
    return {
      outline: [impact, edgePoint(impact, a), ...inside, edgePoint(impact, b)],
      push: { x: Math.cos(mid), y: Math.sin(mid) },
    };
  });
  const cracks: Point[][] = [];
  for (const a of angles) {
    const end = edgePoint(impact, a);
    const steps = 4;
    const line: Point[] = [impact];
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const off = (rnd() - 0.5) * 3.2;
      line.push({ x: impact.x + (end.x - impact.x) * t - Math.sin(a) * off, y: impact.y + (end.y - impact.y) * t + Math.cos(a) * off });
    }
    line.push(end);
    cracks.push(line);
    // A branch off the crack's middle, a little to one side
    const from = line[1 + Math.floor(rnd() * 2)];
    const ba = a + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.35);
    const len = 8 + rnd() * 10;
    const tip = { x: clamp(from.x + Math.cos(ba) * len, 0, CARD_W), y: clamp(from.y + Math.sin(ba) * len, 0, CARD_H) };
    cracks.push([from, { x: (from.x + tip.x) / 2 + (rnd() - 0.5) * 2, y: (from.y + tip.y) / 2 + (rnd() - 0.5) * 2 }, tip]);
  }
  return { impact, pieces, cracks };
}
