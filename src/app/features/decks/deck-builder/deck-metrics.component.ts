import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CARD_RARITIES, CARD_TYPE_LABELS, COLOR_LABELS } from '@data/cards/card.model';
import { CARD_TYPE_ORDER, deckMetrics } from '@data/decks/deck-rules';
import { DeckEntry } from '@data/decks/deck.model';
import { BarItem, BarListComponent } from '@ui/data/bar-list/bar-list.component';
import { Column, ColumnChartComponent } from '@ui/data/column-chart/column-chart.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { StackComponent } from '@ui/layout/stack/stack.component';

const range = (max: number) => Array.from({ length: max + 1 }, (_, i) => i);
const maxKey = (record: Record<number, number>) => Math.max(0, ...Object.keys(record).map(Number));

/** Deck composition. Clicking a type or color filters the cost/level/rarity charts. */
@Component({
  selector: 'eras-deck-metrics',
  imports: [BarListComponent, ColumnChartComponent, GridComponent, StackComponent],
  template: `
    <eras-stack [gap]="4">
      <eras-grid minColumn="14rem" [gap]="4">
        <eras-bar-list title="Tipo" [items]="types()" [total]="total()" [selected]="typeFilter()" (selectedChange)="typeFilter.set($event)" />
        <eras-bar-list title="Color" [items]="colors()" [total]="total()" [selected]="colorFilter()" (selectedChange)="colorFilter.set($event)" />
      </eras-grid>
      <eras-grid minColumn="10rem" [gap]="4">
        <eras-column-chart title="Coste" [columns]="costs()" />
        <eras-column-chart title="Nivel" [columns]="levels()" />
        <eras-column-chart title="Rareza" [columns]="rarities()" />
        @if (specialCosts().length) {
          <eras-column-chart title="Coste especial" [columns]="specialCosts()" />
        }
      </eras-grid>
    </eras-stack>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckMetricsComponent {
  readonly entries = input.required<readonly DeckEntry[]>();
  readonly total = input.required<number>();

  protected readonly typeFilter = signal<string | null>(null);
  protected readonly colorFilter = signal<string | null>(null);
  private readonly metrics = computed(() => deckMetrics(this.entries(), this.typeFilter(), this.colorFilter()));

  protected readonly types = computed<BarItem[]>(() =>
    CARD_TYPE_ORDER.filter((t) => this.metrics().types[t]).map((t) => ({ key: t, label: CARD_TYPE_LABELS[t] ?? t, value: this.metrics().types[t] })),
  );
  // Card colors are the cards' identity, so each bar wears its card color (always next to its name)
  protected readonly colors = computed<BarItem[]>(() =>
    Object.keys(COLOR_LABELS)
      .filter((c) => this.metrics().colors[c])
      .map((c) => ({ key: c, label: COLOR_LABELS[c], value: this.metrics().colors[c], color: `var(--color-card-${c.toLowerCase()})` })),
  );
  protected readonly costs = computed<Column[]>(() => {
    const m = this.metrics().costs;
    return range(maxKey(m)).map((i) => ({ label: String(i), value: m[i] ?? 0 }));
  });
  protected readonly levels = computed<Column[]>(() => {
    const m = this.metrics().levels;
    return Object.keys(m)
      .map(Number)
      .sort((a, b) => a - b)
      .map((l) => ({ label: String(l), value: m[l] }));
  });
  protected readonly rarities = computed<Column[]>(() => CARD_RARITIES.map((r) => ({ label: r, value: this.metrics().rarities[r] ?? 0 })));
  protected readonly specialCosts = computed<Column[]>(() => {
    const m = this.metrics().specialCosts;
    return Object.keys(m).length ? range(maxKey(m)).map((i) => ({ label: String(i), value: m[i] ?? 0 })) : [];
  });
}
