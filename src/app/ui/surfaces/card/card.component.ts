import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Surface container. `padding` uses the spacing scale; `interactive` adds hover feedback. */
@Component({
  selector: 'eras-card',
  template: '<ng-content />',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"padding-" + padding()',
    '[class.is-interactive]': 'interactive()',
  },
})
export class CardComponent {
  readonly padding = input<'none' | 'sm' | 'md' | 'lg'>('md');
  readonly interactive = input(false, { transform: booleanAttribute });
}
