import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { ModalComponent } from '../modal/modal.component';

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string | null;
}

export interface ChoiceDialogData {
  title: string;
  options: ChoiceOption[];
  /** Label of an extra option that closes with `null` (e.g. "Dejar vacío"). */
  clearLabel?: string;
}

/**
 * Pick one option from a filterable list. Closes with the chosen `value`,
 * `null` for the clear option, or `undefined` when dismissed.
 * Open it with ModalService: `modal.open<string | null>(ChoiceDialogComponent, { data })`.
 */
@Component({
  selector: 'eras-choice-dialog',
  imports: [ModalComponent, ButtonComponent],
  template: `
    <eras-modal [title]="data.title" (closed)="ref.close()">
      @if (data.options.length > 8) {
        <input
          class="search"
          type="search"
          placeholder="Buscar…"
          aria-label="Buscar"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      }
      <ul class="options">
        @for (option of visible(); track option.value) {
          <li>
            <button type="button" class="option" (click)="ref.close(option.value)">
              <span>{{ option.label }}</span>
              @if (option.hint) {
                <span class="hint">{{ option.hint }}</span>
              }
            </button>
          </li>
        } @empty {
          <li class="none">Sin resultados</li>
        }
      </ul>
      <ng-container modal-footer>
        @if (data.clearLabel) {
          <button erasButton variant="ghost" type="button" (click)="ref.close(null)">{{ data.clearLabel }}</button>
        }
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .search {
      inline-size: 100%;
      margin-block-end: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      color: var(--color-text);
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      max-block-size: 50vh;
      overflow: auto;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .option {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      inline-size: 100%;
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }
    .option:hover,
    .option:focus-visible {
      background: var(--color-surface-muted);
    }
    .hint,
    .none {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceDialogComponent {
  protected readonly data = inject<ChoiceDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);

  protected readonly query = signal('');
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.data.options;
    return this.data.options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  });
}
