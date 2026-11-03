import { describe, expect, it } from 'vitest';
import { BoardDrag } from './board-drag';

/** An element whose box on screen is the given one. */
const boxed = (tag: string, box: { left: number; top: number; width: number; height: number }, className = ''): HTMLElement => {
  const el = document.createElement(tag);
  el.className = className;
  el.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => box }) as DOMRect;
  return el;
};

const dropAt = (target: Element, clientX: number, clientY: number) => ({ target, clientX, clientY }) as unknown as DragEvent;

describe('BoardDrag.position', () => {
  const drag = new BoardDrag();

  it('takes the line under the pointer, not the half of the field box (the leaning table)', () => {
    const field = boxed('div', { left: 0, top: 0, width: 200, height: 100 });
    const front = boxed('div', { left: 20, top: 0, width: 160, height: 40 }, 'line front');
    const back = boxed('div', { left: 0, top: 40, width: 200, height: 60 }, 'line');
    field.append(front, back);
    // In the field box's upper half, but on the Retaguardia
    expect(drag.position(dropAt(back, 100, 45), field)).toEqual({ x: 50, y: 75 });
    expect(drag.position(dropAt(front, 60, 20), field)).toEqual({ x: 25, y: 25 });
  });

  it('a line is the owner\'s even on the rival\'s (mirrored) side', () => {
    const field = boxed('div', { left: 0, top: 0, width: 200, height: 100 });
    const front = boxed('div', { left: 0, top: 50, width: 200, height: 50 }, 'line front');
    field.append(front);
    expect(drag.position(dropAt(front, 100, 90), field, true).y).toBe(25);
  });

  it('outside the lines, from the field box', () => {
    const field = boxed('div', { left: 0, top: 0, width: 200, height: 100 });
    expect(drag.position(dropAt(field, 50, 80), field)).toEqual({ x: 25, y: 80 });
    expect(drag.position(dropAt(field, 50, 80), field, true)).toEqual({ x: 25, y: 20 });
  });
});
