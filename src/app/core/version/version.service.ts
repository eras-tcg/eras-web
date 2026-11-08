import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { isNativeApp } from '../pwa/app-mode';

/** Every few minutes, and whenever the tab is shown again, the deployed version is checked. */
const CHECK_EVERY_MS = 5 * 60_000;
/** The main bundle's file name carries the build's hash ("main-OJRMUZKX.js"). */
const MAIN_BUNDLE = /main-[A-Z0-9]+\.js/;

/** Which banner the header shows about the app's version, if any ('app': the Android app needs a new APK). */
export type VersionBanner = 'update' | 'broken' | 'app' | null;

/** The game's table (online or offline): a new version waits there, so a game is never interrupted by the banner. */
export function inGame(url: string): boolean {
  return /^\/simulator\/[^/?#]+\/board(?:[/?#]|$)/.test(url);
}

/**
 * Screens where the app may reload itself to take a new version: nothing is lost there (no game, no deck being
 * built, no form). Anywhere else the new version waits, with the banner, until the player reaches one of them.
 */
export function safeToUpdate(url: string): boolean {
  return /^\/(?:home|play|social|my-decks|public-decks|cards|editions|missions|profile|ranking|tierlist|ruling|login)?(?:[/?#]|$)/.test(url)
    && !/^\/(?:editions|cards)\/.+\/(?:edit|new)/.test(url);
}

/** The app reloads by itself at most once a minute (a version that keeps failing must not loop). */
const AUTO_RELOAD_KEY = 'eras-auto-reload';
const AUTO_RELOAD_GAP_MS = 60_000;

/**
 * The banner for this state: a broken version (the service worker lost part of it: it must be reloaded) shows
 * everywhere; a new version waits until the player leaves the table. On a safe screen the app takes it by itself
 * (VersionService.applyWhenSafe), so the banner is only seen where that would lose something.
 */
export function versionBanner(state: { updateAvailable: boolean; broken: boolean; url: string; appUpdate?: boolean }): VersionBanner {
  if (state.broken) return 'broken';
  if (inGame(state.url)) return null;
  if (state.updateAvailable) return 'update';
  return state.appUpdate ? 'app' : null;
}

/**
 * Tells when a new version of the app is ready while this one is open, and takes it on a safe screen. Installed (a service worker controls the page:
 * ngsw), the service worker downloads it and says so (SwUpdate VERSION_READY); "Recargar" activates it. Otherwise
 * the index.html served now is compared with the running one (another main bundle: a new deploy). Nothing happens in
 * development (no hashed bundle, no service worker).
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly running = runningBundle();
  private started = false;

  readonly updateAvailable = signal(false);
  /** The service worker cannot serve this version any more (SwUpdate.unrecoverable): only a reload fixes it. */
  readonly broken = signal(false);
  /** The Android app: a newer APK is needed (its address, on the site); the header offers it. */
  readonly appUpdate = signal<string | null>(null);
  /** The Android app: switches to the web part its updater downloaded (NativeApp). */
  private nativeApply: (() => Promise<void>) | null = null;

  /**
   * The Android app's updater downloaded a new web part: shown and taken as the PWA's new version (on a safe screen
   * by itself, or with "Recargar"; never over a game).
   */
  nativeUpdateReady(apply: () => Promise<void>): void {
    this.nativeApply = apply;
    this.updateAvailable.set(true);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    // The Android app: its code is in the APK, updates come from its updater (NativeApp), not from the site's page
    if (isNativeApp()) return;
    if (this.sw?.isEnabled) {
      const versions = this.sw.versionUpdates.subscribe((e) => e.type === 'VERSION_READY' && this.updateAvailable.set(true));
      const broken = this.sw.unrecoverable.subscribe(() => this.broken.set(true));
      this.destroyRef.onDestroy(() => {
        versions.unsubscribe();
        broken.unsubscribe();
      });
    }
    if (!this.running && !this.sw?.isEnabled) return;
    // Right away too: an app opened after a deploy finds the new version now, not in five minutes
    void this.check();
    const timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void this.check();
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  async check(): Promise<void> {
    if (this.updateAvailable()) return;
    if (this.controlled()) {
      // The answer comes as VERSION_READY once the new version is downloaded
      await this.sw?.checkForUpdate().catch(() => false);
      return;
    }
    if (!this.running) return;
    try {
      // ngsw-bypass: a service worker installed meanwhile must not answer with the index.html it keeps
      const response = await fetch(new URL('index.html?ngsw-bypass=1', document.baseURI), { cache: 'no-store' });
      if (!response.ok) return;
      const deployed = (await response.text()).match(MAIN_BUNDLE)?.[0];
      if (deployed && deployed !== this.running) this.updateAvailable.set(true);
    } catch {
      // offline or the server is restarting: try again later
    }
  }

  /**
   * Takes the new version (or recovers a broken one) by itself when the player is on a safe screen: called whenever
   * the screen or the version state changes. Never on a game's table, the deck builder or a form.
   */
  async applyWhenSafe(url: string): Promise<boolean> {
    if (!(this.updateAvailable() || this.broken()) || !url || !safeToUpdate(url) || this.applying) return false;
    if (!claimAutoReload()) return false;
    this.applying = true;
    await this.reload();
    return true;
  }

  private applying = false;

  /** The banner's "Recargar", or applyWhenSafe: the new version is activated and the page reloaded. */
  async reload(): Promise<void> {
    if (this.nativeApply && this.updateAvailable()) {
      // The updater reloads the page with the new web part (or, if it fails, the app stays as it is)
      await this.nativeApply().catch(() => undefined);
      return;
    }
    if (this.controlled() && this.updateAvailable()) await this.sw?.activateUpdate().catch(() => false);
    location.reload();
  }

  /** A service worker serves this page (the second visit on; the first is controlled once it installs). */
  private controlled(): boolean {
    return !!this.sw?.isEnabled && !!navigator.serviceWorker?.controller;
  }
}

/** True when no automatic reload happened in the last minute (and records this one). */
function claimAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0);
    if (Date.now() - last < AUTO_RELOAD_GAP_MS) return false;
    sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
  } catch {
    // no session storage: reload anyway (a failing version shows the banner instead next time)
  }
  return true;
}

function runningBundle(): string | null {
  for (const script of Array.from(document.scripts)) {
    const name = script.src.match(MAIN_BUNDLE)?.[0];
    if (name) return name;
  }
  return null;
}
