/** How long a finger stays on a card or pile to open its menu (a mouse's right click). */
const TOUCH_MENU_MS = 500;
/** A finger that moves more than this is scrolling or dragging, not pressing. */
const TOUCH_SLOP_PX = 10;

/** A touch screen without a mouse (a phone, a tablet): no hover, no right click, no dragging of cards. */
export function isTouchOnly(win: Window | null | undefined): boolean {
  return !!win?.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
}

/**
 * Touch screens: a long press opens the context menu of what is under the finger, as a right click does. Android
 * sends its own `contextmenu` for it and iPhone does not, so one is made here; whichever comes first wins and the
 * other is dropped. The click the release sends afterwards is swallowed. Only while `enabled()`.
 * Returns the cleanup.
 */
export function touchContextMenu(win: Window, enabled: () => boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let press: { x: number; y: number; target: EventTarget | null } | null = null;
  let opened = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const down = (e: PointerEvent) => {
    cancel();
    opened = false;
    press = null;
    if (e.pointerType !== 'touch' || !enabled()) return;
    press = { x: e.clientX, y: e.clientY, target: e.target };
    timer = setTimeout(() => {
      timer = null;
      if (!press || opened) return;
      opened = true;
      press.target?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: press.x, clientY: press.y, button: 2 }),
      );
    }, TOUCH_MENU_MS);
  };
  const move = (e: PointerEvent) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TOUCH_SLOP_PX) {
      cancel();
      press = null;
    }
  };
  const up = () => {
    cancel();
    press = null;
  };
  // The browser's own long-press menu: the first one opens, a second one (after ours) is dropped
  const native = (e: MouseEvent) => {
    if (!e.isTrusted || (!press && !opened)) return;
    if (opened) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    cancel();
    opened = true;
  };
  const click = (e: MouseEvent) => {
    if (!opened) return;
    opened = false;
    e.stopPropagation();
    e.preventDefault();
  };

  win.addEventListener('pointerdown', down, true);
  win.addEventListener('pointermove', move, true);
  win.addEventListener('pointerup', up, true);
  win.addEventListener('pointercancel', up, true);
  win.addEventListener('contextmenu', native, true);
  win.addEventListener('click', click, true);
  return () => {
    cancel();
    win.removeEventListener('pointerdown', down, true);
    win.removeEventListener('pointermove', move, true);
    win.removeEventListener('pointerup', up, true);
    win.removeEventListener('pointercancel', up, true);
    win.removeEventListener('contextmenu', native, true);
    win.removeEventListener('click', click, true);
  };
}
