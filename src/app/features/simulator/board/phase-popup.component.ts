import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { BoardAnimations } from './board-animations';

const PHASE_LABELS: Record<string, string> = { START: 'Inicio de turno', MAIN: 'Fase principal', END: 'Fase final', END_PHASE: 'Fase final' };
/** How long each pop-up stays (its animation lasts as long). */
const POPUP_MS = 1300;

interface PhasePopup {
  who: string;
  phase: string;
  mine: boolean;
}

/** A short pop-up in the middle of the screen when the turn or the phase changes, one after another. */
@Component({
  selector: 'eras-phase-popup',
  template: `
    @if (popup(); as popup) {
      <div class="phase-popup" [class.rival]="!popup.mine" role="status" aria-live="polite">
        <span class="who">{{ popup.who }}</span>
        <strong>{{ popup.phase }}</strong>
      </div>
    }
  `,
  styles: `
    .phase-popup {
      position: fixed;
      inset-block-start: 40%;
      inset-inline-start: 50%;
      z-index: 30;
      display: grid;
      justify-items: center;
      gap: var(--space-1);
      padding: var(--space-4) var(--space-6);
      border: 2px solid var(--color-sim-ally);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-surface) 92%, transparent);
      box-shadow: 0 0 32px 6px color-mix(in srgb, var(--color-sim-ally) 45%, transparent);
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: phase-popup 1.3s ease forwards;
    }

    .phase-popup.rival {
      border-color: var(--color-sim-rival);
      box-shadow: 0 0 32px 6px color-mix(in srgb, var(--color-sim-rival) 45%, transparent);
    }

    .phase-popup .who {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .phase-popup strong {
      font-size: var(--font-size-2xl, 1.75rem);
    }

    @keyframes phase-popup {
      0% { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
      15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }

    // Animations off (the table's switch) or reduced motion: shown still
    :host-context(.no-animations) .phase-popup {
      animation: none !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .phase-popup {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhasePopupComponent {
  private readonly game = inject(GameStore);
  private readonly animations = inject(BoardAnimations);

  protected readonly popup = signal<PhasePopup | null>(null);
  private readonly queue: PhasePopup[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
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
      const newTurn = this.lastTurn !== null && this.lastTurn !== s.currentTurnUserId;
      this.lastPhase = key;
      this.lastTurn = s.currentTurnUserId;
      if (first) return;
      const mine = s.currentTurnUserId === this.game.myState()?.userId;
      const name = s.players?.[s.currentTurnUserId]?.username ?? 'Rival';
      const who = mine ? 'Tu turno' : 'Turno de ' + name;
      untracked(() => {
        if (this.animations.off()) return;
        // A new turn always shows its start, even when it went straight on to the main phase
        if (newTurn && s.currentPhase !== 'START') this.queue.push({ who, phase: PHASE_LABELS['START'], mine });
        this.queue.push({ who, phase: PHASE_LABELS[s.currentPhase ?? 'MAIN'] ?? s.currentPhase ?? '', mine });
        if (!this.timer) this.next();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private next(): void {
    const popup = this.queue.shift() ?? null;
    this.popup.set(popup);
    this.timer = popup ? setTimeout(() => this.next(), POPUP_MS) : null;
  }
}
