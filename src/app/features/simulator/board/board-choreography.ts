import { Injectable, inject } from '@angular/core';
import { GameEvent, GameState } from '@data/simulator/simulator.model';
import { lastSeq, playsTimeline } from '@data/simulator/game-rules';
import { isTimeJump } from '@data/simulator/update-queue';
import { BoardAnimations } from './board-animations';
import { TIMING } from './timing';

/** The steps of the board's animations that play before an update is shown (each registered by its component). */
export interface ChoreographySteps {
  /**
   * An attack declared: a sword rises over the attacker (exhausted with it, `tap`), and an arrow points at what it
   * attacks (a creature, else the defender's lives).
   */
  declare(attackerId: string, targetId: string | null, defenderId: string | null, tap: boolean): Promise<void>;
  /** A block declared: a shield over the blocker, which is exhausted with it (`tap`). */
  block(blockerId: string, tap: boolean): Promise<void>;
  /** An effect activated: its card lights up where it lies, a white aura spreading from it. */
  activate(sourceId: string, playerId: string | null): Promise<void>;
  /** The chain as it is in the next update: links joining it or resolving, shown big; done when all have gone. */
  chain(next: GameState): Promise<void>;
  /** The attacker strikes what it hits (a creature, else the defender's lives); done when the blow lands. */
  charge(attackerId: string, targetId: string | null, attackerOwner: string | null): Promise<void>;
  /** The combat shown big (a clash, or direct damage with the life lost) from the next update; done when it goes. */
  reveal(next: GameState, event: GameEvent): Promise<void>;
  /** A card breaks where it lies (destroyed); done when it is gone. */
  shatter(instanceId: string): Promise<void>;
  /** The life lost turns face up on top of the lives and stays there until the update is shown (then it flies). */
  showLife(ownerId: string, lifeId: string, next: GameState): void;
}

/** Events that play before their update is shown. */
const PLAYED = new Set(['ATTACK_DECLARED', 'BLOCK', 'CLASH', 'LIFE_DAMAGE', 'DESTROY', 'SACRIFICE', 'EFFECT_ACTIVATED']);

/**
 * One animation at a time: what an update does is played on the table as it still is, step by step, before the update
 * is shown. An effect activated lights its card up. An attack declared raises a sword over the attacker and points at
 * its target; a moment later a block raises a shield over the blocker (each exhausted with its mark). The blow comes
 * when the combat reaches the clash or the direct damage (the attacker strikes, then the combat is shown big), then
 * what it destroys breaks where it lies, and the life it took turns face up on top of the lives; a moment later the
 * update is shown: the cards go to their zones (cards flying there) and the field settles. A card destroyed by an
 * effect breaks first the same way.
 */
@Injectable()
export class BoardChoreography {
  private readonly animations = inject(BoardAnimations);
  private steps: Partial<ChoreographySteps> = {};
  /** Events already played before their update: the components do not play them again once it is shown. */
  private readonly played = new Set<number>();
  /** Lives shown face up on their pile: they fly from there face up. */
  readonly revealedLives = new Set<string>();

  /** A component brings its step. */
  register(steps: Partial<ChoreographySteps>): void {
    this.steps = { ...this.steps, ...steps };
  }

  /** It was played before its update was shown. */
  wasPlayed(event: GameEvent): boolean {
    return this.played.has(event.seq);
  }

  /** A new game (or room): nothing of the last one counts as played. */
  forget(): void {
    this.played.clear();
    this.revealedLives.clear();
  }

  /** What to play before `next` is shown, on the table showing `now`; null: nothing. */
  prelude(now: GameState, next: GameState): Promise<void> | null {
    const seen = lastSeq(now);
    // A new game starts a new timeline (its numbers start over): what was played is forgotten
    if (lastSeq(next) < seen || next.roomId !== now.roomId) this.forget();
    // A jump through time (more than one move at once) shows where it lands, without playing what lies between;
    // one step (a replay going on, a test room's ▶) plays as the game did
    if (this.animations.still() || isTimeJump(now.timelineAt, next) || !playsTimeline(now.status) || !playsTimeline(next.status)) return null;
    const fresh = (next.timeline ?? []).filter((e) => e.seq > seen);
    // Destroyed in any zone (a sacrifice is one too): it breaks where it lies, then the update moves it
    const broken = fresh.filter((e) => (e.type === 'DESTROY' || e.type === 'SACRIFICE') && !!e.cardInstanceId);
    if (!fresh.some((e) => PLAYED.has(e.type)) && chainOf(now) === chainOf(next)) return null;
    return this.play(now, next, fresh, broken);
  }

  /**
   * A field card upright now that this declaration exhausts: a block always does, an attack when it is not made by an
   * effect ("exhausted"). Seen in the next update only while the card is still there (a blocker destroyed in the clash
   * is not).
   */
  private tapsNow(now: GameState, e: GameEvent): boolean {
    const card = Object.values(now.players ?? {}).flatMap((p) => p.field).find((c) => c.instanceId === e.cardInstanceId);
    if (!card || card.tapped) return false;
    return e.type === 'BLOCK' || e.data?.exhausted === true;
  }

  private async play(now: GameState, next: GameState, fresh: GameEvent[], broken: GameEvent[]): Promise<void> {
    const release = this.animations.begin();
    const shattered = new Set<string>();
    const breakAfter = async (seq: number) => {
      const due = broken.filter((d) => d.seq > seq && !shattered.has(d.cardInstanceId!));
      due.forEach((d) => shattered.add(d.cardInstanceId!));
      await Promise.all(due.map((d) => this.steps.shatter?.(d.cardInstanceId!) ?? Promise.resolve()));
      due.forEach((d) => this.played.add(d.seq));
    };
    try {
      // The effects activated light their cards up, then the chain shows them joining (or resolving): what they do
      // comes after
      for (const e of fresh.filter((f) => f.type === 'EFFECT_ACTIVATED')) {
        this.played.add(e.seq);
        const source = e.data?.sourceId;
        if (source) await this.steps.activate?.(source, e.playerId);
      }
      await this.steps.chain?.(next);
      for (const e of fresh) {
        // Declared in this same update (a bot's quick attack): the declaration, then the block, then the blow
        if (e.type === 'ATTACK_DECLARED' && e.cardInstanceId) {
          this.played.add(e.seq);
          const defender = Object.keys(now.players ?? {}).find((id) => id !== e.playerId) ?? null;
          await this.steps.declare?.(e.cardInstanceId, e.data?.targetId ?? null, defender, this.tapsNow(now, e));
          // The defender's moment to answer, before the block or the blow (also when the block comes in the next update:
          // it is shown no sooner)
          await wait(TIMING.beforeBlock);
        } else if (e.type === 'BLOCK' && e.cardInstanceId) {
          this.played.add(e.seq);
          await this.steps.block?.(e.cardInstanceId, this.tapsNow(now, e));
        } else if (e.type === 'CLASH') {
          this.played.add(e.seq);
          await this.steps.charge?.(e.cardInstanceId!, e.data?.blockerId ?? null, e.playerId);
          await this.steps.reveal?.(next, e);
          await breakAfter(e.seq);
        } else if (e.type === 'LIFE_DAMAGE') {
          this.played.add(e.seq);
          const attackerId = e.data?.attackerId;
          const defenderId = e.data?.defenderId;
          if (attackerId && !e.effectId) {
            const owner = Object.keys(now.players ?? {}).find((id) => id !== defenderId) ?? null;
            await this.steps.charge?.(attackerId, null, owner);
          }
          if (defenderId && e.cardInstanceId) {
            this.revealedLives.add(e.cardInstanceId);
            this.steps.showLife?.(defenderId, e.cardInstanceId, next);
          }
          await this.steps.reveal?.(next, e);
        }
      }
      // What an effect destroyed (no combat): it breaks where it lies
      await breakAfter(-1);
      // A moment with the destroyed gone, before the field settles
      if (shattered.size) await wait(TIMING.beforeSettle);
    } finally {
      release();
    }
  }
}

/** The chain's links and which are resolving: changes when one joins, starts resolving or leaves. */
function chainOf(state: GameState): string {
  return (state.chain ?? []).map((e) => `${e.id}:${e.resolutionId ? 1 : 0}`).join(',');
}

function wait(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}
