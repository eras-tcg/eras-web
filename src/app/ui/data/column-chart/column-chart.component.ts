import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Column {
  label: string;
  value: number;
}

/** Small single-series column chart: one bar per bucket, count above, bucket label below. */
@Component({
  selector: 'eras-column-chart',
  // `title` is an input: without this, a static title="…" also stays on the host as the browser's tooltip
  host: { '[attr.title]': 'null' },
  template: `
    <p class="title">{{ title() }}</p>
    <div class="plot" role="img" [attr.aria-label]="summary()">
      @for (c of columns(); track c.label) {
        <div class="col" [attr.aria-label]="c.label + ': ' + c.value">
          <span class="count">{{ c.value || '' }}</span>
          <span class="track"><span class="fill" [style.height.%]="pct(c.value)"></span></span>
          <span class="axis">{{ c.label }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); min-inline-size: 0; }
    .title { color: var(--color-text-muted); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); letter-spacing: 0.06em; text-transform: uppercase; }
    .plot { display: flex; align-items: stretch; gap: 2px; block-size: 7rem; }
    .col { display: flex; flex: 1; flex-direction: column; align-items: center; gap: var(--space-1); min-inline-size: 0; }
    .count, .axis { color: var(--color-text-muted); font-size: var(--font-size-xs); font-variant-numeric: tabular-nums; line-height: 1; }
    .count { min-block-size: 1em; }
    .track { display: flex; flex: 1; align-items: flex-end; inline-size: min(100%, 1.5rem); border-block-end: var(--border-width) solid var(--color-border); }
    .fill { display: block; inline-size: 100%; border-radius: 4px 4px 0 0; background: var(--color-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnChartComponent {
  readonly title = input.required<string>();
  readonly columns = input.required<Column[]>();

  private readonly max = computed(() => Math.max(1, ...this.columns().map((c) => c.value)));
  protected readonly summary = computed(
    () => `${this.title()}: ` + this.columns().filter((c) => c.value).map((c) => `${c.label} ${c.value}`).join(', '),
  );
  protected pct(value: number): number {
    return (value / this.max()) * 100;
  }
}
