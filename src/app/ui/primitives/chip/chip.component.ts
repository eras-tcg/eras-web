import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Selectable pill on a native button. Usage: `<button erasChip [selected]="x">Texto</button>` */
@Component({
  selector: 'button[erasChip]',
  template: '<ng-content />',
  styleUrl: './chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[class.is-selected]': 'selected()',
    '[attr.aria-pressed]': 'selected()',
  },
})
export class ChipComponent {
  readonly selected = input(false, { transform: booleanAttribute });
}
