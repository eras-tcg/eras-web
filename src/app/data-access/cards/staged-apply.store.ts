import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardsStore } from './cards.store';
import { ApplyProgress, StagedChangesApi } from './staged.api';

const POLL_MS = 1500;

/**
 * Applying all the staged changes, followed from anywhere in the app: the server does the work, this store asks
 * how it goes while it runs. Leaving the page does not stop it, and coming back (or reloading) shows it again.
 */
@Injectable({ providedIn: 'root' })
export class StagedApplyStore {
  private readonly api = inject(StagedChangesApi);
  private readonly cards = inject(CardsStore);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly progress = signal<ApplyProgress | null>(null);
  readonly running = computed(() => !!this.progress()?.running);
  /** 0–100 */
  readonly percent = computed(() => {
    const p = this.progress();
    return p && p.total ? Math.round(((p.done + p.failed) / p.total) * 100) : 0;
  });
  /** Called once a run ends (the page reloads its list). */
  private readonly finishedListeners = new Set<() => void>();

  async start(): Promise<void> {
    this.track(await firstValueFrom(this.api.applyAll()));
  }

  /** Asks the server how it goes (on opening the page) and keeps asking while it runs. */
  async refresh(): Promise<void> {
    try {
      this.track(await firstValueFrom(this.api.applyStatus()));
    } catch {
      // without manage_cards, or the server is down: nothing to show
    }
  }

  onFinished(listener: () => void): () => void {
    this.finishedListeners.add(listener);
    return () => this.finishedListeners.delete(listener);
  }

  private track(next: ApplyProgress): void {
    const wasRunning = this.running();
    this.progress.set(next);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (next.running) {
      this.timer = setTimeout(() => void this.refresh(), POLL_MS);
    } else if (wasRunning) {
      void this.cards.load(true);
      this.finishedListeners.forEach((l) => l());
    }
  }
}
