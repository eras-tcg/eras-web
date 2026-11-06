import { describe, expect, it } from 'vitest';
import { GameState } from './simulator.model';
import { UpdateQueue, isTimeJump } from './update-queue';

const update = (n: number, over: Partial<GameState> = {}): GameState => ({ roomId: 'r', timelineAt: n, ...over }) as GameState;

/** A queue over a plain state, with frames run by hand. */
function setup() {
  let state: GameState | null = null;
  const shown: number[] = [];
  const frames: (() => void)[] = [];
  const queue = new UpdateQueue(
    () => state,
    (u) => {
      state = u;
      shown.push(u.timelineAt ?? -1);
    },
    (fn) => frames.push(fn),
  );
  const runFrames = () => {
    while (frames.length) frames.shift()!();
  };
  return { queue, shown, runFrames };
}

describe('UpdateQueue', () => {
  it('shows an update at once and the next ones a frame apart', () => {
    const { queue, shown, runFrames } = setup();
    queue.push(update(1));
    expect(shown).toEqual([1]);
    queue.incoming.push(update(2), update(3));
    queue.drain();
    expect(shown).toEqual([1, 2]);
    expect(queue.draining).toBe(true);
    runFrames();
    expect(shown).toEqual([1, 2, 3]);
    expect(queue.draining).toBe(false);
  });

  it('holds the updates while the board plays and shows them once it lets go', () => {
    const { queue, shown } = setup();
    queue.hold.set(true);
    queue.push(update(1));
    expect(shown).toEqual([]);
    queue.hold.set(false);
    queue.drain();
    expect(shown).toEqual([1]);
  });

  it('waits for the prelude before showing the update', async () => {
    const { queue, shown } = setup();
    queue.push(update(1));
    let done!: () => void;
    queue.prelude = () => new Promise<void>((resolve) => (done = resolve));
    queue.push(update(2));
    expect(shown).toEqual([1]);
    expect(queue.draining).toBe(true);
    done();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(shown).toEqual([1, 2]);
  });

  it('forgets what waits on clear', () => {
    const { queue, shown } = setup();
    queue.hold.set(true);
    queue.push(update(1));
    queue.clear();
    queue.hold.set(false);
    queue.drain();
    expect(shown).toEqual([]);
  });
});

describe('isTimeJump', () => {
  it('is a time step of more than one move, or from no time line', () => {
    expect(isTimeJump(3, update(4, { event: 'TIME_STEP' }))).toBe(false);
    expect(isTimeJump(3, update(1, { event: 'TIME_STEP' }))).toBe(true);
    expect(isTimeJump(null, update(1, { event: 'TIME_STEP' }))).toBe(true);
    expect(isTimeJump(3, update(5, { event: 'MOVE_CARD' }))).toBe(false);
  });
});
