import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/** How long the card is held pressed to open it in detail. */
export const HOLD_PEEK_MS = 450;
/** A pointer that moves more than this is dragging or scrolling, not holding. */
const HOLD_SLOP_PX = 10;

/**
 * Holding the element pressed emits `peek` (a card in detail, where the caller decides how to show it): the gesture of
 * eras-card-peek for a card whose detail is opened its own way.
 */
@Directive({ selector: '[erasHoldPeek]' })
export class HoldPeekDirective {
  /** False: holding does nothing (a face-down card the player may not see). */
  readonly erasHoldPeek = input<boolean | ''>(true);
  readonly peek = output<void>();

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    inject(DestroyRef).onDestroy(
      holdToPeek(element, () => this.erasHoldPeek() !== false, () => this.peek.emit()),
    );
  }
}

/** After a peek or a drag, the click its release may send is not a tap for this long. */
const DRAG_CLICK_MS = 400;

/**
 * Holding `box` pressed for HOLD_PEEK_MS calls `peek` (while `enabled()`); moving more than HOLD_SLOP_PX away or letting
 * go cancels it. It opens as soon as it has been held long enough, without waiting to be let go, so it works the same
 * with a mouse, a finger or a pen, on any browser:
 * - A card that can be dragged: the browser begins its own drag after a few pixels (fewer than HOLD_SLOP_PX, and a
 *   hand on a mouse trembles that much), which ends the pointer events. The hold goes on through that drag while the
 *   pointer stays put (followed with `dragover`, whose position Firefox does report) and still opens the card; moving
 *   further is a drag.
 * - A touch screen: the system's own long press (its menu, `contextmenu`) may come before HOLD_PEEK_MS (Android lets
 *   the player shorten it) and would cancel the touch: it opens the card right then instead of the browser's menu.
 * After a peek the click of the release is swallowed, wherever it lands, and so is the one after a drag (the pointer
 * moved more than HOLD_SLOP_PX between pressing and letting go): dragging a card never taps it. The pointer is followed over the whole
 * window while pressed, since a drag may hide or move the box under it. Returns the cleanup.
 */
export function holdToPeek(box: HTMLElement, enabled: () => boolean, peek: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let peeked = false;
  let dragged = false;
  let swallowing: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  // While pressed: where the pointer goes and how the press ends (a native drag ends with dragend or drop, without
  // pointerup; a mouse the browser took without dragging, with mouseup)
  const followed: [string, EventListener, boolean][] = [
    ['pointermove', (e) => move(e as PointerEvent), false],
    ['dragover', (e) => move(e as DragEvent), true],
    ['pointerup', () => up(), false],
    ['mouseup', () => up(), false],
    ['dragend', () => up(), true],
    ['drop', () => up(), true],
    ['blur', () => up(), false],
    ['pointercancel', (e) => cancelled(e as PointerEvent), false],
  ];
  const follow = (on: boolean) => {
    for (const [type, listener, capture] of followed) {
      if (on) window.addEventListener(type, listener, capture);
      else window.removeEventListener(type, listener, capture);
    }
  };
  const open = () => {
    cancel();
    peeked = true;
    peek();
  };
  const down = (e: PointerEvent) => {
    cancel();
    follow(false);
    peeked = false;
    dragged = false;
    // A new press: the click of the earlier one is no longer coming
    stopSwallowing();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    follow(true);
    if (!enabled()) return;
    timer = setTimeout(open, HOLD_PEEK_MS);
  };
  const move = (e: PointerEvent | DragEvent) => {
    // A drag's last events may come without a position (0, 0 outside the window): not a move
    if (e.type === 'dragover' && !e.clientX && !e.clientY) return;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > HOLD_SLOP_PX) {
      cancel();
      dragged = true;
    }
  };
  const up = () => {
    cancel();
    follow(false);
    start = null;
    if (dragged || peeked) swallowClick();
    dragged = false;
    peeked = false;
  };
  // The browser took the pointer: for its own drag of the card (a mouse or a pen) the hold goes on until that drag
  // ends (dragend) or moves; a touch it took is a scroll or a gesture of the system, which ends the hold
  const cancelled = (e: PointerEvent) => {
    if (e.pointerType === 'touch') up();
  };
  // The click the release sends is not a tap. It is caught over the whole window: after a peek the detail is open
  // under the pointer, and a finger's click lands on it (on its backdrop, which would close it at once)
  const click = (e: MouseEvent) => {
    stopSwallowing();
    e.stopPropagation();
    e.preventDefault();
  };
  const swallowClick = () => {
    stopSwallowing();
    window.addEventListener('click', click, true);
    swallowing = setTimeout(stopSwallowing, DRAG_CLICK_MS);
  };
  const stopSwallowing = () => {
    if (swallowing) clearTimeout(swallowing);
    swallowing = null;
    window.removeEventListener('click', click, true);
  };
  // The system's long press (its menu over the card): the card opens now, without the menu
  const menu = (e: MouseEvent) => {
    if (timer) open();
    if (peeked) e.preventDefault();
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('contextmenu', menu);
  return () => {
    cancel();
    follow(false);
    stopSwallowing();
    box.removeEventListener('pointerdown', down);
    box.removeEventListener('contextmenu', menu);
  };
}
