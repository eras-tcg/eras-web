import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { ServerAccess } from '../server/server-access';
import { isNativeApp, type AppMode } from './app-mode';

/** The taps that may ask for full screen (the browser takes any of them as the player's gesture). */
const GESTURES = ['click', 'pointerup', 'touchend'] as const;

/** The window's size as the layout uses it (CSS px). */
export interface LayoutBox {
  width: number;
  height: number;
}

/** After turning the phone or entering/leaving full screen, the size the window takes is accepted as it is for this long. */

/**
 * The installed app's layout size (--app-width, --app-height). On a phone or tablet the system bars that show for a
 * moment (a swipe from the edge: the status bar on top, the navigation buttons at the bottom or, in landscape, on a
 * side) and the keyboard shrink the window for an instant, even in full screen, before they turn see-through: the
 * layout must not reflow and jump with them. So on a touch screen it keeps the largest width and height seen while the
 * phone is held the same way (the content is briefly covered at the edge instead), and takes the new size only when
 * the phone is turned (landscape ⇄ portrait). Elsewhere (a desktop window) the window's size, as it is.
 */
export function nextLayoutBox(previous: LayoutBox | null, sample: LayoutBox, context: { touch: boolean }): LayoutBox {
  if (!previous || !context.touch) return sample;
  const landscape = (b: LayoutBox) => b.width > b.height;
  if (landscape(sample) !== landscape(previous)) return sample;
  return { width: Math.max(previous.width, sample.width), height: Math.max(previous.height, sample.height) };
}

/**
 * Whether a tap should ask for full screen: the installed app on a phone or tablet (a touch screen: a desktop's
 * installed window is left as the player sizes it), where the browser allows it, unless the page already is (its
 * own full screen). An app opened as "fullscreen" from the manifest still asks: some Android phones keep the status
 * and navigation bars there, and only the page's full screen hides them (they then show over the game, see-through,
 * on a swipe from the edge, and hide again).
 */
export function needsFullscreenRequest(state: {
  installed: boolean;
  touch: boolean;
  fullscreenEnabled: boolean;
  elementFullscreen: boolean;
}): boolean {
  return state.installed && state.touch && state.fullscreenEnabled && !state.elementFullscreen;
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
 * - the layout size (--app-width, --app-height): fixed against the bars that show for a moment (nextLayoutBox).
 * The manifest already asks for both (display fullscreen, orientation landscape) where the browser follows it.
 */
@Injectable({ providedIn: 'root' })
export class AppScreen {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly installed = inject(ServerAccess).mode === 'app';
  /**
   * The Android app: its activity is always in landscape and full screen (immersive, MainActivity), so the page asks
   * for neither (the browser's full screen API would only fight it); the layout size is kept the same way.
   */
  readonly native = isNativeApp(this.document.defaultView ?? undefined);
  /** A touch screen (a phone or tablet): the coarse pointer. */
  readonly touch = this.document.defaultView?.matchMedia?.('(pointer: coarse)').matches === true;
  /** The app's own "Pantalla completa" buttons show (showFullscreenToggle). */
  readonly fullscreenToggle = showFullscreenToggle({ mode: this.installed ? 'app' : 'browser', touch: this.touch });
  private box: LayoutBox | null = null;
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
      this.box = nextLayoutBox(this.box, { width: win.innerWidth, height: win.innerHeight }, { touch });
      root.style.setProperty('--app-height', `${this.box.height}px`);
      root.style.setProperty('--app-width', `${this.box.width}px`);
      // 1vw / 1vh of that size, for what the hub and the board size by the window (they would move with the bars)
      root.style.setProperty('--app-vw', `${this.box.width / 100}px`);
      root.style.setProperty('--app-vh', `${this.box.height / 100}px`);
    };
    const settle = () => {
      measure();
    };
    const native = this.native;
    const lock = () => {
      if (this.locked || native) return;
      const orientation = win.screen?.orientation as LockableOrientation | undefined;
      if (!orientation?.lock) return;
      orientation.lock('landscape').then(
        () => (this.locked = true),
        () => undefined,
      );
    };
    const onGesture = () => {
      if (native) return;
      const ask = needsFullscreenRequest({
        installed: true,
        touch,
        fullscreenEnabled: this.document.fullscreenEnabled === true,
        elementFullscreen: !!this.document.fullscreenElement,
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
