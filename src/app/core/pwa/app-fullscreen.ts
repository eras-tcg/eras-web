import { DestroyRef, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { persistedFlag } from '../storage/persisted-flag';
import { AppScreen } from './app-screen';

/** What the Windows app's shell (desktop/preload.cjs) offers for its window's full screen (older installers: nothing). */
interface DesktopFullScreen {
  setFullScreen?: (on: boolean) => void;
  onFullScreenChange?: (listener: (on: boolean) => void) => void;
}

/** Taps and keys: the gestures a browser asks for before it lets a page take the full screen. */
const GESTURES = ['pointerdown', 'keydown'] as const;

/**
 * Whether the installed app opens in full screen in a desktop's window (the Windows app, an installed window on a
 * computer): a preference of the device, set in Preferencias, applied as the app opens and kept as the player leaves or
 * takes the full screen (Esc, F11). The Windows app's shell sets its window's full screen right away; elsewhere the
 * browser lets a page ask only after a gesture, so it is asked on the first tap or key. Not for a phone or tablet (the
 * installed app there is always full screen, AppScreen) nor the browser's tab (its own button in the top bar).
 */
@Injectable({ providedIn: 'root' })
export class AppFullscreen {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly screen = inject(AppScreen);
  private readonly desktop = (this.document.defaultView as { erasDesktop?: DesktopFullScreen } | null)?.erasDesktop;
  private readonly bridge = typeof this.desktop?.setFullScreen === 'function' ? this.desktop : null;

  /** The preference shows (and applies): the installed app in a desktop's window. */
  readonly available =
    this.screen.installed && this.screen.fullscreenToggle && !this.screen.native && (!!this.bridge || this.document.fullscreenEnabled === true);
  /** Opens in full screen. */
  readonly on = persistedFlag('eras-app-fullscreen', false);
  private started = false;

  /** Started once by the App: the window as the preference says, and the preference following the window. */
  start(): void {
    if (!this.available || this.started) return;
    this.started = true;
    if (this.bridge) {
      this.bridge.onFullScreenChange?.((on) => this.on.set(on));
    } else {
      // Left with Esc (or taken some other way): the preference follows
      const follow = () => this.on.set(!!this.document.fullscreenElement);
      this.document.addEventListener('fullscreenchange', follow);
      this.destroyRef.onDestroy(() => this.document.removeEventListener('fullscreenchange', follow));
    }
    if (this.on()) this.apply(true);
  }

  /** Set from Preferencias (a click: the page may take the full screen at once). */
  set(on: boolean): void {
    this.on.set(on);
    this.apply(on);
  }

  private apply(on: boolean): void {
    if (this.bridge) {
      this.bridge.setFullScreen?.(on);
      return;
    }
    const doc = this.document;
    if (!on) {
      if (doc.fullscreenElement) doc.exitFullscreen().catch(() => undefined);
      return;
    }
    if (doc.fullscreenElement) return;
    doc.documentElement.requestFullscreen().catch(() => this.onNextGesture());
  }

  /** Refused without a gesture (as the app opens): asked again on the first tap or key, if still wanted. */
  private onNextGesture(): void {
    const doc = this.document;
    const ask = () => {
      for (const type of GESTURES) doc.removeEventListener(type, ask, true);
      if (this.on() && !doc.fullscreenElement) doc.documentElement.requestFullscreen().catch(() => undefined);
    };
    for (const type of GESTURES) doc.addEventListener(type, ask, true);
    this.destroyRef.onDestroy(() => {
      for (const type of GESTURES) doc.removeEventListener(type, ask, true);
    });
  }
}
