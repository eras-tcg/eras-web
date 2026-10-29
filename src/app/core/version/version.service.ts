import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/** Every few minutes, and whenever the tab is shown again, the deployed version is checked. */
const CHECK_EVERY_MS = 5 * 60_000;
/** The main bundle's file name carries the build's hash ("main-OJRMUZKX.js"). */
const MAIN_BUNDLE = /main-[A-Z0-9]+\.js/;

/**
 * Tells when a new version of the app has been deployed while this one is open: the index.html served now
 * points to another main bundle than the one running. Nothing happens in development (no hashed bundle).
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly running = runningBundle();
  private started = false;

  readonly updateAvailable = signal(false);

  start(): void {
    if (this.started || !this.running) return;
    this.started = true;
    const timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void this.check();
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  async check(): Promise<void> {
    if (!this.running || this.updateAvailable()) return;
    try {
      const response = await fetch(new URL('index.html', document.baseURI), { cache: 'no-store' });
      if (!response.ok) return;
      const deployed = (await response.text()).match(MAIN_BUNDLE)?.[0];
      if (deployed && deployed !== this.running) this.updateAvailable.set(true);
    } catch {
      // offline or the server is restarting: try again later
    }
  }

  reload(): void {
    location.reload();
  }
}

function runningBundle(): string | null {
  for (const script of Array.from(document.scripts)) {
    const name = script.src.match(MAIN_BUNDLE)?.[0];
    if (name) return name;
  }
  return null;
}
