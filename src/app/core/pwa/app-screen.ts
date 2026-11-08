import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { ServerAccess } from '../server/server-access';
import type { AppMode } from './app-mode';


/** The taps that may ask for full screen (the browser takes any of them as the player's gesture). */
const GESTURES = ['click', 'pointerup', 'touchend'] as const;
/** The window's size as the layout uses it (CSS px). */
export interface LayoutBox {
  width: number;
  height: number;
}

/** After turning the phone or entering/leaving full screen, the size the window takes is accepted as it is for this long. */
export const SETTLE_MS = 800;

/**
 * The installed app's layout height. Android shows its bars for a moment over an app in full screen (a swipe from the
 * edge: the navigation buttons, the status bar) and the keyboard may shrink the window: the layout must not shrink and
 * jump with them. So on a touch screen, while the width stays (the phone was not turned), the height only grows (the
 * bars went away); a shorter window keeps the height it had. Turning it, or a change of full screen (`settling`),
 * takes the new size. Elsewhere (a desktop window) the window's height, as it is.
 */
export function nextLayoutHeight(previous: LayoutBox | null, sample: LayoutBox, context: { settling: boolean; touch: boolean }): LayoutBox {
  if (!previous || context.settling || !context.touch) return sample;
  if (Math.abs(sample.width - previous.width) > 1) return sample;
  return sample.height >= previous.height ? sample : previous;
}

/**
 * Whether a tap should ask for full screen: the installed app on a phone or tablet (a touch screen: a desktop's
 * installed window is left as the player sizes it), where the browser allows it, not already full screen (the page's
 * own, or the app's window when it opened as fullscreen from the manifest).
 */
export function needsFullscreenRequest(state: {
  installed: boolean;
  touch: boolean;
  fullscreenEnabled: boolean;
  elementFullscreen: boolean;
  displayFullscreen: boolean;
}): boolean {
  return state.installed && state.touch && state.fullscreenEnabled && !state.elementFullscreen && !state.displayFullscreen;
}

/**
 * The app's own "Pantalla completa" buttons: in the browser, and in a desktop's installed window; not in the installed
 * app on a phone or tablet (always full screen).
 */
export function showFullscreenToggle(state: { mode: AppMode; touch: boolean }): boolean {
  return state.mode === 'browser' || !state.touch;
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/**
 * The installed app is always in landscape and full screen (the browser's tab keeps the site as it is):
 * - full screen (phones and tablets): asked on the first tap (browsers allow it only after a gesture), and again after coming back from
 *   the background or leaving it (Android's back gesture);
 * - landscape: screen.orientation.lock('landscape') (Android, in full screen or installed; refused elsewhere: then
 *   "Gira el teléfono" covers the app while it is held upright, see RotateOverlayComponent);
 * - the layout height (--app-height): fixed against the bars that show for a moment (nextLayoutHeight).
 * The manifest already asks for both (display fullscreen, orientation landscape) where the browser follows it.
 */
@Injectable({ providedIn: 'root' })
export class AppScreen {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly installed = inject(ServerAccess).mode === 'app';
  /** A touch screen (a phone or tablet): the coarse pointer. */
  readonly touch = this.document.defaultView?.matchMedia?.('(pointer: coarse)').matches === true;
  /** The app's own "Pantalla completa" buttons show (showFullscreenToggle). */
  readonly fullscreenToggle = showFullscreenToggle({ mode: this.installed ? 'app' : 'browser', touch: this.touch });
  private box: LayoutBox | null = null;
  private settleUntil = 0;
  private locked = false;
  private started = false;

  /** Started once by the App (does nothing in the browser). */
  start(): void {
    const win = this.document.defaultView;
    if (!this.installed || !win || this.started) return;
    this.started = true;
    const root = this.document.documentElement;
    root.classList.add('eras-app');
    const touch = this.touch;

    const measure = () => {
      this.box = nextLayoutHeight(this.box, { width: win.innerWidth, height: win.innerHeight }, { settling: Date.now() < this.settleUntil, touch });
      root.style.setProperty('--app-height', `${this.box.height}px`);
    };
    const settle = () => {
      this.settleUntil = Date.now() + SETTLE_MS;
      measure();
    };
    const lock = () => {
      if (this.locked) return;
      const orientation = win.screen?.orientation as LockableOrientation | undefined;
      if (!orientation?.lock) return;
      orientation.lock('landscape').then(
        () => (this.locked = true),
        () => undefined,
      );
    };
    const onGesture = () => {
      const ask = needsFullscreenRequest({
        installed: true,
        touch,
        fullscreenEnabled: this.document.fullscreenEnabled === true,
        elementFullscreen: !!this.document.fullscreenElement,
        displayFullscreen: win.matchMedia?.('(display-mode: fullscreen)').matches === true,
      });
      if (!ask) return lock();
      root.requestFullscreen?.({ navigationUI: 'hide' }).then(lock, lock);
    };
    const onFullscreen = () => {
      this.locked = false;
      settle();
      lock();
    };
    const onVisible = () => {
      if (this.document.visibilityState !== 'visible') return;
      // Back from the background: full screen and the lock may be gone (asked again on the next tap)
      this.locked = false;
      settle();
      lock();
    };

    settle();
    lock();
    win.addEventListener('resize', measure);
    win.addEventListener('orientationchange', settle);
    // Any tap counts (a drag on the board ends in pointerup/touchend without a click); all are user gestures
    for (const type of GESTURES) this.document.addEventListener(type, onGesture, true);
    this.document.addEventListener('fullscreenchange', onFullscreen);
    this.document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      win.removeEventListener('resize', measure);
      win.removeEventListener('orientationchange', settle);
      for (const type of GESTURES) this.document.removeEventListener(type, onGesture, true);
      this.document.removeEventListener('fullscreenchange', onFullscreen);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }
}
