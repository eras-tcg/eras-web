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

/**
 * Holding `box` pressed for HOLD_PEEK_MS calls `peek` (while `enabled()`); moving away, letting go or leaving cancels
 * it. After a peek the click of the release is swallowed. Returns the cleanup.
 */
export function holdToPeek(box: HTMLElement, enabled: () => boolean, peek: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let peeked = false;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
  };
  const down = (e: PointerEvent) => {
    cancel();
    peeked = false;
    if ((e.pointerType === 'mouse' && e.button !== 0) || !enabled()) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = null;
      start = null;
      peeked = true;
      peek();
    }, HOLD_PEEK_MS);
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > HOLD_SLOP_PX) cancel();
  };
  const click = (e: MouseEvent) => {
    if (!peeked) return;
    peeked = false;
    e.stopPropagation();
    e.preventDefault();
  };
  // A long press on a touch screen would also open the browser's menu over the card
  const menu = (e: MouseEvent) => {
    if (peeked || timer) e.preventDefault();
  };
  box.addEventListener('pointerdown', down);
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', cancel);
  box.addEventListener('pointercancel', cancel);
  box.addEventListener('pointerleave', cancel);
  box.addEventListener('dragstart', cancel);
  box.addEventListener('click', click, true);
  box.addEventListener('contextmenu', menu);
  return () => {
    cancel();
    box.removeEventListener('pointerdown', down);
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', cancel);
    box.removeEventListener('pointercancel', cancel);
    box.removeEventListener('pointerleave', cancel);
    box.removeEventListener('dragstart', cancel);
    box.removeEventListener('click', click, true);
    box.removeEventListener('contextmenu', menu);
  };
}
