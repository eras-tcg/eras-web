import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { BoardAnimations } from './board-animations';
import { TIMING } from './timing';

const PHASE_LABELS: Record<string, string> = { START: 'Inicio de turno', MAIN: 'Fase principal', END: 'Fase final', END_PHASE: 'Fase final' };

interface PhasePopup {
  who: string;
  phase: string;
  mine: boolean;
  /** Each one gets its own id: it is drawn anew, so its animation starts over even right after another one. */
  id: number;
  /** A new turn's main phase: shown once what its start does (its draw) has played. */
  afterStart: boolean;
}

/**
 * The turn or the phase changing, shown big across the table as the combat is: a band opens over the middle of the
 * screen, the player whose turn it is above, the phase sweeping in, and it closes. One after another, in the order of
 * the turn: the final phase of the turn that ends, the start of the next, what that start does (its draw), then its
 * main phase. What the table does meanwhile and the engine's next choices wait for them.
 */
@Component({
  selector: 'eras-phase-popup',
  template: `
    @for (p of shown(); track p.id) {
      <div class="phase" [class.rival]="!p.mine" role="status" aria-live="polite">
        <div class="band">
          <span class="who">{{ p.who }}</span>
          <strong>{{ p.phase }}</strong>
          <i class="sweep"></i>
        </div>
      </div>
    }
  `,
  styles: `
    .phase {
      --tone: var(--color-sim-ally);

      position: fixed;
      inset: 0;
      z-index: var(--z-sim-combat-reveal);
      display: grid;
      place-items: center;
      pointer-events: none;
      background: radial-gradient(ellipse 90% 45% at 50% 50%, rgb(0 0 0 / 45%), transparent 75%);
      animation: phase-fade var(--sim-phase-show, 1.7s) ease forwards;
    }
    .phase.rival { --tone: var(--color-sim-rival); }
    .band {
      position: relative;
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      inline-size: 100%;
      padding-block: var(--space-5);
      overflow: hidden;
      background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, var(--tone) 22%, rgb(6 8 18 / 92%)) 22%,
        color-mix(in srgb, var(--tone) 22%, rgb(6 8 18 / 92%)) 78%,
        transparent
      );
      animation: phase-band var(--sim-phase-show, 1.7s) cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
    }
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
    .who {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      animation: phase-who 0.5s ease 0.15s backwards;
    }
    strong {
      color: #fff;
      font-family: var(--font-family-display);
      font-size: clamp(2.2rem, 5vw, 3.5rem);
      line-height: 1;
      text-shadow: 0 0 22px var(--tone), 0 3px 0 rgb(0 0 0 / 55%);
      animation: phase-name 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) 0.2s backwards;
    }
    /* A gleam crossing the band once the name is in */
    .sweep {
      position: absolute;
      inset-block: 0;
      inline-size: 30%;
      background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%), transparent);
      animation: phase-sweep 0.7s ease-in-out 0.45s backwards;
      translate: -150% 0;
    }
    @keyframes phase-fade {
      0% { opacity: 0; }
      10% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes phase-band {
      0% { clip-path: inset(50% 0); }
      18% { clip-path: inset(0 0); }
      82% { clip-path: inset(0 0); }
      100% { clip-path: inset(50% 0); }
    }
    @keyframes phase-who {
      from { opacity: 0; translate: -3rem 0; }
    }
    @keyframes phase-name {
      from { opacity: 0; translate: 5rem 0; letter-spacing: 0.3em; filter: blur(4px); }
      60% { opacity: 1; filter: blur(0); }
    }
    @keyframes phase-sweep {
      from { translate: -150% 0; }
      to { translate: 450% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .phase, .band, .who, strong, .sweep { animation: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhasePopupComponent {
  private readonly game = inject(GameStore);
  private readonly animations = inject(BoardAnimations);

  private readonly current = signal<PhasePopup | null>(null);
  protected readonly shown = computed(() => {
    const c = this.current();
    return c ? [c] : [];
  });
  private readonly queue: PhasePopup[] = [];
  private ids = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Showing them (or waiting to show the next one): new ones join the queue. */
  private active = false;
  /** The board's animations wait while one shows. */
  private release: (() => void) | null = null;
  private lastPhase: string | null = null;
  private lastTurn: string | null = null;

  constructor() {
    effect(() => {
      const s = this.game.state();
      if (s?.status !== 'IN_PROGRESS' || !s.currentTurnUserId) {
        this.lastPhase = null;
        return;
      }
      const key = s.currentTurnUserId + '|' + s.currentPhase;
      const first = this.lastPhase === null;
      if (key === this.lastPhase) return;
      const was = this.lastPhase?.split('|')[1] ?? null;
      const before = this.lastTurn;
      const newTurn = before !== null && before !== s.currentTurnUserId;
      this.lastPhase = key;
      this.lastTurn = s.currentTurnUserId;
      if (first) return;
      const me = this.game.myState()?.userId;
      const whoOf = (id: string) => (id === me ? 'Tu turno' : 'Turno de ' + (s.players?.[id]?.username ?? 'Rival'));
      const turn = s.currentTurnUserId;
      const phase = s.currentPhase ?? 'MAIN';
      untracked(() => {
        if (this.animations.off()) return;
        const add = (id: string, p: string, afterStart = false) =>
          this.queue.push({ who: whoOf(id), phase: PHASE_LABELS[p] ?? p, mine: id === me, id: ++this.ids, afterStart });
        if (newTurn) {
          // The turn that ends shows its final phase, though the update went straight on to the next turn
          if (was !== 'END' && was !== 'END_PHASE' && before) add(before, 'END');
          // The new one always shows its start; its main phase only once what the start does has played (its draw)
          add(turn, 'START');
          if (phase !== 'START') add(turn, phase, true);
        } else add(turn, phase, was === 'START' && phase === 'MAIN');
        if (this.active) return;
        this.active = true;
        // At once: what this update does on the table (cards drawn flying) waits for it
        this.release ??= this.animations.begin();
        this.next();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
      this.release?.();
    });
  }

  private next(): void {
    this.timer = null;
    const popup = this.queue.shift() ?? null;
    if (!popup) {
      this.current.set(null);
      this.active = false;
      this.release?.();
      this.release = null;
      return;
    }
    if (!popup.afterStart) return this.show(popup);
    // The main phase of a new turn: once what its start does has played (the draw, which waits for the pop-ups before)
    this.current.set(null);
    const go = (): void => {
      if (!this.animations.idle()) return this.animations.whenIdle(go);
      this.release ??= this.animations.begin();
      this.show(popup);
    };
    // Asked before letting go, so what was waiting for the pop-ups starts first
    this.animations.whenIdle(go);
    this.release?.();
    this.release = null;
  }

  private show(popup: PhasePopup): void {
    this.current.set(popup);
    this.timer = setTimeout(() => this.next(), TIMING.phaseShow);
  }
}
