import { lastSeq } from '@data/simulator/game-rules';
import { GameEvent, GameState } from '@data/simulator/simulator.model';

/**
 * Where a reader of the game's timeline is: each update, the events it has not seen yet. Joining a game sees none (what
 * happened before is not played again), and a new game starts a new timeline (its numbers start over).
 */
export class TimelineCursor {
  private at: number | null = null;

  /** The events of `state` after the last ones seen, and marks them seen. */
  fresh(state: GameState | null | undefined): GameEvent[] {
    const max = lastSeq(state);
    if (this.at === null || max < this.at) {
      this.at = max;
      return [];
    }
    const events = (state?.timeline ?? []).filter((e) => e.seq > this.at!);
    this.at = max;
    return events;
  }

  /** The events after the last ones seen, without marking them seen. */
  peek(state: GameState | null | undefined): GameEvent[] {
    if (this.at === null || lastSeq(state) < this.at) return [];
    return (state?.timeline ?? []).filter((e) => e.seq > this.at!);
  }

  /** Everything in `state` counts as seen (a jump through time). */
  skip(state: GameState | null | undefined): void {
    this.at = lastSeq(state);
  }
}
