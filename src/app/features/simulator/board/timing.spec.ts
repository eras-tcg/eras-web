import { ANIMATION_PACES, TIMING, setAnimationPace, summonTiming, timingVars } from './timing';

describe('animation pace', () => {
  afterEach(() => setAnimationPace(1));

  it('scales every duration by the player speed', () => {
    const normal = TIMING.shatter;
    setAnimationPace(0.5);
    expect(TIMING.shatter).toBe(normal * 0.5);
    expect(summonTiming(1).duration).toBe((TIMING.summon + TIMING.summonHangStrong));
  });

  it('gives the styles the durations at that speed, and the factor', () => {
    const vars = timingVars(2);
    expect(vars['--sim-pace']).toBe('2');
    setAnimationPace(1);
    expect(vars['--sim-tap-turn']).toBe(`${TIMING.tapTurn * 2}ms`);
  });

  it('has normal in the middle of its steps', () => {
    expect(ANIMATION_PACES[2]).toBe(1);
  });
});
