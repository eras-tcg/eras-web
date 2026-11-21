/** Pixels a press moves before it counts as a drag (less is a tap). */
export const DRAG_START = 6;

/** How far a held card turns, each way, in degrees. */
export const MAX_TILT = 35;

/** A card's turn: around its horizontal axis (`rx`, top away when positive) and its vertical one (`ry`). */
export interface Tilt {
  rx: number;
  ry: number;
}

const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));

/**
 * The turn of a card dragged from where it was grabbed: half its width across turns it 45°, as if pushing its side
 * (right turns its right side away, up turns its top away), never past MAX_TILT.
 */
export function tiltFromDrag(start: Tilt, dx: number, dy: number, width: number, height: number): Tilt {
  const perPx = 90 / Math.max(1, width);
  const perPy = 90 / Math.max(1, height);
  return {
    rx: clamp(start.rx + dy * perPy * -1, MAX_TILT) || 0,
    ry: clamp(start.ry + dx * perPx, MAX_TILT) || 0,
  };
}

/** The light on a turned card (positions in % of the card, strengths 0–1). */
export interface CardLight {
  /** Where the lamp's glare hits. */
  x: number;
  y: number;
  glare: number;
  /** How dark the side turned away gets. */
  shade: number;
  /** The glossy coat's reflection: a band of light that crosses the card as it turns (background position). */
  glossX: number;
  glossY: number;
  gloss: number;
}

/**
 * The light on a turned card, from a lamp above and in front: the glare moves against the turn, stronger the more it
 * turns; the side turned away darkens; the glossy coat's band of light slides across with the turn (a flat card
 * shows it faintly, in the middle).
 */
export function lightOf(tilt: Tilt): CardLight {
  const amount = Math.min(1, Math.hypot(tilt.rx, tilt.ry) / MAX_TILT);
  return {
    x: 50 - (tilt.ry / MAX_TILT) * 50,
    y: 50 - (tilt.rx / MAX_TILT) * 50,
    glare: 0.2 + 0.6 * amount,
    shade: 0.55 * amount,
    glossX: 50 + (tilt.ry / MAX_TILT) * 50,
    glossY: 50 - (tilt.rx / MAX_TILT) * 50,
    gloss: 0.25 + 0.6 * amount,
  };
}

/** How thick the card looks, in pixels, and in how many sheets it is drawn. */
export const EDGE_DEPTH = 5;
export const EDGE_SHEETS = 8;

/**
 * The sheets that give the card its thickness, behind its face (z in px, negative), each with how lit it is (0–1): the
 * middle ones lighter and the outer ones darker, so the edge looks slightly rounded.
 */
export function cardEdge(depth = EDGE_DEPTH, sheets = EDGE_SHEETS): { z: number; lit: number }[] {
  return Array.from({ length: sheets }, (_, i) => {
    const t = (i + 1) / sheets;
    return { z: -Math.round(t * depth * 100) / 100, lit: Math.round(Math.sin(t * Math.PI) * 100) / 100 };
  });
}
