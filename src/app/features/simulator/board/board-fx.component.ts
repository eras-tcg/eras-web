import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, afterRenderEffect, inject } from '@angular/core';
import { displayStrength, pileOf } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { GameEvent, GameState } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { BoardChoreography } from './board-choreography';
import { centerOf, fieldCard, pile, tableCard } from './board-dom';
import { CombatFx } from './combat-fx';
import { FxDraw } from './fx-draw';
import { HandRevealComponent } from './hand-reveal.component';
import { TimelineCursor } from './timeline-cursor';
import { TIMING } from './timing';

const RIVAL = 'var(--color-sim-rival)';
const MINE = 'var(--color-sim-link-mine)';
const THEIRS = 'var(--color-sim-link-rival)';
const GAIN = 'var(--color-success)';
const SPENT = 'var(--color-text-muted)';

/**
 * Small effects over the table.
 * Played before their update is shown (steps of BoardChoreography, drawn by CombatFx): an attack declared, a block,
 * the attacker's blow, an effect activated.
 * Drawn from what each update changed, once what started with it is over:
 * - an effect's target: a beam from the effect's card to each card (or pile) it chose;
 * - a creature's strength going up or down: "+2" / "−1" rising from it;
 * - gems gained or spent: the marker lights up and "+N" / "−N" rises from it;
 * - a deck shuffled: the deck shakes.
 * A card revealed from a hand turns over big (eras-hand-reveal). Nothing when the animations are off.
 */
@Component({
  selector: 'eras-board-fx',
  imports: [HandRevealComponent],
  template: `<eras-hand-reveal />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFxComponent {
  private readonly game = inject(GameStore);
  private readonly document = inject(DOCUMENT);
  private readonly animations = inject(BoardAnimations);
  private readonly choreography = inject(BoardChoreography);
  private readonly draw = new FxDraw(this.document, this.animations);
  private readonly combat = new CombatFx(this.document, this.animations, this.draw);
  private readonly timeline = new TimelineCursor();
  private strengths = new Map<string, number>();
  private gems = new Map<string, number>();
  private lastState: GameState | null = null;

  constructor() {
    afterRenderEffect({
      read: () => {
        const state = this.game.state();
        if (!state || state === this.lastState) return;
        const first = this.lastState === null;
        this.lastState = state;
        const events = this.timeline.fresh(state);
        // Joining, a jump through time, or nothing moving: only what the table is now is remembered
        if (first || this.game.jumped() || this.animations.still()) {
          this.remember(state);
          return;
        }
        // What this update did waits for anything that started with it (a chain link shown, a resolution)
        const strengths = this.strengths;
        const gems = this.gems;
        this.animations.whenIdle(() => {
          for (const e of events) {
            if (e.type === 'TARGET') this.targetBeams(state, e);
          }
          this.strengthFloats(state, strengths);
          this.gemFloats(state, gems);
          if (state.event === 'SHUFFLE_DECK' && state.actorId) this.draw.shake(pile(this.document, state.actorId, 'deck'));
        });
        this.remember(state);
      },
    });
    // Before an update is shown, on the table as it still is (BoardChoreography skips them all when nothing moves)
    this.choreography.register({
      charge: (attackerId, targetId, owner) => {
        const state = this.game.state();
        return state ? this.combat.charge(attackerId, targetId, owner, state) : Promise.resolve();
      },
      declare: (attackerId, targetId, defenderId, tap) => this.combat.declare(attackerId, targetId, defenderId, tap),
      block: (blockerId, tap) => this.combat.block(blockerId, tap),
      activate: (sourceId) => this.combat.activation(sourceId, this.game.state()),
    });
    inject(DestroyRef).onDestroy(() => this.draw.destroy());
  }

  private remember(state: GameState): void {
    const players = Object.values(state.players ?? {});
    this.strengths = new Map(players.flatMap((p) => p.field.filter((c) => c.cardType === 'creature').map((c) => [c.instanceId, displayStrength(c) ?? 0] as const)));
    this.gems = new Map(players.map((p) => [p.userId, p.resourceCount ?? 0] as const));
  }

  /** The center of a card on the table (field or hand) or of the pile it is in, on the screen. */
  private cardCenter(state: GameState, id: string | null | undefined): { x: number; y: number } | null {
    if (!id) return null;
    const onTable = tableCard(this.document, id);
    if (onTable) return centerOf(onTable);
    const where = pileOf(state, id);
    const element = where ? pile(this.document, where.ownerId, where.zone) : null;
    return element ? centerOf(element) : null;
  }

  /** An effect's card points at each card it chose. */
  private targetBeams(state: GameState, e: GameEvent): void {
    const link = e.effectId ? state.chain?.find((c) => c.id === e.effectId) : null;
    const from = this.cardCenter(state, link?.sourceInstanceId);
    if (!from) return;
    const ids = e.data?.targetIds ?? (e.cardInstanceId ? [e.cardInstanceId] : []);
    const color = e.playerId === this.game.myState()?.userId ? MINE : THEIRS;
    for (const id of ids) {
      const to = this.cardCenter(state, id);
      if (to && (Math.abs(to.x - from.x) > 4 || Math.abs(to.y - from.y) > 4)) this.draw.arrow(from, to, color, 4);
    }
  }

  private strengthFloats(state: GameState, strengths: Map<string, number>): void {
    for (const p of Object.values(state.players ?? {})) {
      for (const c of p.field) {
        const before = strengths.get(c.instanceId);
        if (before === undefined || c.cardType !== 'creature') continue;
        const now = displayStrength(c) ?? 0;
        if (now === before) continue;
        const card = fieldCard(this.document, c.instanceId);
        if (!card) continue;
        const at = centerOf(card);
        this.draw.float(at.x, at.y - 20, `${now > before ? '+' : '−'}${Math.abs(now - before)}`, now > before ? GAIN : RIVAL);
      }
    }
  }

  private gemFloats(state: GameState, gems: Map<string, number>): void {
    for (const p of Object.values(state.players ?? {})) {
      const before = gems.get(p.userId);
      const now = p.resourceCount ?? 0;
      if (before === undefined || now === before) continue;
      const pips = this.document.querySelector<HTMLElement>(`[data-gems="${p.userId}"]`);
      if (!pips) continue;
      const r = pips.getBoundingClientRect();
      const gained = now > before;
      this.draw.float(r.left + r.width / 2, r.top, `${gained ? '+' : '−'}${Math.abs(now - before)} ◆`, gained ? MINE : SPENT);
      pips.animate(
        gained
          ? [{ filter: 'drop-shadow(0 0 0 transparent)' }, { filter: `drop-shadow(0 0 10px ${MINE}) brightness(1.5)` }, { filter: 'drop-shadow(0 0 0 transparent)' }]
          : [{ filter: 'none' }, { filter: 'grayscale(1) brightness(0.6)' }, { filter: 'none' }],
        { duration: TIMING.float * 0.75, easing: 'ease-in-out' },
      );
    }
  }
}
