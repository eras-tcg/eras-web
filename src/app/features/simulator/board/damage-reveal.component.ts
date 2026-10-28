import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, GameEvent, GameState } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { BoardAnimations } from './board-animations';

/** Direct damage to a life. */
interface Hit {
  kind: 'damage';
  attacker: CardSlot | null;
  life: CardSlot | null;
  damage: number;
  defender: string;
  /** Where the life went: "tributeZone" or "hand". */
  to: string | null;
  mine: boolean;
}

/** Two creatures clashing. */
interface Clash {
  kind: 'clash';
  attacker: CardSlot | null;
  blocker: CardSlot | null;
  attackerStrength: number;
  blockerStrength: number;
  mine: boolean;
}

type Shown = Hit | Clash;

const SHOW_MS = 2600;

/**
 * Combat, shown big: direct damage (the attacker, the damage and the revealed life) and clashes (both
 * creatures, their strength and which one is destroyed). One after another; a click skips the current one.
 */
@Component({
  selector: 'eras-damage-reveal',
  imports: [GameCardComponent, IconComponent],
  template: `
    @if (current(); as s) {
      <button type="button" class="reveal" [class.mine]="s.mine" aria-live="assertive" aria-label="Saltar la animación" (click)="skip()">
        @if (s.kind === 'damage') {
          <div class="side">
            <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" />
            <span>{{ s.attacker?.cardName ?? 'Atacante' }}</span>
          </div>
          <div class="middle">
            <eras-icon name="sword" />
            <strong>{{ s.damage }}</strong>
            <span>de daño directo</span>
          </div>
          <div class="side big flip">
            <eras-game-card [imageUrl]="s.life?.imageUrl ?? null" />
            <span>{{ s.defender }} pierde {{ s.life?.cardName ?? 'una vida' }}</span>
            <small>{{ s.to === 'tributeZone' ? 'Va a sus tributos' : s.to === 'hand' ? 'Va a su mano' : '' }}</small>
          </div>
        } @else {
          <div class="side" [class.loses]="s.attackerStrength <= s.blockerStrength">
            <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" />
            <span>{{ s.attacker?.cardName ?? 'Atacante' }}</span>
            <strong class="strength">{{ s.attackerStrength }}</strong>
            @if (s.attackerStrength <= s.blockerStrength) {
              <small class="destroyed">Destruida</small>
            }
          </div>
          <div class="middle">
            <eras-icon name="sword" />
            <strong>VS</strong>
            <span>Enfrentamiento</span>
          </div>
          <div class="side" [class.loses]="s.blockerStrength <= s.attackerStrength">
            <eras-game-card [imageUrl]="s.blocker?.imageUrl ?? null" />
            <span>{{ s.blocker?.cardName ?? 'Bloqueador' }}</span>
            <strong class="strength">{{ s.blockerStrength }}</strong>
            @if (s.blockerStrength <= s.attackerStrength) {
              <small class="destroyed">Destruida</small>
            }
          </div>
        }
        <small class="hint">Clic para continuar</small>
      </button>
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
      padding: var(--space-5) var(--space-6) var(--space-6);
      border: 2px solid #ef4444;
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: 0 0 40px 8px rgb(239 68 68 / 45%);
      color: inherit;
      font: inherit;
      transform: translate(-50%, -50%);
      cursor: pointer;
      animation: reveal 2.6s ease forwards;
    }
    .reveal.mine { border-color: #3b82f6; box-shadow: 0 0 40px 8px rgb(59 130 246 / 45%); }
    .reveal:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 4px; }
    .side { --game-card-width: 9rem; display: grid; justify-items: center; gap: var(--space-2); max-inline-size: 12rem; text-align: center; }
    .side.big { --game-card-width: 12rem; }
    .side span { font-weight: var(--font-weight-bold); }
    .side small { color: var(--color-text-muted); }
    .side.loses eras-game-card { filter: grayscale(0.8) brightness(0.6); transition: filter 0.4s ease 0.9s; }
    .strength { font-size: 2rem; line-height: 1; }
    .destroyed { color: #ef4444 !important; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.06em; }
    .middle { display: grid; justify-items: center; gap: var(--space-1); color: #ef4444; }
    .middle eras-icon { inline-size: 2.5rem; block-size: 2.5rem; }
    .middle strong { font-size: 3.5rem; line-height: 1; }
    .middle span { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .flip eras-game-card { animation: flip-in 0.6s ease 0.3s backwards; }
    .hint { position: absolute; inset-block-end: var(--space-2); inset-inline: 0; color: var(--color-text-muted); font-size: var(--font-size-xs); text-align: center; }
    @keyframes reveal {
      0% { opacity: 0; transform: translate(-50%, -45%) scale(0.92); }
      12% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes flip-in { from { transform: rotateY(90deg); } }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .flip eras-game-card { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DamageRevealComponent {
  private readonly game = inject(GameStore);
  private readonly animations = inject(BoardAnimations);
  protected readonly current = signal<Shown | null>(null);
  private readonly queue: Shown[] = [];
  private lastSeq: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Releases the choices once everything queued has been shown. */
  private release: (() => void) | null = null;

  constructor() {
    effect(() => {
      const state = this.game.state();
      untracked(() => this.collect(state));
    });
  }

  /** A click skips the one being shown. */
  protected skip(): void {
    if (this.timer) clearTimeout(this.timer);
    this.next();
  }

  /** New combat events (not the ones already there when joining). */
  private collect(state: GameState | null): void {
    const timeline = state?.timeline ?? [];
    const maxSeq = timeline.reduce((m, e) => Math.max(m, e.seq), 0);
    const playing = state?.status === 'IN_PROGRESS' || state?.status === 'POST_GAME';
    if (this.lastSeq === null || !playing) {
      this.lastSeq = maxSeq;
      return;
    }
    const events = timeline.filter((e) => (e.type === 'LIFE_DAMAGE' || e.type === 'CLASH') && e.seq > (this.lastSeq ?? 0));
    this.lastSeq = Math.max(this.lastSeq, maxSeq);
    if (!events.length || !state) return;
    for (const e of events) this.queue.push(e.type === 'CLASH' ? this.clash(state, e) : this.hit(state, e));
    // The choices wait until all of them have been shown
    this.release ??= this.animations.begin();
    if (!this.current()) this.next();
  }

  private finder(state: GameState): (id: unknown) => CardSlot | null {
    const all = Object.values(state.players ?? {}).flatMap((p) => [...p.field, ...p.hand, ...p.tributeZone, ...p.discardPile, ...p.lifeStack]);
    return (id) => all.find((c) => c.instanceId === id) ?? null;
  }

  private hit(state: GameState, e: GameEvent): Hit {
    const find = this.finder(state);
    const defenderId = e.data?.['defenderId'] as string | undefined;
    return {
      kind: 'damage',
      attacker: find(e.data?.['attackerId']),
      life: find(e.cardInstanceId),
      damage: Number(e.data?.['damage'] ?? 0),
      defender: (defenderId && state.players?.[defenderId]?.username) || 'El rival',
      to: e.toZone,
      mine: defenderId !== this.game.myState()?.userId,
    };
  }

  private clash(state: GameState, e: GameEvent): Clash {
    const find = this.finder(state);
    return {
      kind: 'clash',
      attacker: find(e.cardInstanceId),
      blocker: find(e.data?.['blockerId']),
      attackerStrength: Number(e.data?.['attackerStrength'] ?? 0),
      blockerStrength: Number(e.data?.['blockerStrength'] ?? 0),
      mine: e.playerId === this.game.myState()?.userId,
    };
  }

  private next(): void {
    const shown = this.queue.shift() ?? null;
    this.current.set(shown);
    if (shown) {
      this.timer = setTimeout(() => this.next(), SHOW_MS);
    } else {
      this.timer = null;
      this.release?.();
      this.release = null;
    }
  }
}
