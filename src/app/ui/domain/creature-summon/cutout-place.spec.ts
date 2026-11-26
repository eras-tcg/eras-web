import { sidesAtEdge } from './cutout-place';

describe('sidesAtEdge', () => {
  it('counts a side cropped within the saved fade as cut by the picture', () => {
    // A 636×768 picture, the figure filling it but for the clear rim the fade left
    expect(sidesAtEdge({ x: 18, y: 18, width: 636, height: 768 }, 600, 732)).toEqual({ left: true, top: true, right: true, bottom: true });
  });

  it('leaves alone the sides that end round the figure', () => {
    expect(sidesAtEdge({ x: 200, y: 40, width: 636, height: 768 }, 200, 728)).toEqual({ left: false, top: true, right: false, bottom: true });
  });
});
