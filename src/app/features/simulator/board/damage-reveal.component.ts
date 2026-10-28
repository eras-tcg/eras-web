import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, GameEvent, GameState } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { BoardAnimations } from './board-animations';

interface Hit {
  seq: number;
  attacker: CardSlot | null;
  life: CardSlot | null;
  damage: number;
  defender: string;
  /** Where the life went: "tributeZone" or "hand". */
  to: string | null;
  mine: boolean;
}

const SHOW_MS = 2600;

/**
 * Direct damage, shown big: the attacking card, how much damage it deals and the life card it reveals, with
 * where that life goes. Several hits (Letalidad) are shown one after another.
 */
@Component({
  selector: 'eras-damage-reveal',
  imports: [GameCardComponent, IconComponent],
  template: `
    @if (current(); as h) {
      <div class="reveal" [class.mine]="h.mine" role="status" aria-live="assertive">
        <div class="side">
          <eras-game-card [imageUrl]="h.attacker?.imageUrl ?? null" />
          <span>{{ h.attacker?.cardName ?? 'Atacante' }}</span>
        </div>
        <div class="damage">
          <eras-icon name="sword" />
          <strong>{{ h.damage }}</strong>
          <span>de daño directo</span>
        </div>
        <div class="side life">
          <eras-game-card [imageUrl]="h.life?.imageUrl ?? null" />
          <span>{{ h.defender }} pierde {{ h.life?.cardName ?? 'una vida' }}</span>
          <small>{{ h.to === 'tributeZone' ? 'Va a sus tributos' : h.to === 'hand' ? 'Va a su mano' : '' }}</small>
        </div>
      </div>
    }
  `,
  styles: `
    .reveal {
      position: fixed;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      z-index: 35;
      display: flex;
      align-items: center;
      gap: var(--space-6);
      padding: var(--space-5) var(--space-6);
      border: 2px solid #ef4444;
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-surface) 94%, transparent);
      box-shadow: 0 0 40px 8px rgb(239 68 68 / 45%);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: reveal 2.6s ease forwards;
    }
    .reveal.mine { border-color: #3b82f6; box-shadow: 0 0 40px 8px rgb(59 130 246 / 45%); }
    .side { --game-card-width: 9rem; display: grid; justify-items: center; gap: var(--space-2); max-inline-size: 12rem; text-align: center; }
    .side.life { --game-card-width: 12rem; }
    .side span { font-weight: var(--font-weight-bold); }
    .side small { color: var(--color-text-muted); }
    .damage { display: grid; justify-items: center; gap: var(--space-1); color: #ef4444; }
    .damage eras-icon { inline-size: 2.5rem; block-size: 2.5rem; }
    .damage strong { font-size: 3.5rem; line-height: 1; }
    .damage span { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .life eras-game-card { animation: flip-in 0.6s ease 0.3s backwards; }
    @keyframes reveal {
      0% { opacity: 0; transform: translate(-50%, -45%) scale(0.92); }
      12% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes flip-in { from { transform: rotateY(90deg); } }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .life eras-game-card { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DamageRevealComponent {
  private readonly game = inject(GameStore);
  private readonly animations = inject(BoardAnimations);
  protected readonly current = signal<Hit | null>(null);
  private readonly queue: Hit[] = [];
  private lastSeq: number | null = null;

  constructor() {
    effect(() => {
      const state = this.game.state();
      untracked(() => this.collect(state));
    });
  }

  /** New direct damage events (not the ones already there when joining). */
  private collect(state: GameState | null): void {
    const timeline = state?.timeline ?? [];
    const maxSeq = timeline.reduce((m, e) => Math.max(m, e.seq), 0);
    if (this.lastSeq === null || state?.status !== 'IN_PROGRESS' && state?.status !== 'POST_GAME') {
      this.lastSeq = maxSeq;
      return;
    }
    const hits = timeline.filter((e) => e.type === 'LIFE_DAMAGE' && e.seq > (this.lastSeq ?? 0));
    this.lastSeq = Math.max(this.lastSeq, maxSeq);
    if (!hits.length || !state) return;
    for (const e of hits) this.queue.push(this.hit(state, e));
    // The choices wait for all of them
    this.animations.hold(SHOW_MS * hits.length);
    if (!this.current()) this.next();
  }

  private hit(state: GameState, e: GameEvent): Hit {
    const all = Object.values(state.players ?? {}).flatMap((p) => [...p.field, ...p.hand, ...p.tributeZone, ...p.discardPile, ...p.lifeStack]);
    const find = (id: unknown) => all.find((c) => c.instanceId === id) ?? null;
    const defenderId = e.data?.['defenderId'] as string | undefined;
    return {
      seq: e.seq,
      attacker: find(e.data?.['attackerId']),
      life: find(e.cardInstanceId),
      damage: Number(e.data?.['damage'] ?? 0),
      defender: (defenderId && state.players?.[defenderId]?.username) || 'El rival',
      to: e.toZone,
      mine: defenderId !== this.game.myState()?.userId,
    };
  }

  private next(): void {
    const hit = this.queue.shift() ?? null;
    this.current.set(hit);
    if (hit) setTimeout(() => this.next(), SHOW_MS);
  }
}
