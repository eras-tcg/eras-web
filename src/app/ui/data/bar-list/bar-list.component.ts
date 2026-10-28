import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** CSS color for this item's bar (identity colors, e.g. card colors); defaults to the primary color. */
  color?: string;
}

/**
 * Horizontal bars, one per item, as share of `total`. Each row is a toggle button:
 * selecting one emits its key (or null to clear) so it can filter other charts.
 */
@Component({
  selector: 'eras-bar-list',
  template: `
    <p class="title">{{ title() }}</p>
    <ul>
      @for (item of items(); track item.key) {
        <li>
          <button
            type="button"
            [class.active]="selected() === item.key"
            [class.dim]="selected() !== null && selected() !== item.key"
            [attr.aria-pressed]="selected() === item.key"
            [attr.aria-label]="item.label + ': ' + item.value"
            (click)="selectedChange.emit(selected() === item.key ? null : item.key)"
          >
            <span class="label">{{ item.label }}</span>
            <span class="track"><span class="fill" [style.width.%]="pct(item.value)" [style.background]="item.color ?? null"></span></span>
            <span class="value">{{ item.value }}</span>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .title { color: var(--color-text-muted); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); letter-spacing: 0.06em; text-transform: uppercase; }
    ul { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
    button {
      display: grid;
      grid-template-columns: 6rem 1fr 2rem;
      align-items: center;
      gap: var(--space-2);
      inline-size: 100%;
      padding: var(--space-1);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      font-size: var(--font-size-sm);
      text-align: start;
      cursor: pointer;
    }
    button:hover, button.active { background: var(--color-surface-muted); }
    button.dim { opacity: 0.45; }
    .track { block-size: 8px; border-radius: 4px; background: var(--color-surface-muted); overflow: hidden; }
    .fill { display: block; block-size: 100%; border-radius: 4px; background: var(--color-primary); }
    .value { color: var(--color-text-muted); text-align: end; font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarListComponent {
  readonly title = input.required<string>();
  readonly items = input.required<BarItem[]>();
  readonly total = input(0);
  readonly selected = input<string | null>(null);
  readonly selectedChange = output<string | null>();

  private readonly denominator = computed(() => this.total() || Math.max(1, ...this.items().map((i) => i.value)));
  protected pct(value: number): number {
    return (value / this.denominator()) * 100;
  }
}
