import { signal } from '@angular/core';
import { HAND_PEEK_CLASS, seeThroughPress } from './board-see-through';

describe('seeThroughPress', () => {
  function setup() {
    const seeThrough = signal(false);
    const stop = seeThroughPress(window, {
      canSeeThrough: () => true,
      sheetOpen: () => true,
      lookOnly: () => false,
      seeThrough,
      dragEnded: () => undefined,
    });
    return { seeThrough, stop };
  }

  function backdrop(kind: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `cdk-overlay-backdrop ${kind}`;
    document.body.appendChild(el);
    return el;
  }

  it('looks through at once when the choice\'s backdrop is pressed, and keeps the click from closing it', () => {
    const { seeThrough, stop } = setup();
    const el = backdrop('eras-sheet-backdrop');
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    expect(seeThrough()).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    stop();
    el.remove();
  });

  it('leaves a modal\'s backdrop alone: its click closes the modal (a card\'s detail over a choice)', () => {
    const { seeThrough, stop } = setup();
    const el = backdrop('eras-backdrop');
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    expect(seeThrough()).toBe(false);
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    stop();
    el.remove();
  });

  it('raises only the card of the hand under the pointer while looking through', () => {
    const { stop } = setup();
    const cards = [0, 1, 2].map(() => {
      const c = document.createElement('div');
      c.className = 'in-hand';
      document.body.appendChild(c);
      return c;
    });
    const el = backdrop('eras-sheet-backdrop');
    el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    // jsdom has no layout: the elements under the pointer are given
    const doc = document as Document & { elementsFromPoint: (x: number, y: number) => Element[] };
    const before = doc.elementsFromPoint;
    doc.elementsFromPoint = () => [el, cards[1]];
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10, bubbles: true }));
    expect(cards.map((c) => c.classList.contains(HAND_PEEK_CLASS))).toEqual([false, true, false]);
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(cards.some((c) => c.classList.contains(HAND_PEEK_CLASS))).toBe(false);
    doc.elementsFromPoint = before;
    stop();
    el.remove();
    cards.forEach((c) => c.remove());
  });
});
