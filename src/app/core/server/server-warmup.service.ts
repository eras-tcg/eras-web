import { Injectable, computed, signal } from '@angular/core';
import { environment } from '@env';

/** Whether the backend can be used: always, or (a backend that sleeps) once it has started. */
export type ServerState = 'checking' | 'waking' | 'ready' | 'failed';

const HEALTH = '/api/drive/health';
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
  private readonly stateSignal = signal<ServerState>(environment.wakeUrl ? 'checking' : 'ready');
  readonly state = this.stateSignal.asReadonly();
  readonly ready = computed(() => this.stateSignal() === 'ready');
  /** Seconds since it started waiting for the backend. */
  readonly waited = signal(0);
  private running: Promise<void> | null = null;

  /** Checks (and wakes) the backend once; later calls wait for the same check. */
  start(): Promise<void> {
    if (!environment.wakeUrl) return Promise.resolve();
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  /** The backend stopped answering while the site was open (it went to sleep): wake it up again. */
  lost(): void {
    if (!environment.wakeUrl || this.running || this.stateSignal() !== 'ready') return;
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
      await fetch(environment.wakeUrl as string, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    } catch {
      // It is asked again while waiting
    }
  }
}
