import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { environment } from '@env';

/** Whether the backend can be used: always, or (a backend that sleeps) once it has started. */
export type ServerState = 'checking' | 'waking' | 'ready' | 'failed' | 'offline';

/** The backend's health check (the Android app: on the public site, by its full address). */
const HEALTH = `${environment.apiBaseUrl}/api/drive/health`;

/** The address that wakes a backend that sleeps (environment.wakeUrl); a test gives its own. */
export const WAKE_URL = new InjectionToken<string | undefined>('WAKE_URL', { providedIn: 'root', factory: () => environment.wakeUrl });
/** How often it asks whether the backend is up while it starts, and for how long at most. */
const POLL_MS = 3000;
const GIVE_UP_MS = 4 * 60_000;

/**
 * A backend that sleeps until someone visits (environment.wakeUrl): on opening the site it checks whether the backend
 * answers; if not, it asks to wake it up and waits for it, while the page says it is warming up. Without wakeUrl the
 * backend is always on and the site starts right away.
 */
@Injectable({ providedIn: 'root' })
export class ServerWarmupService {
  private readonly wakeUrl = inject(WAKE_URL);
  private readonly stateSignal = signal<ServerState>(this.wakeUrl ? (isOffline() ? 'offline' : 'checking') : 'ready');
  readonly state = this.stateSignal.asReadonly();
  readonly ready = computed(() => this.stateSignal() === 'ready');
  /**
   * The site can be shown: the backend is up, or there is no connection at all (the installed app opened offline),
   * so nothing is waited for and what works offline (Modo solo sin conexión) is reachable at once.
   */
  readonly usable = computed(() => this.stateSignal() === 'ready' || this.stateSignal() === 'offline' || this.shownOffline());
  /** The site was shown offline: when the connection comes back the backend is checked (and woken) behind it. */
  private readonly shownOffline = signal(false);
  private waitingForNetwork = false;
  /** Seconds since it started waiting for the backend. */
  readonly waited = signal(0);
  private running: Promise<void> | null = null;

  /** Checks (and wakes) the backend once; later calls wait for the same check. */
  start(): Promise<void> {
    if (!this.wakeUrl) return Promise.resolve();
    if (isOffline()) {
      this.whenOnline();
      return Promise.resolve();
    }
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  /** The backend stopped answering while the site was open (it went to sleep): wake it up again. */
  lost(): void {
    if (!this.wakeUrl || this.running || this.stateSignal() !== 'ready') return;
    // No connection: the backend is not asleep, it just cannot be reached until the connection is back
    if (isOffline()) {
      this.whenOnline();
      return;
    }
    this.stateSignal.set('checking');
    void this.start();
  }

  private async run(): Promise<void> {
    if (await this.healthy()) {
      this.stateSignal.set('ready');
      return;
    }
    this.stateSignal.set('waking');
    this.waited.set(0);
    const started = Date.now();
    await this.wake();
    while (Date.now() - started < GIVE_UP_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      this.waited.set(Math.round((Date.now() - started) / 1000));
      if (await this.healthy()) {
        this.stateSignal.set('ready');
        return;
      }
      // Asked again now and then, in case the first request was lost
      if (this.waited() % 30 < POLL_MS / 1000) await this.wake();
    }
    this.stateSignal.set('failed');
  }

  /** Without the connection: shown as offline (not blocked) and checked again when the connection is back. */
  private whenOnline(): void {
    this.stateSignal.set('offline');
    this.shownOffline.set(true);
    if (this.waitingForNetwork) return;
    this.waitingForNetwork = true;
    window.addEventListener(
      'online',
      () => {
        this.waitingForNetwork = false;
        this.stateSignal.set('checking');
        void this.start().finally(() => this.shownOffline.set(false));
      },
      { once: true },
    );
  }

  /** Tries again after it gave up. */
  retry(): void {
    this.stateSignal.set('checking');
    void this.start();
  }

  private async healthy(): Promise<boolean> {
    try {
      const response = await fetch(HEALTH, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async wake(): Promise<void> {
    try {
      const url = this.wakeUrl as string;
      // From another origin (the Android app) its answer is not read: a plain POST needs no CORS to reach it
      await fetch(url, { method: 'POST', cache: 'no-store', mode: wakeMode(url), signal: AbortSignal.timeout(10_000) });
    } catch {
      // It is asked again while waiting
    }
  }
}

/** The wake-up's request mode: 'no-cors' when the address is on another origin than the page (its answer is never read). */
export function wakeMode(url: string, pageOrigin: string = typeof location === 'undefined' ? '' : location.origin): RequestMode {
  try {
    return new URL(url, pageOrigin || undefined).origin === pageOrigin ? 'cors' : 'no-cors';
  } catch {
    return 'cors';
  }
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
