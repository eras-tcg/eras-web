import { WritableSignal } from '@angular/core';

/** How long the left button must be held anywhere to look through the panels. */
const LONG_PRESS_MS = 350;
/** A pointer that moves more than this is dragging, not pressing. */
const PRESS_SLOP_PX = 6;

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
    if (target?.classList.contains('cdk-overlay-backdrop') && o.sheetOpen() && !o.lookOnly()) {
      cancel();
      o.seeThrough.set(true);
      return;
    }
    // Not over the panels themselves (a choice, the chain): a long press there is choosing, not looking
    if (target?.closest('.cdk-overlay-container, .chain-panel, .eras-prompt-spotlight')) return;
    cancel();
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = null;
      o.seeThrough.set(true);
    }, LONG_PRESS_MS);
  };
  const move = (e: PointerEvent) => {
    if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > PRESS_SLOP_PX) cancel();
  };
  const up = () => {
    cancel();
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
