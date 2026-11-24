import { FRAME, frameHalves } from './card-back-frame-shape';

describe('frameHalves', () => {
  it('runs each half from the top gem to the bottom gem, one the mirror of the other', () => {
    const { right, left } = frameHalves(400, 300);
    expect(right.startsWith(`M200 ${FRAME.notchDepth} L`)).toBe(true);
    expect(right.endsWith(`L200 ${300 - FRAME.notchDepth}`)).toBe(true);
    // The right half goes through the bevelled top-right corner, the left one through the top-left
    expect(right).toContain(`L${400 - FRAME.corner} 0 L400 ${FRAME.corner}`);
    expect(left).toContain(`L${FRAME.corner} 0 L0 ${FRAME.corner}`);
  });

  it('leaves out the notches it does not have', () => {
    const top = frameHalves(400, 300, 'top');
    expect(top.right.startsWith(`M200 ${FRAME.notchDepth} L`)).toBe(true);
    expect(top.right.endsWith(`L${400 - FRAME.corner} 300 L200 300`)).toBe(true);
    const none = frameHalves(400, 300, 'none');
    expect(none.right.startsWith(`M200 0 L${400 - FRAME.corner} 0`)).toBe(true);
    expect(none.right.endsWith('L200 300')).toBe(true);
  });

  it('rounds to tenths', () => {
    expect(frameHalves(333.333, 100).right).toContain('166.7');
  });
});
