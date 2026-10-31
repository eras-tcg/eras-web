import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { persistedFlag } from '@core/storage/persisted-flag';

/** Animations playing on the board: the engine's choices wait until they are over. */
@Injectable()
export class BoardAnimations {
  private readonly running = signal(0);
  /**
   * The player turned the animations off (cards flying, damage and clashes, the turn and phase pop-ups, transitions):
   * the table changes at once. Remembered on the device.
   */
  readonly off = persistedFlag('eras-sim-animations-off');
  readonly idle = computed(() => this.running() === 0);
  private readonly waiting: (() => void)[] = [];

  constructor() {
    effect(() => {
      if (!this.idle()) return;
      untracked(() => this.waiting.splice(0).forEach((fn) => fn()));
    });
  }

  /** Runs `fn` now if nothing is playing, else once everything playing has ended (in the order asked). */
  whenIdle(fn: () => void): void {
    if (this.idle()) fn();
    else this.waiting.push(fn);
  }

  /** Marks an animation of `ms` milliseconds as playing. */
  hold(ms: number): void {
    setTimeout(this.begin(), ms);
  }

  /** Marks an animation as playing until the returned function is called (once). */
  begin(): () => void {
    this.running.update((n) => n + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.running.update((n) => Math.max(0, n - 1));
    };
  }
}
