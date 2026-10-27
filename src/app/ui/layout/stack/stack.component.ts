import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

export type Space = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Lays out children in a row or column with a gap from the spacing scale.
 * Pages use it instead of writing their own CSS.
 */
@Component({
  selector: 'eras-stack',
  template: '<ng-content />',
  styleUrl: './stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.flex-direction]': 'direction()',
    '[style.gap]': 'gapValue()',
    '[style.align-items]': 'align()',
    '[style.justify-content]': 'justify()',
    '[style.flex-wrap]': 'wrap() ? "wrap" : "nowrap"',
  },
})
export class StackComponent {
  readonly direction = input<'row' | 'column'>('column');
  readonly gap = input<Space>(3);
  readonly align = input<'stretch' | 'start' | 'center' | 'end' | 'baseline'>('stretch');
  readonly justify = input<'start' | 'center' | 'end' | 'space-between'>('start');
  readonly wrap = input(false, { transform: booleanAttribute });

  protected readonly gapValue = computed(() => `var(--space-${this.gap()})`);
}
