import { ChangeDetectionStrategy, Component, booleanAttribute, ViewEncapsulation, input } from '@angular/core';

/**
 * Label + control + hint/error. Styles the projected native control
 * (input, select, textarea), so forms keep using plain Angular form directives.
 *
 * <eras-form-field label="Nombre" [error]="err">
 *   <input formControlName="name" />
 * </eras-form-field>
 */
@Component({
  selector: 'eras-form-field',
  template: `
    <!-- The control is projected through ng-content, which the lint rule cannot see. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="eras-form-field__label">
      <span class="eras-form-field__text">{{ label() }}@if (required()) {<span aria-hidden="true"> *</span>}</span>
      <ng-content />
    </label>
    @if (error()) {
      <span class="eras-form-field__error" role="alert">{{ error() }}</span>
    } @else if (hint()) {
      <span class="eras-form-field__hint">{{ hint() }}</span>
    }
  `,
  styleUrl: './form-field.component.scss',
  // Not encapsulated: it must style the projected native controls. All selectors are namespaced.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'eras-form-field', '[class.has-error]': '!!error()' },
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });
}
