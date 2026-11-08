import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Every few minutes, and whenever the tab is shown again, the deployed version is checked. */
const CHECK_EVERY_MS = 5 * 60_000;
/** The main bundle's file name carries the build's hash ("main-OJRMUZKX.js"). */
const MAIN_BUNDLE = /main-[A-Z0-9]+\.js/;

/** Which banner the header shows about the app's version, if any. */
export type VersionBanner = 'update' | 'broken' | null;

/** The game's table (online or offline): a new version waits there, so a game is never interrupted by the banner. */
export function inGame(url: string): boolean {
  return /^\/simulator\/[^/?#]+\/board(?:[/?#]|$)/.test(url);
}

/**
 * The banner for this state: a broken version (the service worker lost part of it: it must be reloaded) shows
 * everywhere; a new version waits until the player leaves the table. Nothing ever reloads by itself.
 */
export function versionBanner(state: { updateAvailable: boolean; broken: boolean; url: string }): VersionBanner {
  if (state.broken) return 'broken';
  return state.updateAvailable && !inGame(state.url) ? 'update' : null;
}

/**
 * Tells when a new version of the app is ready while this one is open. Installed (a service worker controls the page:
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

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.sw?.isEnabled) {
      const versions = this.sw.versionUpdates.subscribe((e) => e.type === 'VERSION_READY' && this.updateAvailable.set(true));
      const broken = this.sw.unrecoverable.subscribe(() => this.broken.set(true));
      this.destroyRef.onDestroy(() => {
        versions.unsubscribe();
        broken.unsubscribe();
      });
    }
    if (!this.running && !this.sw?.isEnabled) return;
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

  /** Only when the player asks (the banner's "Recargar"): the new version is activated and the page reloaded. */
  async reload(): Promise<void> {
    if (this.controlled() && this.updateAvailable()) await this.sw?.activateUpdate().catch(() => false);
    location.reload();
  }

  /** A service worker serves this page (the second visit on; the first is controlled once it installs). */
  private controlled(): boolean {
    return !!this.sw?.isEnabled && !!navigator.serviceWorker?.controller;
  }
}

function runningBundle(): string | null {
  for (const script of Array.from(document.scripts)) {
    const name = script.src.match(MAIN_BUNDLE)?.[0];
    if (name) return name;
  }
  return null;
}
