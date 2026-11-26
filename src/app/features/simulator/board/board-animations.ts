import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { persistedFlag } from '@core/storage/persisted-flag';
import { BoardPreferences } from './board-preferences';
import { ANIMATION_PACES, setAnimationPace } from './timing';

/** Animations playing on the board: the engine's choices wait until they are over. */
@Injectable()
export class BoardAnimations {
  private readonly prefs = inject(BoardPreferences);
  private readonly running = signal(0);
  /**
   * The player turned the animations off (cards flying, damage and clashes, the turn and phase pop-ups, transitions):
   * the table changes at once. Remembered on the device.
   */
  readonly off = persistedFlag('eras-sim-animations-off');
  readonly idle = computed(() => this.running() === 0);
  /** "Velocidad de las animaciones": what every duration is multiplied by (1 normal, under 1 faster). */
  readonly pace = computed(() => ANIMATION_PACES[Math.round(this.prefs.animationSpeed())] ?? 1);
  /** A card shown on top of its pile (the Descarte, the Tributos) while its effect's activation plays there. */
  readonly onTop = signal<string | null>(null);
  /** Nothing moves: the animations are off, or the device asks for reduced motion. */
  still(): boolean {
    return this.off() || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  private readonly waiting: (() => void)[] = [];

  constructor() {
    // The durations follow it (TIMING reads it), from the start and when the player changes it
    setAnimationPace(untracked(this.pace));
    effect(() => setAnimationPace(this.pace()));
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
