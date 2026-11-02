import { describe, expect, it } from 'vitest';
import { fitItemWidth } from './fit-grid';

describe('fitItemWidth', () => {
  it('makes a single item as big as the box allows, up to the maximum', () => {
    // 1000 × 700, ratio 0.5: the height limits it to 350
    expect(fitItemWidth(1, 1000, 700, 0.5, 10, 1000)).toBe(350);
    expect(fitItemWidth(1, 1000, 700, 0.5, 10, 200)).toBe(200);
  });

  it('fits every item without scrolling, choosing the best number of columns', () => {
    const w = fitItemWidth(24, 1200, 600, 63 / 88, 12, 400);
    const columns = Math.floor((1200 + 12) / (w + 12));
    const rows = Math.ceil(24 / columns);
    expect(rows * (w / (63 / 88)) + (rows - 1) * 12).toBeLessThanOrEqual(600);
    expect(w).toBeGreaterThan(80);
  });

  it('is 0 without items or room', () => {
    expect(fitItemWidth(0, 1000, 700, 0.5, 10, 300)).toBe(0);
    expect(fitItemWidth(5, 0, 700, 0.5, 10, 300)).toBe(0);
  });
});
