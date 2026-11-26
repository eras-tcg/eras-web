import { HOLD_PEEK_MS, holdToPeek } from './hold-peek';

/** A pointer event as the browser sends it (jsdom may lack PointerEvent: a MouseEvent with its fields). */
function pointer(type: string, x: number, y: number, pointerType = 'mouse'): Event {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
}

/** A drag event with its position (jsdom may lack DragEvent). */
function dragEvent(type: string, x: number, y: number): Event {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
}

/** The system's long press on a touch screen: its menu. */
function systemMenu(): Event {
  return new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
}

describe('hold to peek', () => {
  let box: HTMLElement;
  let peeks: number;
  let taps: number;
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    box = document.createElement('div');
    document.body.appendChild(box);
    peeks = 0;
    taps = 0;
    box.addEventListener('click', () => taps++);
    cleanup = holdToPeek(box, () => true, () => peeks++);
  });

  afterEach(() => {
    cleanup();
    box.remove();
    vi.useRealTimers();
  });

  it('opens the card when held still, and the release is not a tap', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    vi.advanceTimersByTime(HOLD_PEEK_MS);
    window.dispatchEvent(pointer('pointerup', 10, 10));
    box.dispatchEvent(pointer('click', 10, 10));
    expect(peeks).toBe(1);
    expect(taps).toBe(0);
  });

  it('lets a quick tap through', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    window.dispatchEvent(pointer('pointerup', 11, 10));
    box.dispatchEvent(pointer('click', 11, 10));
    expect(peeks).toBe(0);
    expect(taps).toBe(1);
  });

  it('takes a drag for neither a hold nor a tap, even when the box is left behind', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    // The drag hides the box: the pointer moves over the window, not over it
    window.dispatchEvent(pointer('pointermove', 60, 10));
    vi.advanceTimersByTime(HOLD_PEEK_MS * 2);
    window.dispatchEvent(pointer('pointerup', 60, 10));
    box.dispatchEvent(pointer('click', 60, 10));
    expect(peeks).toBe(0);
    expect(taps).toBe(0);
    // The next tap is a tap again
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    window.dispatchEvent(pointer('pointerup', 10, 10));
    box.dispatchEvent(pointer('click', 10, 10));
    expect(taps).toBe(1);
  });

  it('still opens when the browser begins dragging the card after a tremble of a few pixels', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    window.dispatchEvent(pointer('pointermove', 14, 12));
    // The browser's drag takes the pointer: no more pointer events, only the drag's
    box.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
    window.dispatchEvent(pointer('pointercancel', 14, 12));
    window.dispatchEvent(dragEvent('dragover', 15, 12));
    vi.advanceTimersByTime(HOLD_PEEK_MS);
    expect(peeks).toBe(1);
    window.dispatchEvent(dragEvent('dragend', 0, 0));
  });

  it('takes a drag of the browser that moves away for a drag', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    box.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
    window.dispatchEvent(pointer('pointercancel', 14, 10));
    window.dispatchEvent(dragEvent('dragover', 80, 10));
    vi.advanceTimersByTime(HOLD_PEEK_MS * 2);
    window.dispatchEvent(dragEvent('dragend', 0, 0));
    expect(peeks).toBe(0);
  });

  it('opens at once on the system long press of a touch screen, without its menu', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10, 'touch'));
    vi.advanceTimersByTime(300);
    const menu = systemMenu();
    box.dispatchEvent(menu);
    expect(peeks).toBe(1);
    expect(menu.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(HOLD_PEEK_MS);
    expect(peeks).toBe(1);
  });

  it('ends the hold when the browser takes a touch (a scroll)', () => {
    box.dispatchEvent(pointer('pointerdown', 10, 10, 'touch'));
    window.dispatchEvent(pointer('pointercancel', 10, 10, 'touch'));
    vi.advanceTimersByTime(HOLD_PEEK_MS * 2);
    expect(peeks).toBe(0);
  });

  it('does not open a card held while disabled', () => {
    cleanup();
    cleanup = holdToPeek(box, () => false, () => peeks++);
    box.dispatchEvent(pointer('pointerdown', 10, 10));
    box.dispatchEvent(systemMenu());
    vi.advanceTimersByTime(HOLD_PEEK_MS * 2);
    expect(peeks).toBe(0);
  });

  it('swallows the release click of a peek wherever it lands (the detail opened under the finger)', () => {
    const detail = document.createElement('div');
    document.body.appendChild(detail);
    let closed = 0;
    detail.addEventListener('click', () => closed++);
    box.dispatchEvent(pointer('pointerdown', 10, 10, 'touch'));
    vi.advanceTimersByTime(HOLD_PEEK_MS);
    window.dispatchEvent(pointer('pointerup', 10, 10, 'touch'));
    detail.dispatchEvent(pointer('click', 10, 10));
    expect(peeks).toBe(1);
    expect(closed).toBe(0);
    // Only that click: the next one is the player's
    detail.dispatchEvent(pointer('click', 10, 10));
    expect(closed).toBe(1);
    detail.remove();
  });
});
