import { WritableSignal } from '@angular/core';

/** How long the left button must be held anywhere to look through the panels. */
const LONG_PRESS_MS = 350;
/** A pointer that moves more than this is dragging, not pressing. */
const PRESS_SLOP_PX = 6;
/** The class of the card of the hand under the pointer while looking through (it rises like one hovered). */
export const HAND_PEEK_CLASS = 'see-through-peek';

export interface SeeThroughPress {
  /** There is something over the table to look through (a sheet from the bottom, a chain). */
  canSeeThrough: () => boolean;
  /** A sheet is open at the bottom. */
  sheetOpen: () => boolean;
  /** A choice is lowered to look at the table. */
  lookOnly: () => boolean;
  /** Looking through the panels, while it is held. */
  seeThrough: WritableSignal<boolean>;
  /** A drag ended (the browser sends no pointerup after one). */
  dragEnded: () => void;
}

/**
 * A long press on the table (left button, not on the panels) looks through the panels while it is held; moving
 * cancels it (a drag). With a choice open (expanded), pressing outside it (its backdrop) looks through at once, and
 * the click that ends it does not close the choice. Returns the cleanup.
 */
export function seeThroughPress(win: Window, o: SeeThroughPress): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  // The click that ends looking through the backdrop must not close the choice
  let swallowClick = false;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !o.canSeeThrough()) return;
    const target = e.target as Element | null;
    // Only a choice's own backdrop: a modal's (a card's detail opened over the choice) closes the modal as usual
    if (target?.classList.contains('eras-sheet-backdrop') && o.sheetOpen() && !o.lookOnly()) {
      cancel();
      o.seeThrough.set(true);
      return;
    }
    // Not over the panels themselves (a choice, the chain): a long press there is choosing, not looking
    if (target?.closest('.cdk-overlay-container, .cdk-overlay-popover, .cdk-overlay-backdrop, .chain-panel, .eras-prompt-spotlight')) return;
    cancel();
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = null;
      o.seeThrough.set(true);
    }, LONG_PRESS_MS);
  };
  // While looking through, the panels' backdrop is still over the table and takes the pointer: the card of your hand
  // under it (that one alone) rises as it would under the pointer, to read its level and name
  let peeked: Element | null = null;
  const peek = (card: Element | null) => {
    if (card === peeked) return;
    peeked?.classList.remove(HAND_PEEK_CLASS);
    peeked = card;
    peeked?.classList.add(HAND_PEEK_CLASS);
  };
  const move = (e: PointerEvent) => {
    if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP_PX) cancel();
    if (!o.seeThrough()) return peek(null);
    const under = win.document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.matches('.in-hand'));
    peek(under ?? null);
  };
  const up = () => {
    cancel();
    peek(null);
    if (o.seeThrough()) swallowClick = true;
    o.seeThrough.set(false);
  };
  const click = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  };
  // A press that did not end in a click (released elsewhere) must not swallow the next one
  const clearSwallow = () => setTimeout(() => (swallowClick = false));
  // A drag is not a long press, and after one the browser sends no pointerup: a drag ends whatever was held
  const dragged = () => {
    up();
    o.dragEnded();
  };
  win.addEventListener('pointerdown', down, true);
  win.addEventListener('pointermove', move, true);
  win.addEventListener('pointerup', up, true);
  win.addEventListener('pointerup', clearSwallow);
  win.addEventListener('click', click, true);
  win.addEventListener('pointercancel', up, true);
  win.addEventListener('blur', up);
  win.addEventListener('dragstart', cancel, true);
  win.addEventListener('dragend', dragged, true);
  win.addEventListener('drop', dragged);
  return () => {
    cancel();
    peek(null);
    o.seeThrough.set(false);
    win.removeEventListener('pointerdown', down, true);
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', up, true);
    win.removeEventListener('pointerup', clearSwallow);
    win.removeEventListener('click', click, true);
    win.removeEventListener('pointercancel', up, true);
    win.removeEventListener('blur', up);
    win.removeEventListener('dragstart', cancel, true);
    win.removeEventListener('dragend', dragged, true);
    win.removeEventListener('drop', dragged);
  };
}
