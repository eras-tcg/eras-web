import { signal } from '@angular/core';
import { deckWarnings, targetForViewer } from './game-rules';
import { GameLogEntry, GameState } from './simulator.model';

export interface RevealedCard {
  id: number;
  imageUrl: string;
  name: string | null;
}

export interface LogLine extends GameLogEntry {
  id: string;
}

/** How long a card revealed from a hand is shown (the board's animation lasts as long). */
export const HAND_REVEAL_MS = 3000;
/** How long the cards that just reached the hand blink. */
const NEW_IN_HAND_MS = 4000;
/** How long the warning about the deck just picked stays. */
const DECK_WARNING_MS = 10_000;
/** How long a line of the history stays as a notice over the table. */
const RECENT_LOG_MS = 6000;
/** How long a target stays marked. */
const TARGET_MS = 3000;

/**
 * The room's transient notices, taken from each update shown: the warning about the deck picked, cards revealed from a
 * hand, the history and its latest lines, the target marked and the cards that just reached the hand. Each fades by
 * itself after a while.
 */
export class GameNotices {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  readonly deckWarning = signal<string | null>(null);
  readonly revealed = signal<RevealedCard[]>([]);
  readonly targetedId = signal<string | null>(null);
  readonly targetingSourceId = signal<string | null>(null);
  /** Cards that just reached your hand: they blink for a few seconds so they can be spotted. */
  readonly newInHand = signal<ReadonlySet<string>>(new Set());
  private handIds: Set<string> | null = null;
  readonly log = signal<LogLine[]>([]);
  readonly recentLog = signal<LogLine[]>([]);

  /** The notices of an update just shown, seen from `side` (the side played). */
  take(update: GameState, side: string | null): void {
    this.markNewInHand(update, side);

    // Warn about the deck I just picked (in the pre-room I join without one)
    if (update.event === 'SET_DECK' && side && update.actorId === side) {
      const warnings = deckWarnings(update.players?.[side]?.originalDeck ?? []);
      if (warnings.length) {
        this.deckWarning.set(warnings.join(' · '));
        this.later(DECK_WARNING_MS, () => this.deckWarning.set(null));
      }
    }

    if (update.event === 'REVEAL_TO_HAND' && update.revealedCardImageUrl) {
      const card: RevealedCard = { id: Date.now() + Math.random(), imageUrl: update.revealedCardImageUrl, name: update.revealedCardName ?? null };
      this.revealed.update((list) => [...list, card]);
      this.later(HAND_REVEAL_MS, () => this.revealed.update((list) => list.filter((c) => c.id !== card.id)));
    }

    if (Array.isArray(update.eventLog)) {
      const previous = this.log().length;
      const lines = update.eventLog.map((e, i) => ({ ...e, id: `${e.ts}_${i}` }));
      this.log.set(lines);
      // Joining replays the whole history: only flash lines that are new while playing
      if (update.event !== 'JOIN_ROOM' && update.event !== 'RECONNECT') {
        for (const line of lines.slice(previous)) {
          this.recentLog.update((list) => [...list, line]);
          this.later(RECENT_LOG_MS, () => this.recentLog.update((list) => list.filter((l) => l.id !== line.id)));
        }
      }
    }

    if (update.event === 'TARGET_CARD' && update.targetedInstanceId) {
      this.targetedId.set(targetForViewer(update.targetedInstanceId, update.actorId === side));
      this.targetingSourceId.set(update.targetingSourceInstanceId ?? null);
      this.later(TARGET_MS, () => {
        this.targetedId.set(null);
        this.targetingSourceId.set(null);
      });
    }
  }

  /** Leaving the room: the pending fades stop and the notices go. */
  clear(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.deckWarning.set(null);
    this.revealed.set([]);
    this.log.set([]);
    this.recentLog.set([]);
    this.targetedId.set(null);
  }

  /** Cards in your hand that were not there before (only while playing, not on joining or a new game). */
  private markNewInHand(update: GameState, me: string | null): void {
    const hand = (me && update.players?.[me]?.hand) || [];
    const ids = new Set(hand.map((c) => c.instanceId));
    const previous = this.handIds;
    this.handIds = ids;
    if (!previous || update.status !== 'IN_PROGRESS' || update.event === 'JOIN_ROOM' || update.event === 'RECONNECT') return;
    const added = [...ids].filter((id) => !previous.has(id));
    if (!added.length) return;
    this.newInHand.update((s) => new Set([...s, ...added]));
    this.later(NEW_IN_HAND_MS, () => this.newInHand.update((s) => new Set([...s].filter((id) => !added.includes(id)))));
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }
}
