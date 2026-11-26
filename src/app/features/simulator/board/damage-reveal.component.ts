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
      <button
        type="button"
        class="reveal"
        [class.mine]="s.mine"
        [class.clash]="s.kind === 'clash'"
        aria-live="assertive"
        aria-label="Saltar la animación"
        (click)="skip()"
      >
        <div class="band">
          @if (s.kind === 'damage') {
            <figure class="side left">
              <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" [foil]="s.attacker?.finish ?? null" [name]="s.attacker?.cardName ?? null" />
              <figcaption>
                <strong>{{ s.attacker?.cardName ?? (s.byEffect ? 'Efecto' : 'Atacante') }}</strong>
                @if (s.byEffect) {
                  <small>Por efecto</small>
                }
              </figcaption>
            </figure>
            <div class="middle" [class.effect]="s.byEffect">
              <eras-icon [name]="s.byEffect ? 'zap' : 'sword'" />
              <strong>{{ s.damage }}</strong>
              <span>{{ s.byEffect ? 'de daño directo por efecto' : 'de daño directo' }}</span>
            </div>
            <figure class="side right big flip">
              <eras-game-card [imageUrl]="s.life?.imageUrl ?? null" [foil]="s.life?.finish ?? null" [name]="s.life?.cardName ?? null" />
              <figcaption>
                <strong>{{ s.defender }} pierde {{ s.life?.cardName ?? 'una vida' }}</strong>
                <small>{{ s.to === 'tributeZone' ? 'Va a sus tributos' : s.to === 'hand' ? 'Va a su mano' : '' }}</small>
              </figcaption>
            </figure>
          } @else {
            <figure class="side left" [class.loses]="s.attackerStrength <= s.blockerStrength">
              <eras-game-card [imageUrl]="s.attacker?.imageUrl ?? null" [foil]="s.attacker?.finish ?? null" [name]="s.attacker?.cardName ?? null" />
              <figcaption>
                <strong class="strength">{{ s.attackerStrength }}</strong>
                <strong>{{ s.attacker?.cardName ?? 'Atacante' }}</strong>
                @if (s.attackerStrength <= s.blockerStrength) {
                  <small class="destroyed">Destruida</small>
                }
              </figcaption>
            </figure>
            <div class="middle">
              <eras-icon name="sword" />
              <strong>VS</strong>
              <span>Enfrentamiento</span>
            </div>
            <figure class="side right" [class.loses]="s.blockerStrength <= s.attackerStrength">
              <eras-game-card [imageUrl]="s.blocker?.imageUrl ?? null" [foil]="s.blocker?.finish ?? null" [name]="s.blocker?.cardName ?? null" />
              <figcaption>
                <strong class="strength">{{ s.blockerStrength }}</strong>
                <strong>{{ s.blocker?.cardName ?? 'Bloqueador' }}</strong>
                @if (s.blockerStrength <= s.attackerStrength) {
                  <small class="destroyed">Destruida</small>
                }
              </figcaption>
            </figure>
          }
        </div>
        <small class="hint">Clic para continuar</small>
      </button>
    }
  `,
  styles: `
    /* The whole screen dims; a dark band crosses it with the combat, edged with light of its side's color */
    .reveal {
      --tone: var(--color-sim-rival);

      position: fixed;
      inset: 0;
      z-index: var(--z-sim-combat-reveal);
      display: grid;
      place-items: center;
      padding: 0;
      border: 0;
      background: radial-gradient(ellipse 90% 70% at 50% 50%, rgb(0 0 0 / 65%), rgb(0 0 0 / 35%) 75%, rgb(0 0 0 / 20%));
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
      animation: reveal var(--sim-combat-reveal, 2.6s) ease forwards;
    }
    .reveal.mine { --tone: var(--color-sim-ally); }
    .reveal:focus-visible { outline: none; }
    .reveal:focus-visible .band::before { block-size: 4px; }
    .band {
      --jolt-at: 0.55s;

      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: clamp(1.5rem, 6vw, 5rem);
      inline-size: 100%;
      padding-block: var(--space-6);
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--tone) 24%, rgb(6 8 18 / 94%)) 20%,
        color-mix(in srgb, var(--tone) 24%, rgb(6 8 18 / 94%)) 80%,
        transparent
      );
      animation:
        open 0.35s cubic-bezier(0.2, 0.8, 0.3, 1) both,
        jolt 0.38s cubic-bezier(0.2, 0.6, 0.4, 1) var(--jolt-at);
    }
    .clash .band { --jolt-at: 0.5s; }
    .band::before,
    .band::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      block-size: 2px;
      background: linear-gradient(90deg, transparent, var(--tone) 25%, #fff 50%, var(--tone) 75%, transparent);
      box-shadow: 0 0 14px 2px var(--tone);
    }
    .band::before { inset-block-start: 0; }
    .band::after { inset-block-end: 0; }
    .side { --game-card-width: clamp(7rem, 13vw, 10rem); display: grid; justify-items: center; gap: var(--space-2); max-inline-size: 14rem; margin: 0; text-align: center; }
    .side.big { --game-card-width: clamp(8.5rem, 16vw, 12.5rem); }
    .side eras-game-card { filter: drop-shadow(0 10px 18px rgb(0 0 0 / 60%)); }
    .side.big eras-game-card { filter: drop-shadow(0 0 22px var(--tone)) drop-shadow(0 10px 18px rgb(0 0 0 / 60%)); }
    figcaption { display: grid; justify-items: center; gap: var(--space-1); }
    figcaption strong { font-family: var(--font-family-display); font-size: var(--font-size-lg); line-height: 1.15; text-shadow: 0 2px 6px rgb(0 0 0 / 80%); }
    figcaption small { color: var(--color-text-muted); }
    figcaption .strength { color: #fff; font-size: 2.4rem; line-height: 1; text-shadow: 0 0 16px var(--tone), 0 3px 0 rgb(0 0 0 / 60%); }
    figcaption .destroyed { color: var(--color-sim-rival); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.08em; }
    .side.loses eras-game-card { filter: grayscale(0.8) brightness(0.55); transition: filter 0.4s ease 0.9s; }
    .middle { display: grid; justify-items: center; gap: var(--space-1); color: var(--tone); }
    .middle.effect { color: var(--color-sim-effect); }
    .middle eras-icon { inline-size: 2.5rem; block-size: 2.5rem; filter: drop-shadow(0 0 10px currentcolor); }
    .middle strong {
      color: #fff;
      font-family: var(--font-family-display);
      font-size: clamp(4rem, 9vw, 6.5rem);
      line-height: 1;
      text-shadow: 0 0 28px var(--tone), 0 4px 0 rgb(0 0 0 / 55%);
      animation: slam 0.45s cubic-bezier(0.6, 0, 0.9, 0.6) 0.15s backwards;
    }
    .middle.effect strong { text-shadow: 0 0 28px var(--color-sim-effect), 0 4px 0 rgb(0 0 0 / 55%); }
    .middle span { color: var(--color-text-muted); font-size: var(--font-size-sm); letter-spacing: 0.12em; text-transform: uppercase; }
    .clash .middle strong { animation-delay: 0.3s; }
    .flip eras-game-card { animation: flip-in 0.6s ease 0.3s backwards; }
    /* The attacker rushes in; in a clash both creatures rush in and collide */
    .side.left { animation: rush-left 0.55s cubic-bezier(0.6, 0, 0.9, 0.5) 0.05s backwards; }
    .clash .side.right { animation: rush-right 0.55s cubic-bezier(0.6, 0, 0.9, 0.5) 0.05s backwards; }
    .hint { position: absolute; inset-block-end: var(--space-4); inset-inline: 0; color: var(--color-text-muted); font-size: var(--font-size-xs); text-align: center; }
    @keyframes reveal {
      0% { opacity: 0; }
      8% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes open {
      from { clip-path: inset(50% 0); }
      to { clip-path: inset(-60% 0); }
    }
    @keyframes flip-in {
      from { transform: rotateY(90deg) scale(1.15); }
      70% { transform: rotateY(0) scale(1.08); filter: brightness(1.8) drop-shadow(0 0 22px var(--tone)); }
      to { transform: none; }
    }
    @keyframes slam {
      from { opacity: 0; scale: 2.6; }
      65% { opacity: 1; scale: 0.88; }
      to { scale: 1; }
    }
    @keyframes rush-left {
      from { opacity: 0; translate: -9rem 0; }
      80% { opacity: 1; translate: 0.8rem 0; }
      to { translate: 0 0; }
    }
    @keyframes rush-right {
      from { opacity: 0; translate: 9rem 0; }
      80% { opacity: 1; translate: -0.8rem 0; }
      to { translate: 0 0; }
    }
    @keyframes jolt {
      0%, 100% { translate: 0 0; }
      15% { translate: -6px 9px; }
      35% { translate: 8px -5px; }
      55% { translate: -5px 3px; }
      75% { translate: 3px -1px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .reveal, .band, .flip eras-game-card, .middle strong, .side { animation: none; }
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
