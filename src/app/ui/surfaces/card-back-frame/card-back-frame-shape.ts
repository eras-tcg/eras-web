/**
 * The card back's frame (eras-card-back-frame) around a dialog, as two SVG paths: each half starts at the gem on the
 * top notch and runs down its side to the gem on the bottom notch, so the frame can trace itself outwards from the top
 * gem.
 */
export interface FrameHalves {
  right: string;
  left: string;
}

/**
 * Bevel of the corners, the notch's half-width at the edge and at its floor, and its depth (px); the surface is cut
 * along the same shape in card-back-frame.component.scss (--frame-corner, --frame-notch-*), keep them in step.
 */
export const FRAME = { corner: 14, notchOuter: 58, notchInner: 40, notchDepth: 12 } as const;

/** Which edges have a notch with its gem: both, only the top one, or none (only the bevelled corners). */
export type FrameNotches = 'both' | 'top' | 'none';

export function frameHalves(width: number, height: number, notches: FrameNotches = 'both'): FrameHalves {
  const { corner: c, notchOuter: no, notchInner: ni, notchDepth: d } = FRAME;
  const m = width / 2;
  const w = width;
  const h = height;
  const top: [number, number][] = notches === 'none' ? [[m, 0]] : [[m, d], [m + ni, d], [m + no, 0]];
  const bottom: [number, number][] = notches === 'both' ? [[m + no, h], [m + ni, h - d], [m, h - d]] : [[m, h]];
  // The right half, from the top middle clockwise to the bottom middle; the left one is its mirror
  const points: [number, number][] = [...top, [w - c, 0], [w, c], [w, h - c], [w - c, h], ...bottom];
  const path = (mirror: boolean) => 'M' + points.map(([x, y]) => `${round(mirror ? w - x : x)} ${round(y)}`).join(' L');
  return { right: path(false), left: path(true) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
