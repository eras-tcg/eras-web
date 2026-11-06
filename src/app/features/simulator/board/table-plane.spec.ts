import { PlaneMatrix, projection } from './table-plane';

/** perspective(d) rotateX(deg), as the browser composes it, for points of the plane (z = 0). */
function leaning(d: number, deg: number): PlaneMatrix {
  const a = (deg * Math.PI) / 180;
  return { m11: 1, m12: 0, m14: 0, m21: 0, m22: Math.cos(a), m24: -Math.sin(a) / d, m41: 0, m42: 0, m44: 1 };
}
const IDENTITY: PlaneMatrix = { m11: 1, m12: 0, m14: 0, m21: 0, m22: 1, m24: 0, m41: 0, m42: 0, m44: 1 };

describe('the leaning table', () => {
  // As the board leans it: perspective at 2.2 table heights, 18 degrees back, about the bottom middle of a 1000×800 plane
  const height = 800;
  const matrix = leaning(2.2 * height, 18);
  const p = projection(matrix, { x: 500, y: 800 }, { left: 40, top: 60 })!;

  it('a point of the plane drawn on the screen goes back to the same point', () => {
    for (const [x, y] of [[0, 0], [500, 400], [930, 120], [250, 790]]) {
      const screen = p.toScreen(x, y);
      const back = p.toLocal(screen.x, screen.y);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it('the far edge is drawn narrower and lower than flat: the plane leans back', () => {
    const left = p.toScreen(0, 0);
    const right = p.toScreen(1000, 0);
    expect(right.x - left.x).toBeLessThan(1000);
    expect(left.y).toBeGreaterThan(60);
    // The edge it leans on stays where it was
    const hinge = p.toScreen(0, 800);
    expect(hinge.x).toBeCloseTo(40, 6);
    expect(hinge.y).toBeCloseTo(860, 6);
  });

  it('a flat table changes nothing', () => {
    const flat = projection(IDENTITY, { x: 500, y: 800 }, { left: 40, top: 60 })!;
    expect(flat.toLocal(140, 160)).toEqual({ x: 100, y: 100 });
  });
});
