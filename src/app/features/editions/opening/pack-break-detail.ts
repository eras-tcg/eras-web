import { PackTier } from '@data/editions/booster-rules';

/**
 * How much a pack's break shows, by the pack's type (its timing is the same for all): a plain pack breaks simply, an
 * SR one with more, an SEC one in full and a GOD one beyond it. PackBreakComponent reads it: the cracks, the pieces
 * on the canvas and, by the tier's class, the light (the rays, the shock wave, the jolt).
 */
export interface BreakDetail {
  /** Main cracks from the impact, and whether they branch. */
  cracks: number;
  branches: boolean;
  /** Shards, flecks of foil and streaks of light in the burst. */
  shards: number;
  debris: number;
  sparks: number;
}

export const BREAK_DETAIL: Record<PackTier, BreakDetail> = {
  none: { cracks: 4, branches: false, shards: 10, debris: 18, sparks: 12 },
  sr: { cracks: 5, branches: true, shards: 14, debris: 34, sparks: 20 },
  sec: { cracks: 6, branches: true, shards: 20, debris: 56, sparks: 28 },
  god: { cracks: 7, branches: true, shards: 26, debris: 84, sparks: 40 },
};
