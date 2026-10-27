import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

/**
 * Styles a native <button> or <a> (keeps native semantics and accessibility).
 * Usage: `<button erasButton variant="ghost" size="sm">Cancelar</button>`
 */
@Component({
  selector: 'button[erasButton], a[erasButton]',
  imports: [SpinnerComponent],
  template: `
    @if (loading()) {
      <eras-spinner size="sm" />
    }
    <ng-content />
  `,
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"variant-" + variant() + " size-" + size()',
    '[class.is-loading]': 'loading()',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
}
