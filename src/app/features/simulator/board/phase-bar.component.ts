import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';

/**
 * The phases of the turn, in the table's middle strip. They are its controls: on your turn, the next phase you can
 * go to is a button.
 * Phones in landscape: one button with the current phase; on your turn, tapping it unfolds to its left the phases
 * you can go to next (choosing one goes there, tapping the current one again folds them).
 */
@Component({
  selector: 'eras-phase-bar',
  template: `
    <div class="compact">
      @if (open()) {
        <div class="choices" role="group" aria-label="Ir a la fase">
          @for (p of nextPhases(); track p.id) {
            <button type="button" class="choice" (click)="goTo(p.id); open.set(false)">{{ p.choice }}</button>
          }
        </div>
      }
      <button
        type="button"
        class="current-phase"
        [class.mine]="game.isMyTurn()"
        [class.can]="nextPhases().length > 0"
        [attr.aria-expanded]="nextPhases().length ? open() : null"
        [attr.aria-label]="'Fase ' + currentLabel()"
        (click)="nextPhases().length && open.set(!open())"
      >{{ currentLabel() }}@if (nextPhases().length) {<span class="caret" aria-hidden="true">{{ open() ? '›' : '‹' }}</span>}</button>
    </div>

    <ol class="phases" aria-label="Fases del turno">
      @for (p of phases; track p.id) {
        <li>
          <button
            type="button"
            [class.current]="currentPhase() === p.id"
            [class.mine]="game.isMyTurn()"
            [class.next]="canGoTo(p.id)"
            [disabled]="!canGoTo(p.id)"
            [attr.aria-current]="currentPhase() === p.id ? 'step' : null"
            [title]="phaseHint(p.id)"
            (click)="goTo(p.id)"
          >{{ p.label }}</button>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
    }

    // The three phases of the turn, centered; the current one is marked
    .phases {
      display: flex;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    button {
      padding: var(--space-1) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text-muted);
      font: inherit;
      font-size: var(--font-size-sm);
      white-space: nowrap;
    }

    button:disabled {
      cursor: default;
    }

    // The phase you can go to next: a clear call to action
    button.next {
      border-color: var(--color-primary);
      color: var(--color-text);
      cursor: pointer;
    }

    button.next:not(.current)::after {
      content: ' ›';
    }

    button.next:hover {
      background: color-mix(in srgb, var(--color-primary) 18%, transparent);
    }

    button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }

    button.current {
      border-color: var(--color-sim-rival);
      background: color-mix(in srgb, var(--color-sim-rival) 18%, transparent);
      color: var(--color-text);
      font-weight: var(--font-weight-bold);
      box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-sim-rival) 35%, transparent);
    }

    button.current.mine {
      border-color: var(--color-sim-ally);
      background: color-mix(in srgb, var(--color-sim-ally) 18%, transparent);
      box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-sim-ally) 35%, transparent);
    }

    .compact { display: none; }

    // Phones in landscape: one button with the current phase, the next ones unfold to its left
    @media (orientation: landscape) and (max-height: 30rem) {
      :host { position: relative; }
      .phases { display: none; }
      .compact { display: flex; justify-content: flex-end; }
      // The same see-through pill as the turn's, tinted with the side whose turn it is
      .current-phase {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 0.15rem var(--space-3);
        border: 1px solid color-mix(in srgb, var(--color-sim-rival) 60%, transparent);
        background: color-mix(in srgb, var(--color-sim-rival) 14%, color-mix(in srgb, var(--color-surface) 70%, transparent));
        backdrop-filter: blur(6px);
        box-shadow: 0 2px 10px rgb(0 0 0 / 18%);
        color: var(--color-text);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .current-phase.mine {
        border-color: color-mix(in srgb, var(--color-sim-ally) 60%, transparent);
        background: color-mix(in srgb, var(--color-sim-ally) 14%, color-mix(in srgb, var(--color-surface) 70%, transparent));
      }
      .current-phase.can { cursor: pointer; box-shadow: 0 0 10px 1px color-mix(in srgb, var(--color-sim-ally) 35%, transparent); }
      .caret { font-weight: var(--font-weight-regular); }
      // Over the strip, to the left of the button
      .choices {
        position: absolute;
        inset-block: 0;
        inset-inline-end: calc(100% + var(--space-1));
        z-index: 5;
        display: flex;
        gap: var(--space-1);
      }
      .choice {
        padding: 0.15rem var(--space-3);
        border: 1px solid var(--color-sim-ally);
        background: color-mix(in srgb, var(--color-surface) 85%, transparent);
        backdrop-filter: blur(6px);
        color: var(--color-text);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        white-space: nowrap;
        box-shadow: var(--shadow-md);
        cursor: pointer;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseBarComponent {
  protected readonly game = inject(GameStore);
  /** A choice is lowered to look at the table: nothing can be done meanwhile. */
  private readonly lookOnly = inject(SheetState).lowered;

  protected readonly phases = [
    { id: 'START', label: 'Inicio' },
    { id: 'MAIN', label: 'Principal' },
    { id: 'END_PHASE', label: 'Final' },
  ];
  protected readonly currentPhase = computed(() => (this.game.phase() === 'END' ? 'END_PHASE' : this.game.phase()));
  protected readonly currentLabel = computed(() => this.phases.find((p) => p.id === this.currentPhase())?.label ?? '');
  /** Phones: the phases unfolded to the left of the current one. */
  protected readonly open = signal(false);
  /**
   * Phones: what tapping the current phase offers, the ones after it you can go to (from Principal, Final; in the
   * Final phase, ending the turn).
   */
  protected readonly nextPhases = computed(() => {
    if (!this.canGoTo('END_PHASE')) return [];
    return [{ id: 'END_PHASE', choice: this.currentPhase() === 'END_PHASE' ? 'Terminar turno' : 'Final ›' }];
  });

  constructor() {
    // Folded again whenever the phase or the turn changes
    effect(() => {
      this.currentPhase();
      this.game.isMyTurn();
      this.open.set(false);
    });
  }

  /**
   * On your turn, with nothing pending, the main phase goes on to the end phase. The end phase is closed: once its
   * move up and its triggers are done the turn ends by itself (a stuck end phase can still be closed by hand).
   */
  protected canGoTo(phase: string): boolean {
    if (!this.game.isMyTurn() || this.lookOnly() || this.game.state()?.prompt || this.game.state()?.chain?.length || this.game.state()?.combat) return false;
    return phase === 'END_PHASE' && (this.currentPhase() === 'MAIN' || this.currentPhase() === 'END_PHASE');
  }

  protected phaseHint(phase: string): string {
    if (!this.canGoTo(phase)) return '';
    return this.currentPhase() === 'END_PHASE' ? 'Terminar el turno' : 'Pasar a la fase final: al terminarla, termina tu turno';
  }

  protected goTo(phase: string): void {
    if (!this.canGoTo(phase)) return;
    if (this.currentPhase() === 'END_PHASE') this.game.endTurn();
    else this.game.enterEndPhase();
  }
}
