import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { IconComponent } from '../../primitives/icon/icon.component';

export interface SortOption {
  value: string;
  label: string;
}

/** "Order by" select plus an ascending/descending toggle. */
@Component({
  selector: 'eras-sort-control',
  imports: [ButtonComponent, IconComponent],
  template: `
    <select aria-label="Ordenar por" (change)="keyChange.emit($any($event.target).value)">
      @for (o of options(); track o.value) {
        <option [value]="o.value" [selected]="o.value === key()">{{ o.label }}</option>
      }
    </select>
    <button
      erasButton
      variant="secondary"
      size="sm"
      type="button"
      [attr.aria-label]="direction() === 'asc' ? 'Orden ascendente' : 'Orden descendente'"
      (click)="directionChange.emit(direction() === 'asc' ? 'desc' : 'asc')"
    >
      <eras-icon [name]="direction() === 'asc' ? 'sort-asc' : 'sort-desc'" />
    </button>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--space-2); }
    select {
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortControlComponent {
  readonly options = input.required<SortOption[]>();
  readonly key = input.required<string>();
  readonly direction = input<'asc' | 'desc'>('asc');
  readonly keyChange = output<string>();
  readonly directionChange = output<'asc' | 'desc'>();
}
