import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';

/**
 * The chain being built or resolved: the highest link first, since it resolves first (rule 11.3.0.6).
 * Shown on the board and inside the engine's choices, so it is clear what is chained and what resolves now.
 */
@Component({
  selector: 'eras-chain-list',
  template: `
    @if (links().length) {
      <section class="chain" aria-label="Cadena">
        <h3>Cadena <small>· se resuelve de arriba abajo</small></h3>
        <ol>
          @for (l of links(); track l.id) {
            <li [class.resolving]="l.resolving" [class.mine]="l.mine">
              <span class="link">{{ l.link }}</span>
              <span class="name">{{ l.sourceName }} · {{ l.label }}</span>
              <span class="state">{{ l.resolving ? 'resolviendo' : l.mine ? 'tuyo' : 'del rival' }}</span>
            </li>
          }
        </ol>
      </section>
    }
  `,
  styles: `
    .chain { display: grid; gap: var(--space-1); }
    h3 { margin: 0; font-size: var(--font-size-sm); }
    small { color: var(--color-text-muted); font-weight: normal; }
    ol { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
    li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      font-size: var(--font-size-sm);
    }
    li.resolving { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
    .link {
      display: inline-grid;
      place-items: center;
      inline-size: 1.5rem;
      block-size: 1.5rem;
      border-radius: 50%;
      background: var(--color-surface-muted);
      font-weight: var(--font-weight-bold);
    }
    li.resolving .link { background: var(--color-primary); color: var(--color-on-primary, #fff); }
    .state { color: var(--color-text-muted); font-size: var(--font-size-xs); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChainListComponent {
  private readonly game = inject(GameStore);

  protected readonly links = computed(() => {
    const me = this.game.myState()?.userId;
    return [...(this.game.state()?.chain ?? [])].reverse().map((e) => ({
      ...e,
      mine: e.controllerId === me,
      resolving: !!e.resolutionId,
    }));
  });
}
