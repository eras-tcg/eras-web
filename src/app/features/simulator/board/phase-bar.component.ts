import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';

/**
 * The phases of the turn, in the table's middle strip. They are its controls: on your turn, the next phase you can
 * go to is a button.
 * Phones in landscape: one button with the current phase; on your turn, tapping it unfolds over it every phase of
 * the turn (the current one marked, the ones you can go to enabled); choosing one goes there, tapping the button
 * again folds them.
 */
@Component({
  selector: 'eras-phase-bar',
  imports: [IconComponent],
  template: `
    <div class="compact">
      @if (open()) {
        <ol class="choices" aria-label="Ir a la fase">
          @for (p of phases; track p.id; let i = $index) {
            <li [style.--i]="phases.length - 1 - i">
              <button
                type="button"
                class="choice"
                [class.current]="currentPhase() === p.id"
                [class.mine]="game.isMyTurn()"
                [disabled]="!canGoTo(p.id)"
                [attr.aria-current]="currentPhase() === p.id ? 'step' : null"
                (click)="goTo(p.id); open.set(false)"
              >{{ choiceLabel(p.id, p.label) }}</button>
            </li>
          }
        </ol>
      }
      <button
        type="button"
        class="current-phase"
        [class.mine]="game.isMyTurn()"
        [class.can]="canChoose()"
        [class.open]="open()"
        [attr.aria-expanded]="canChoose() ? open() : null"
        [attr.aria-label]="'Fase ' + currentLabel()"
        (click)="canChoose() && open.set(!open())"
      >{{ currentLabel() }}@if (canChoose()) {<eras-icon class="caret" name="chevron-up" aria-hidden="true" />}</button>
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
      // It fills the strip's side (the same room in both styles, whatever the phase)
      .current-phase {
        display: inline-flex;
        flex: 1;
        justify-content: center;
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
      .caret {
        inline-size: 0.9rem;
        block-size: 0.9rem;
        transition: transform var(--duration-base, 200ms) var(--easing-standard, ease);
      }
      .current-phase.open .caret { transform: rotate(180deg); }
      .current-phase:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

      // Over the button, every phase of the turn; they rise one after the other from the button
      .choices {
        position: absolute;
        inset-block-end: calc(100% + var(--space-2));
        inset-inline-end: 0;
        z-index: 30;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-1);
        min-inline-size: 100%;
        margin: 0;
        padding: var(--space-1);
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--color-surface) 80%, transparent);
        backdrop-filter: blur(8px);
        box-shadow: var(--shadow-lg);
        list-style: none;
        transform-origin: bottom right;
        animation: phases-open var(--duration-base, 200ms) var(--easing-standard, ease) both;
      }
      .choices li {
        animation: phase-rise var(--duration-base, 200ms) var(--easing-standard, ease) both;
        animation-delay: calc(var(--i) * 45ms);
      }
      .choice {
        inline-size: 100%;
        padding: 0.25rem var(--space-3);
        border: 1px solid transparent;
        background: none;
        color: var(--color-text-muted);
        font-size: var(--font-size-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        text-align: start;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .choice:not(:disabled) {
        border-color: var(--color-sim-ally);
        color: var(--color-text);
        cursor: pointer;
      }
      .choice:not(:disabled):active { background: color-mix(in srgb, var(--color-sim-ally) 20%, transparent); }
      // The current phase: filled, no outline (only the ones you can go to are outlined)
      .choice.current,
      .choice.current.mine {
        border-color: transparent;
        background: color-mix(in srgb, var(--color-sim-rival) 16%, transparent);
        box-shadow: none;
        color: var(--color-text);
      }
      .choice.current.mine { background: color-mix(in srgb, var(--color-sim-ally) 16%, transparent); }
      .choice:disabled:not(.current) { opacity: 0.5; }
    }

    @keyframes phases-open {
      from { opacity: 0; transform: translateY(6px) scale(0.92); }
      to { opacity: 1; transform: none; }
    }
    @keyframes phase-rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .choices, .choices li { animation: none; }
    }

    /* "Estilo de la mesa: arcano" (the table sets --arcane-*): gold-edged plaques over the stone */
    :host-context(.arcane) button {
      border-color: var(--arcane-gold-soft);
      background: linear-gradient(180deg, #2a2620, #17140f);
      color: #b9b2a2;
      font-family: var(--font-family-display);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    :host-context(.arcane) button.next { border-color: var(--arcane-gold); color: var(--arcane-gold-light); }
    :host-context(.arcane) button.current,
    :host-context(.arcane) button.current.mine,
    :host-context(.arcane) .current-phase,
    :host-context(.arcane) .current-phase.mine {
      border-color: var(--arcane-gold);
      background: linear-gradient(180deg, #2f2a20, #17140f);
      backdrop-filter: none;
      color: var(--arcane-gold-light);
      font-weight: var(--font-weight-regular);
      box-shadow: 0 0 10px color-mix(in srgb, var(--arcane-gold) 30%, transparent);
    }
    :host-context(.arcane) .choices {
      background: linear-gradient(180deg, #23272f, #14171d);
      backdrop-filter: none;
      box-shadow: 0 0 0 1px var(--arcane-gold-soft), var(--shadow-lg);
    }
    @media (orientation: landscape) and (max-height: 30rem) {
      :host-context(.arcane) .current-phase,
      :host-context(.arcane) .choice {
        font-family: inherit;
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
      }
    }
    :host-context(.arcane) .choice { border-color: transparent; background: none; box-shadow: none; }
    :host-context(.arcane) .choice:not(:disabled) { border-color: var(--arcane-gold); color: var(--arcane-gold-light); }
    :host-context(.arcane) .choice.current,
    :host-context(.arcane) .choice.current.mine {
      border-color: transparent;
      background: color-mix(in srgb, var(--arcane-gold) 18%, transparent);
      color: var(--arcane-gold-light);
      box-shadow: none;
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
  /** Phones: the phases unfolded over the button. */
  protected readonly open = signal(false);
  /** Phones: some phase can be chosen now (on your turn, with nothing pending). */
  protected readonly canChoose = computed(() => this.phases.some((p) => this.canGoTo(p.id)));

  /** Phones: each phase's name in the unfolded list; the one that ends the turn says so. */
  protected choiceLabel(id: string, label: string): string {
    if (!this.canGoTo(id)) return label;
    return this.currentPhase() === id ? `${label} · terminar turno` : `${label} ›`;
  }

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
