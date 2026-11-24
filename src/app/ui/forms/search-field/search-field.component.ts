import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { IconComponent } from '../../primitives/icon/icon.component';

/**
 * A search box: the magnifier and the text, on a see-through panel that lights its border in gold while typing.
 * <eras-search-field label="Buscar mazos" placeholder="Buscar mazo…" [(value)]="text" />
 */
@Component({
  selector: 'eras-search-field',
  imports: [IconComponent],
  template: `
    <label class="box">
      <eras-icon name="search" />
      <input type="search" [placeholder]="placeholder()" [attr.aria-label]="label()" [value]="value()" (input)="value.set($any($event.target).value)" />
    </label>
  `,
  styles: `
    :host {
      display: block;
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface-glass);
      color: var(--color-text-muted);
    }
    .box:focus-within {
      border-color: var(--color-hub-accent);
    }
    input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-md);
      outline: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchFieldComponent {
  /** Its name for screen readers. */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly value = model('');
}
