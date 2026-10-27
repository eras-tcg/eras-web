import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'eras-spinner',
  template: '',
  styleUrl: './spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[attr.aria-label]': 'label()',
    '[class]': '"size-" + size()',
  },
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input('Cargando');
}
