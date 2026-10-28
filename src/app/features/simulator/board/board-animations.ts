import { Injectable, computed, signal } from '@angular/core';

/** Animations playing on the board: the engine's choices wait until they are over. */
@Injectable()
export class BoardAnimations {
  private readonly running = signal(0);
  readonly idle = computed(() => this.running() === 0);

  /** Marks an animation of `ms` milliseconds as playing. */
  hold(ms: number): void {
    this.running.update((n) => n + 1);
    setTimeout(() => this.running.update((n) => Math.max(0, n - 1)), ms);
  }
}
