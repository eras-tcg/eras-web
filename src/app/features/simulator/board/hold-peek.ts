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
    inject(DestroyRef).onDestroy(holdToPeek(element, () => this.erasHoldPeek() !== false, () => this.peek.emit()));
  }
}

/** After a drag ends, the click its release may send is not a tap for this long. */
const DRAG_CLICK_MS = 400;

/**
 * Holding `box` pressed for HOLD_PEEK_MS calls `peek` (while `enabled()`); moving away, letting go or leaving cancels
 * it. After a peek the click of the release is swallowed, and so is the one after a drag (the pointer moved more than
 * HOLD_SLOP_PX between pressing and letting go, or the browser began dragging): dragging a card never taps it. The
 * pointer is followed over the whole window while pressed, since a drag may hide or move the box under it. Returns the
 * cleanup.
 */
export function holdToPeek(box: HTMLElement, enabled: () => boolean, peek: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let peeked = false;
  let dragged = false;
  let swallowUntil = 0;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const stopFollowing = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  const down = (e: PointerEvent) => {
    cancel();
    stopFollowing();
    peeked = false;
    dragged = false;
    // A new press: the click of an earlier drag is no longer coming
    swallowUntil = 0;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (!enabled()) return;
    timer = setTimeout(() => {
      timer = null;
      peeked = true;
      peek();
    }, HOLD_PEEK_MS);
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > HOLD_SLOP_PX) drag();
  };
  const drag = () => {
    cancel();
    dragged = true;
  };
  const up = () => {
    cancel();
    stopFollowing();
    start = null;
    if (dragged) swallowUntil = performance.now() + DRAG_CLICK_MS;
    dragged = false;
  };
  const click = (e: MouseEvent) => {
    const afterDrag = swallowUntil > 0 && performance.now() < swallowUntil;
    if (!peeked && !afterDrag) return;
    peeked = false;
    swallowUntil = 0;
    e.stopPropagation();
    e.preventDefault();
  };
  // A long press on a touch screen would also open the browser's menu over the card
  const menu = (e: MouseEvent) => {
    if (peeked || timer) e.preventDefault();
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointerleave', cancel);
  box.addEventListener('dragstart', drag);
  box.addEventListener('click', click, true);
  box.addEventListener('contextmenu', menu);
  return () => {
    cancel();
    stopFollowing();
    box.removeEventListener('pointerdown', down);
    box.removeEventListener('pointerleave', cancel);
    box.removeEventListener('dragstart', drag);
    box.removeEventListener('click', click, true);
    box.removeEventListener('contextmenu', menu);
  };
}
