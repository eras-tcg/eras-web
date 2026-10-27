import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Space } from '../stack/stack.component';

/** Responsive grid: as many columns of at least `minColumn` as fit. */
@Component({
  selector: 'eras-grid',
  template: '<ng-content />',
  styleUrl: './grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.grid-template-columns]': 'columns()',
    '[style.gap]': 'gapValue()',
  },
})
export class GridComponent {
  readonly minColumn = input('16rem');
  readonly gap = input<Space>(4);

  protected readonly columns = computed(() => `repeat(auto-fill, minmax(min(${this.minColumn()}, 100%), 1fr))`);
  protected readonly gapValue = computed(() => `var(--space-${this.gap()})`);
}
