import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'float' | 'glass';
export type ButtonSize = 'sm' | 'md';

/**
 * Styles a native <button> or <a> (keeps native semantics and accessibility).
 * Usage: `<button erasButton variant="ghost" size="sm">Cancelar</button>`
 * `float`: a round gold button that floats over content (over a scrolling list, say), standing out from it: the
 * screen's call to action (the top row's main action too). `glass`: its quiet companion, a see-through pill (clear
 * the filters, cancel, a second action). With a label both are pills in the menu's lettering (display face, spaced
 * capitals); an icon alone, named with `aria-label`, makes a circle. `marked` puts a dot on its corner: something is
 * on (filters, say).
 * `<button erasButton variant="float" type="button">Guardar</button>`
 */
@Component({
  selector: 'button[erasButton], a[erasButton]',
  imports: [SpinnerComponent],
  template: `
    @if (loading()) {
      <eras-spinner size="sm" />
    }
    <ng-content />
    @if (marked()) {
      <span class="mark" aria-hidden="true"></span>
    }
  `,
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"variant-" + variant() + " size-" + size()',
    '[class.is-loading]': 'loading()',
    '[class.marked-host]': 'marked()',
    '[attr.aria-busy]': 'loading() || null',
  },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  /** Something is on (filters applied, say): a dot on its corner. */
  readonly marked = input(false, { transform: booleanAttribute });
}
