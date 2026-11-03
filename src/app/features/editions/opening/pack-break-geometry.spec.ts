import { describe, expect, it } from 'vitest';
import { PACK_H, PACK_W, area, crackStages, seeded, shatter } from './pack-break-geometry';

describe('pack break geometry', () => {
  it('cuts the pack into irregular shards that cover it whole', () => {
    const shards = shatter(seeded(7), 18);
    expect(shards).toHaveLength(18);
    const covered = shards.reduce((sum, s) => sum + area(s.points), 0);
    expect(covered).toBeCloseTo(PACK_W * PACK_H, 3);
    for (const s of shards) {
      expect(s.points.length).toBeGreaterThanOrEqual(3);
      expect(s.center.x).toBeGreaterThanOrEqual(0);
      expect(s.center.x).toBeLessThanOrEqual(PACK_W);
    }
  });

  it('draws different shards and cracks for every pack', () => {
    expect(shatter(seeded(1), 12)[0].points).not.toEqual(shatter(seeded(2), 12)[0].points);
    expect(crackStages(seeded(1))).not.toEqual(crackStages(seeded(2)));
  });

  it('opens the cracks in three stages, each with lines of its own', () => {
    const stages = crackStages(seeded(3));
    expect(stages).toHaveLength(3);
    for (const stage of stages) for (const d of stage) expect(d).toMatch(/^M[\d.-]+ [\d.-]+ L/);
    // Every blow adds more: the later stages hold more lines (branches)
    const lines = stages.map((stage) => stage.length);
    expect(lines[1]).toBeGreaterThan(lines[0]);
    expect(lines[2]).toBeGreaterThan(lines[0]);
  });

  it('draws simpler cracks for a plain pack: fewer, never branching', () => {
    const plain = crackStages(seeded(3), 4, false);
    expect(plain.map((stage) => stage.length)).toEqual([4, 4, 4]);
    expect(crackStages(seeded(3), 7, true)[2].length).toBeGreaterThan(7);
  });
});
