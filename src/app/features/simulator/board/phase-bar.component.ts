import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';

/**
 * The phases of the turn, in the table's middle strip. They are its controls: on your turn, the next phase you can
 * go to is a button.
 */
@Component({
  selector: 'eras-phase-bar',
  template: `
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

    // Phones in landscape (little height): a one-row strip
    @media (orientation: landscape) and (max-height: 30rem) {
      button {
        padding: 0.1rem var(--space-2);
        font-size: var(--font-size-xs);
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
