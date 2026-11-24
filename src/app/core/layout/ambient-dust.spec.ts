import { MOTE_GONE, moteCount, moteOpacity, spawnMote, stepMote } from './ambient-dust';

const fixed = (value: number) => () => value;

describe('ambient dust', () => {
  it('puts fewer motes on small screens, never more than 90', () => {
    expect(moteCount(375, 812)).toBe(19);
    expect(moteCount(3840, 2160)).toBe(90);
  });

  it('brings new motes in from the edge, faded out, and the first ones anywhere, already shown', () => {
    const edge = spawnMote(1000, false, fixed(0.5));
    expect(edge.radius).toBeGreaterThanOrEqual(800);
    expect(edge.age).toBe(0);
    expect(spawnMote(1000, true, fixed(0.5)).age).toBe(1);
    // About a third are gold pentagons
    expect(spawnMote(1000, true, fixed(0.2)).gem).toBe(true);
    expect(spawnMote(1000, true, fixed(0.6)).gem).toBe(false);
  });

  it('spirals in, faster near the centre, until it is gone', () => {
    const far = spawnMote(1000, true, fixed(0.9));
    const near = { ...far, radius: 60 };
    const farBefore = far.radius;
    stepMote(far, 0.1);
    stepMote(near, 0.1);
    expect(farBefore - far.radius).toBeLessThan(60 - near.radius);
    expect(far.angle).toBeLessThan(spawnMote(1000, true, fixed(0.9)).angle);
    const last = { ...far, radius: MOTE_GONE + 1 };
    expect(stepMote(last, 1)).toBe(false);
  });

  it('fades out as it reaches the centre', () => {
    const mote = { ...spawnMote(1000, true, fixed(0.5)), twinkle: Math.PI / 2 };
    expect(moteOpacity({ ...mote, radius: 500 })).toBeCloseTo(mote.alpha);
    expect(moteOpacity({ ...mote, radius: MOTE_GONE })).toBe(0);
  });
});
