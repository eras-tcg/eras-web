import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { findSlot } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, GameEvent, GameState } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { BoardAnimations } from './board-animations';
import { BoardChoreography } from './board-choreography';
import { TIMING } from './timing';

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
  /** Dealt by an effect (Flarix…), not by an attacking creature. */
  byEffect: boolean;
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

/** Each one gets its own id: it is drawn anew, so its animation starts over even right after another one. */
type Shown = (Hit | Clash) & { id: number; done?: () => void };

/**
 * Combat, shown big: direct damage (the attacker, the damage and the revealed life) and clashes (both
 * creatures, their strength and which one is destroyed), when the combat reaches them (a step of
 * BoardChoreography, before their update is shown). One after another; a click skips the current one.
 */
@Component({
  selector: 'eras-damage-reveal',
  imports: [GameCardComponent, IconComponent],
  template: `
    @for (s of shown(); track s.id) {
      <button type="button" class="reveal" [class.mine]="s.mine" aria-live="assertive" aria-label="Saltar la animación" (click)="skip()">
        @if (s.kind === 'damage') {
          <div class="side">
            <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" [foil]="s.attacker?.finish ?? null" [name]="s.attacker?.cardName ?? null" />
            <span>{{ s.attacker?.cardName ?? (s.byEffect ? 'Efecto' : 'Atacante') }}</span>
            @if (s.byEffect) {
              <small>Por efecto</small>
            }
          </div>
          <div class="middle" [class.effect]="s.byEffect">
            <eras-icon [name]="s.byEffect ? 'zap' : 'sword'" />
            <strong>{{ s.damage }}</strong>
            <span>{{ s.byEffect ? 'de daño directo por efecto' : 'de daño directo' }}</span>
          </div>
          <div class="side big flip">
            <eras-game-card [imageUrl]="s.life?.imageUrl ?? null" [foil]="s.life?.finish ?? null" [name]="s.life?.cardName ?? null" />
            <span>{{ s.defender }} pierde {{ s.life?.cardName ?? 'una vida' }}</span>
            <small>{{ s.to === 'tributeZone' ? 'Va a sus tributos' : s.to === 'hand' ? 'Va a su mano' : '' }}</small>
          </div>
        } @else {
          <div class="side" [class.loses]="s.attackerStrength <= s.blockerStrength">
            <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" [foil]="s.attacker?.finish ?? null" [name]="s.attacker?.cardName ?? null" />
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
            <eras-game-card [imageUrl]="s.blocker?.imageUrl ?? null" [foil]="s.blocker?.finish ?? null" [name]="s.blocker?.cardName ?? null" />
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
      z-index: var(--z-sim-combat-reveal);
      display: flex;
      align-items: center;
      gap: var(--space-6);
      padding: var(--space-5) var(--space-6) var(--space-6);
      border: 2px solid var(--color-sim-rival);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: 0 0 40px 8px color-mix(in srgb, var(--color-sim-rival) 45%, transparent);
      color: inherit;
      font: inherit;
      transform: translate(-50%, -50%);
      cursor: pointer;
      animation: reveal var(--sim-combat-reveal, 2.6s) ease forwards;
    }
    .reveal.mine { border-color: var(--color-sim-ally); box-shadow: 0 0 40px 8px color-mix(in srgb, var(--color-sim-ally) 45%, transparent); }
    .reveal:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 4px; }
    .side { --game-card-width: 9rem; display: grid; justify-items: center; gap: var(--space-2); max-inline-size: 12rem; text-align: center; }
    .side.big { --game-card-width: 12rem; }
    .side span { font-weight: var(--font-weight-bold); }
    .side small { color: var(--color-text-muted); }
    .side.loses eras-game-card { filter: grayscale(0.8) brightness(0.6); transition: filter 0.4s ease 0.9s; }
    .strength { font-size: 2rem; line-height: 1; }
    .destroyed { color: var(--color-sim-rival) !important; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.06em; }
    .middle { display: grid; justify-items: center; gap: var(--space-1); color: var(--color-sim-rival); }
    .middle eras-icon { inline-size: 2.5rem; block-size: 2.5rem; }
    .middle.effect { color: var(--color-sim-effect); }
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
  private readonly choreography = inject(BoardChoreography);
  protected readonly current = signal<Shown | null>(null);
  protected readonly shown = computed(() => {
    const current = this.current();
    return current ? [current] : [];
  });
  private ids = 0;
  private readonly queue: Shown[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The choices wait while one is shown. */
  private release: (() => void) | null = null;

  constructor() {
    // Before an update is shown: its combat is shown big, and the next step waits until it goes
    this.choreography.register({
      reveal: (next, e) =>
        new Promise<void>((done) => {
          this.queue.push({ ...(e.type === 'CLASH' ? this.clash(next, e) : this.hit(next, e)), id: ++this.ids, done });
          this.release ??= this.animations.begin();
          if (!this.current() && !this.timer) this.next();
        }),
    });
  }

  /** A click skips the one being shown. */
  protected skip(): void {
    if (this.timer) clearTimeout(this.timer);
    this.next();
  }

  /** The cards of a combat, wherever they are now (the deck too: Flarix pays with itself to the bottom of it). */
  private hit(state: GameState, e: GameEvent): Hit {
    const defenderId = e.data?.defenderId;
    return {
      kind: 'damage',
      attacker: findSlot(state, e.data?.attackerId),
      life: findSlot(state, e.cardInstanceId),
      damage: Number(e.data?.damage ?? 0),
      defender: (defenderId && state.players?.[defenderId]?.username) || 'El rival',
      to: e.toZone,
      mine: defenderId !== this.game.myState()?.userId,
      byEffect: !!e.effectId,
    };
  }

  private clash(state: GameState, e: GameEvent): Clash {
    return {
      kind: 'clash',
      attacker: findSlot(state, e.cardInstanceId),
      blocker: findSlot(state, e.data?.blockerId),
      attackerStrength: Number(e.data?.attackerStrength ?? 0),
      blockerStrength: Number(e.data?.blockerStrength ?? 0),
      mine: e.playerId === this.game.myState()?.userId,
    };
  }

  private next(): void {
    this.current()?.done?.();
    const shown = this.queue.shift() ?? null;
    this.current.set(shown);
    if (shown) {
      this.timer = setTimeout(() => this.next(), TIMING.combatReveal);
    } else {
      this.timer = null;
      this.release?.();
      this.release = null;
    }
  }
}
