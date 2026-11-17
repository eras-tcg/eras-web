import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** One printed number or trait of a card (Nivel, Coste, Fuerza, Clase…). */
export interface CardFact {
  label: string;
  value: string;
  /** Spans the whole row (long text). */
  wide?: boolean;
  /** Differs from the printed value now (the strength on the table): marked in the primary color. */
  changed?: boolean;
}

/**
 * A card's facts at a glance: one box each, its label small over its value. `compact` for narrow places (the side
 * panel of a choice). Sizes are the parent's to tune: `--card-fact-min` (narrowest box), `--card-fact-grow` (1: the
 * boxes share the row), `--card-fact-padding`, `--card-fact-value-size`, `--card-facts-gap`.
 * `columns` lays the boxes on an even grid of that many columns (fewer when the boxes would get narrower than
 * `--card-fact-min`); without it they flow and share each row.
 *
 * <eras-card-facts [facts]="[{ label: 'Nivel', value: '2' }, { label: 'Fuerza', value: '5', changed: true }]" />
 */
@Component({
  selector: 'eras-card-facts',
  template: `
    <dl>
      @for (f of facts(); track f.label) {
        <div class="fact" [class.wide]="f.wide" [class.changed]="f.changed">
          <dt>{{ f.label }}</dt>
          <dd>{{ f.value }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; }
    :host(.compact) {
      --card-fact-min: 3.5rem;
      --card-fact-padding: 2px var(--space-2);
      --card-fact-value-size: var(--font-size-md);
      --card-facts-gap: var(--space-1);
    }
    dl { display: flex; flex-wrap: wrap; gap: var(--card-facts-gap, var(--space-2)); margin: 0; }
    .fact {
      display: grid;
      flex: var(--card-fact-grow, 0) 1 auto;
      align-content: start;
      gap: 1px;
      min-inline-size: var(--card-fact-min, 4.5rem);
      padding: var(--card-fact-padding, var(--space-1) var(--space-3));
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
    .fact.wide { flex-basis: 100%; }
    :host(.grid) dl {
      display: grid;
      grid-template-columns: repeat(
        auto-fill,
        minmax(
          max(
            var(--card-fact-min, 4.5rem),
            calc((100% - (var(--card-facts-columns) - 1) * var(--card-facts-gap, var(--space-2))) / var(--card-facts-columns))
          ),
          1fr
        )
      );
    }
    :host(.grid) .fact.wide { grid-column: 1 / -1; }
    dt { color: var(--color-text-muted); font-size: var(--font-size-xs); letter-spacing: 0.06em; text-transform: uppercase; }
    dd { margin: 0; font-size: var(--card-fact-value-size, var(--font-size-lg)); font-weight: var(--font-weight-bold); }
    .fact.changed { border-color: var(--color-primary); }
    .fact.changed dd { color: var(--color-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.compact]': 'compact()',
    '[class.grid]': 'columns() != null',
    '[style.--card-facts-columns]': 'columns()',
  },
})
export class CardFactsComponent {
  /** An even grid of this many columns (null: the boxes flow and share each row). */
  readonly columns = input<number | null>(null);
  readonly facts = input<readonly CardFact[]>([]);
  readonly compact = input(false, { transform: booleanAttribute });
}
