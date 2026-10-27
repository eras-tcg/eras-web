import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * Choose several values from a list. Selected values show as removable chips;
 * the list opens inline with a search box (no overlay, so it works inside scrolling sidebars).
 */
@Component({
  selector: 'eras-multiselect',
  template: `
    <button type="button" class="toggle" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <span>{{ label() }}</span>
      <span class="count">{{ value().length ? value().length + ' seleccionados' : placeholder() }}</span>
    </button>

    @if (value().length) {
      <ul class="selected" [attr.aria-label]="label() + ' seleccionados'">
        @for (v of value(); track v) {
          <li>
            <button type="button" class="chip" [attr.aria-label]="'Quitar ' + v" (click)="toggle(v)">{{ v }} ×</button>
          </li>
        }
      </ul>
    }

    @if (open()) {
      <div class="panel">
        @if (options().length > 8) {
          <input
            type="search"
            class="search"
            placeholder="Buscar…"
            [attr.aria-label]="'Buscar en ' + label()"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        }
        <ul class="options">
          @for (option of visible(); track option) {
            <li>
              <label class="option">
                <input type="checkbox" [checked]="value().includes(option)" (change)="toggle(option)" />
                {{ option }}
              </label>
            </li>
          } @empty {
            <li class="none">Sin resultados</li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './multiselect.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiselectComponent {
  readonly label = input.required<string>();
  readonly options = input.required<readonly string[]>();
  readonly value = input<readonly string[]>([]);
  readonly placeholder = input('Todos');
  readonly valueChange = output<string[]>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.toLowerCase().includes(q)) : this.options();
  });

  protected toggle(option: string): void {
    const current = this.value();
    this.valueChange.emit(current.includes(option) ? current.filter((v) => v !== option) : [...current, option]);
  }
}
