import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { persistStorage } from './device-storage';

/** Chromium's install offer (not in TypeScript's DOM types). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

/** What index.html's inline script kept before the app started. */
interface InstallGlobals {
  __erasInstallPrompt?: BeforeInstallPromptEvent | null;
  __erasInstalled?: boolean;
}

/**
 * How "Instalar ERAS" can be offered: the browser's own prompt (Chromium: Android, desktop), instructions to add it to
 * the home screen by hand (iPhone and iPad: Safari has no prompt), or not at all (already installed, or a browser that
 * cannot install it, which then offers nothing).
 */
export type InstallOffer = 'prompt' | 'ios' | 'android' | 'none';

/**
 * On Android without the browser's prompt (Chrome may not have offered it yet, or the player dismissed it), the
 * button still shows and explains the browser menu's "Instalar app".
 */
export function installOffer(state: { installed: boolean; canPrompt: boolean; ios: boolean; android?: boolean }): InstallOffer {
  if (state.installed) return 'none';
  if (state.canPrompt) return 'prompt';
  if (state.ios) return 'ios';
  return state.android ? 'android' : 'none';
}

/** An Android phone or tablet. */
export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/** iPhone, iPod or iPad (iPadOS says it is a Mac, but a Mac has no touch screen). */
export function isIos(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

/** The site runs as the installed app (its own window, without the browser's bars). */
export function isStandalone(win: Window = window): boolean {
  const media = (query: string) => win.matchMedia?.(query).matches === true;
  return (
    media('(display-mode: standalone)') ||
    media('(display-mode: fullscreen)') ||
    media('(display-mode: minimal-ui)') ||
    (win.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * "Instalar ERAS": keeps the browser's install offer (beforeinstallprompt, caught from the start by index.html) to
 * show it when the player asks, and knows when the site is already installed (it runs standalone, or the browser
 * said `appinstalled`). Installing asks the browser to keep the site's storage (navigator.storage.persist).
 */
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  private readonly globals = window as unknown as InstallGlobals;
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(this.globals.__erasInstallPrompt ?? null);
  readonly installed = signal(isStandalone() || this.globals.__erasInstalled === true);
  private readonly ios = isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0);
  private readonly android = isAndroid(navigator.userAgent);

  readonly offer = computed(() =>
    installOffer({ installed: this.installed(), canPrompt: !!this.deferred(), ios: this.ios, android: this.android }),
  );

  constructor() {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      this.deferred.set(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      this.deferred.set(null);
      this.installed.set(true);
      void persistStorage();
    };
    const standalone = window.matchMedia?.('(display-mode: standalone)');
    const onDisplay = () => this.installed.update((was) => was || isStandalone());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    standalone?.addEventListener?.('change', onDisplay);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      standalone?.removeEventListener?.('change', onDisplay);
    });
  }

  /** Shows the browser's install prompt (once: the browser gives a new offer later if it was dismissed). */
  async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const offer = this.deferred();
    if (!offer) return 'unavailable';
    this.deferred.set(null);
    this.globals.__erasInstallPrompt = null;
    try {
      await offer.prompt();
      const { outcome } = await offer.userChoice;
      if (outcome === 'accepted') {
        this.installed.set(true);
        void persistStorage();
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }
}
