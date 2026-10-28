import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { COLOR_LABELS, CARD_COLORS } from '@data/cards/card.model';
import { DeckFilters, EMPTY_DECK_FILTERS, hasDeckFilters } from '@data/decks/deck-filters';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

/** Filters for deck lists: name, author, colors, edition and (own decks) visibility. Stateless. */
@Component({
  selector: 'eras-deck-filters-bar',
  imports: [CardComponent, GridComponent, StackComponent, FormFieldComponent, ToggleGroupComponent, ButtonComponent, IconComponent],
  template: `
    @let f = filters();
    <eras-card padding="sm">
      <eras-stack [gap]="3">
        <eras-grid minColumn="12rem" [gap]="3">
          <eras-form-field label="Nombre">
            <input type="search" placeholder="Buscar mazo…" [value]="f.name" (input)="set('name', $any($event.target).value)" />
          </eras-form-field>
          @if (authors().length) {
            <eras-form-field label="Autor">
              <select (change)="setAuthor($any($event.target).value)">
                <option value="">Todos</option>
                @for (a of authors(); track a) {
                  <option [value]="a" [selected]="f.authors.includes(a)">{{ a }}</option>
                }
              </select>
            </eras-form-field>
          }
          <eras-form-field label="Contiene la edición">
            <select (change)="set('edition', $any($event.target).value)">
              <option value="">Cualquiera</option>
              @for (e of editions(); track e) {
                <option [value]="e" [selected]="e === f.edition">{{ e }}</option>
              }
            </select>
          </eras-form-field>
          <eras-toggle-group label="Colores" [options]="colorOptions" [selected]="activeColors()" (toggled)="toggleColor($event)" />
          @if (showVisibility()) {
            <eras-toggle-group label="Visibilidad" [options]="visibilityOptions" [selected]="[f.visibility]" (toggled)="set('visibility', $any($event))" />
          }
        </eras-grid>
        <eras-stack direction="row" [gap]="2" align="center" justify="space-between" wrap>
          <span>{{ resultLabel() }}</span>
          @if (active()) {
            <button erasButton variant="ghost" size="sm" type="button" (click)="filtersChange.emit(empty)"><eras-icon name="x" /> Limpiar filtros</button>
          }
        </eras-stack>
      </eras-stack>
    </eras-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckFiltersBarComponent {
  readonly filters = input.required<DeckFilters>();
  readonly authors = input<readonly string[]>([]);
  readonly editions = input.required<readonly string[]>();
  readonly showVisibility = input(false, { transform: booleanAttribute });
  readonly shown = input.required<number>();
  readonly total = input.required<number>();
  readonly filtersChange = output<DeckFilters>();

  protected readonly empty = EMPTY_DECK_FILTERS;
  protected readonly active = computed(() => hasDeckFilters(this.filters()));
  protected readonly resultLabel = computed(() =>
    this.active() ? `${this.shown()} de ${this.total()} mazos` : `${this.total()} ${this.total() === 1 ? 'mazo' : 'mazos'}`,
  );
  protected readonly colorOptions: ToggleOption[] = CARD_COLORS.map((c) => ({
    value: c,
    label: COLOR_LABELS[c] ?? c,
    color: `var(--color-card-${c.toLowerCase()})`,
    swatch: true,
  }));
  protected readonly visibilityOptions: ToggleOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'public', label: 'Públicos' },
    { value: 'private', label: 'Privados' },
  ];

  protected set<K extends keyof DeckFilters>(key: K, value: DeckFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }

  protected setAuthor(author: string): void {
    this.set('authors', author ? [author] : []);
  }

  /** No color filter = every color on (same behaviour as the card filters). */
  protected readonly activeColors = computed(() => (this.filters().colors.length ? this.filters().colors : CARD_COLORS));

  protected toggleColor(color: string): void {
    const current = this.filters().colors;
    let next: string[];
    if (current.length === 0) next = [color];
    else if (current.includes(color)) next = current.filter((c) => c !== color);
    else next = [...current, color];
    this.set('colors', next.length >= CARD_COLORS.length ? [] : next);
  }
}
