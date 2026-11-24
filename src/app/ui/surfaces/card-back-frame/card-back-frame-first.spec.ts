import { describe, expect, it } from 'vitest';
import { firstFrameOn } from './card-back-frame.component';

describe('firstFrameOn', () => {
  it('traces only the first frame of each page, again after moving to another page', () => {
    expect(firstFrameOn('/spec-a')).toBe(true);
    expect(firstFrameOn('/spec-a')).toBe(false);
    expect(firstFrameOn('/spec-b')).toBe(true);
    expect(firstFrameOn('/spec-a')).toBe(true);
  });
});
