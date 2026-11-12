import { HOLD_PEEK_MS, holdToPeek } from './hold-peek';

/** A pointer event as the browser sends it (jsdom may lack PointerEvent: a MouseEvent with its fields). */
function pointer(type: string, x: number, y: number): Event {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  return e;
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
});
