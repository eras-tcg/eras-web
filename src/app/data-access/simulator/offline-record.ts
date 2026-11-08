import type { FinishedGame, LocalDeckSpec, LocalMatchConfig, MatchResult, RecordedStep } from './engine-protocol';
import { LOCAL_USER_ID } from './engine-protocol';

/**
 * A deck's card ids as `LocalMatch` seats them, one per copy in order: each entry's `cardId` (else its metadata's id),
 * or, for a starter deck in the file's form, each card's metadata id ×3 (the Iniciador ×1). What the server checks
 * against its own deck (OfflineDecks).
 */
export function deckCardIds(spec: LocalDeckSpec): string[] {
  const ids: string[] = [];
  if ('cards' in spec) {
    for (const c of spec.cards) {
      const id = c.cardId ?? (c.card as { id?: string }).id ?? '';
      for (let i = 0; i < c.copies; i++) ids.push(id);
    }
  } else {
    for (const m of spec.metadata as { id?: string; starter?: boolean }[]) {
      for (let i = 0; i < (m.starter ? 1 : 3); i++) ids.push(m.id ?? '');
    }
  }
  return ids;
}

/** The deck a body chooses (`SET_DECK {deckId}`, the player's or the bot's), or null. */
export function chosenDeck(body: string): string | null {
  try {
    const action = JSON.parse(body) as { type?: unknown; payload?: { deckId?: unknown } | null };
    return action.type === 'SET_DECK' && typeof action.payload?.deckId === 'string' ? action.payload.deckId : null;
  } catch {
    return null;
  }
}

/**
 * Records an offline game as the engine's worker plays it, for the rewards the server gives it once connected: every
 * body sent, in order, with the bot's moves made after it (the worker moves the bot between the player's actions; the
 * server replays this exact order), and, the moment the room reaches its post-game, the whole record with the
 * engine's result. Pure: the worker tells it what happens.
 */
export class GameRecorder {
  private readonly steps: RecordedStep[] = [];
  private postGame = false;

  constructor(
    private readonly config: LocalMatchConfig,
    private readonly startedAt: number,
  ) {}

  /** The player's action, as sent to the engine. */
  action(body: string): void {
    this.steps.push({ body, botMoves: 0 });
  }

  /** One move of the bot (a step that did something), after the last action. */
  botMoved(): void {
    const last = this.steps[this.steps.length - 1];
    if (last) last.botMoves++;
  }

  /**
   * After every action and move: the record when the room just reached its post-game (`status`), else null.
   * `result` is read only then (`LocalMatch.result()`).
   */
  check(status: string, result: () => string, now: number): FinishedGame | null {
    const ended = status === 'POST_GAME' && !this.postGame;
    this.postGame = status === 'POST_GAME';
    if (!ended) return null;
    const decks: Record<string, string[]> = {};
    for (const step of this.steps) {
      const deckId = chosenDeck(step.body);
      const spec = deckId ? this.config.decks[deckId] : undefined;
      if (deckId && spec && !decks[deckId]) decks[deckId] = deckCardIds(spec);
    }
    return {
      seed: this.config.seed ?? '0',
      botLevel: this.config.botLevel ?? null,
      userId: this.config.userId ?? LOCAL_USER_ID,
      startedAt: this.startedAt,
      endedAt: now,
      decks,
      actions: this.steps.map((s) => ({ ...s })),
      result: JSON.parse(result()) as MatchResult,
    };
  }
}
