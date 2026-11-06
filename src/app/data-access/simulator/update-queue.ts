import { signal } from '@angular/core';
import { GameState } from './simulator.model';

/**
 * What the board plays before an update is shown, on the table as it still is (an attack's blow, the combat shown
 * big, a card breaking where it lies): the update waits for it. Null: nothing to play first.
 */
export type Prelude = (now: GameState, next: GameState) => Promise<void> | null;

/** A jump through time: a TIME_STEP that moves more than one move at once (or from no time line). */
export function isTimeJump(before: number | null | undefined, next: GameState): boolean {
  return next.event === 'TIME_STEP' && (before == null || Math.abs((next.timelineAt ?? 0) - before) !== 1);
}

/**
 * The room's updates in line: while the board plays an animation they wait and are shown one by one once it ends,
 * so what an effect does is seen after its chain link is shown, not under it. Each one is shown a frame after the one
 * before it (once the board has drawn and animated it), after the board's prelude to it, if any.
 */
export class UpdateQueue {
  /** The board is playing something: the updates that arrive wait. */
  readonly hold = signal(false);
  /**
   * The table jumped through time (a replay or the Sala de pruebas moved more than one move at once): what changed is
   * shown as it is, without animating each move in between.
   */
  readonly jumped = signal(false);
  /** The updates waiting, oldest first. */
  readonly incoming: GameState[] = [];
  /** An update is on its way (its prelude playing, or the frame before the next one). */
  draining = false;
  /** The board's prelude to each update; null when the board goes. */
  prelude: Prelude | null = null;

  /**
   * @param current the state shown now
   * @param show shows an update
   * @param frame runs a callback on the next frame (requestAnimationFrame; replaceable in tests)
   */
  constructor(
    private readonly current: () => GameState | null,
    private readonly show: (update: GameState) => void,
    private readonly frame: (fn: () => void) => void = (fn) => requestAnimationFrame(fn),
  ) {}

  /** An update arrives: in line, and shown at once when nothing waits. */
  push(update: GameState): void {
    this.incoming.push(update);
    this.drain();
  }

  /** Shows the next update in line, and the one after it a frame later (once the board has drawn and animated it). */
  drain(): void {
    if (this.draining || this.hold() || !this.incoming.length) return;
    // First what plays on the table as it still is; then the update
    const now = this.current();
    const first = now && this.prelude ? this.prelude(now, this.incoming[0]) : null;
    if (first) {
      this.draining = true;
      void first
        .catch(() => undefined)
        .then(() => {
          this.draining = false;
          const next = this.incoming.shift();
          if (next) this.show(next);
          this.frame(() => this.frame(() => this.drain()));
        });
      return;
    }
    this.show(this.incoming.shift()!);
    if (!this.incoming.length) return;
    this.draining = true;
    this.frame(() =>
      this.frame(() => {
        this.draining = false;
        this.drain();
      }),
    );
  }

  /** Forgets what waits (leaving the room). */
  clear(): void {
    this.incoming.length = 0;
    this.draining = false;
  }
}
