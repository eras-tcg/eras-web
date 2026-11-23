import { FRAME, frameHalves } from './modal-frame';

describe('frameHalves', () => {
  it('runs each half from the top gem to the bottom gem, one the mirror of the other', () => {
    const { right, left } = frameHalves(400, 300);
    expect(right.startsWith(`M200 ${FRAME.notchDepth} L`)).toBe(true);
    expect(right.endsWith(`L200 ${300 - FRAME.notchDepth}`)).toBe(true);
    // The right half goes through the bevelled top-right corner, the left one through the top-left
    expect(right).toContain(`L${400 - FRAME.corner} 0 L400 ${FRAME.corner}`);
    expect(left).toContain(`L${FRAME.corner} 0 L0 ${FRAME.corner}`);
  });

  it('rounds to tenths', () => {
    expect(frameHalves(333.333, 100).right).toContain('166.7');
  });
});
