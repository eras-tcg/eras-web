import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CardFilters, CardSortKey, NumberRange } from '@data/cards/card-filters';
import { FilterOptions } from '@data/cards/card-rules';
import { CARD_TYPE_LABELS, COLOR_LABELS, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { Edition } from '@data/editions/edition.model';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { RangeSliderComponent } from '@ui/forms/range-slider/range-slider.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardView, SORT_OPTIONS } from '../card-view';

type RangeKey = 'cost' | 'level' | 'strength' | 'specialCost';
type ListKey = 'classes' | 'keywords' | 'tags' | 'rarities';

/** Sidebar with every card filter plus the grid view options. Stateless: emits the new values. */
@Component({
  selector: 'eras-card-filters-panel',
  imports: [StackComponent, FormFieldComponent, MultiselectComponent, RangeSliderComponent, ButtonComponent, IconComponent, ToggleGroupComponent],
  templateUrl: './card-filters-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFiltersPanelComponent {
  readonly filters = input.required<CardFilters>();
  readonly options = input.required<FilterOptions>();
  readonly editions = input.required<readonly Edition[]>();
  readonly view = input.required<CardView>();

  readonly filtersChange = output<CardFilters>();
  readonly viewChange = output<CardView>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly typeLabels = CARD_TYPE_LABELS;
  protected readonly summonLabels = SPECIAL_SUMMON_LABELS;
  protected readonly colorLabels = COLOR_LABELS;

  protected readonly colorOptions = computed<ToggleOption[]>(() =>
    this.options().colors.map((c) => ({ value: c, label: COLOR_LABELS[c] ?? c, color: `var(--color-card-${c.toLowerCase()})`, swatch: true })),
  );
  /** All colors on = no color filter (same as the legacy page). */
  protected readonly activeColors = computed(() => (this.filters().colors.length ? this.filters().colors : this.options().colors));
  protected readonly rarityOptions = computed<ToggleOption[]>(() =>
    this.options().rarities.map((r) => ({ value: r, label: r, color: `var(--color-rarity-${r.toLowerCase()})` })),
  );
  protected readonly colorModeOptions: ToggleOption[] = [
    { value: 'any', label: 'Cualquier color' },
    { value: 'identity', label: 'Solo identidad' },
  ];
  protected readonly viewOptions: ToggleOption[] = [
    { value: 'collapse', label: 'Colapsar repetidas' },
    { value: 'all', label: 'Mostrar todas' },
  ];

  protected set<K extends keyof CardFilters>(key: K, value: CardFilters[K]): void {
    this.filtersChange.emit({ ...this.filters(), [key]: value });
  }

  protected setText(key: 'name' | 'type' | 'specialSummon' | 'requirement' | 'edition' | 'cardNumber', event: Event): void {
    this.set(key, (event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  protected setRange(key: RangeKey, value: NumberRange): void {
    this.set(key, value);
  }

  protected setList(key: ListKey, value: string[]): void {
    this.set(key, value);
  }

  /** Same behaviour as the legacy page: all colors on = no color filter. */
  protected toggleColor(color: string): void {
    const all = this.options().colors;
    const current = this.filters().colors;
    let next: string[];
    if (current.length === 0) next = [color];
    else if (current.includes(color)) next = current.filter((c) => c !== color);
    else next = [...current, color];
    this.set('colors', next.length >= all.length ? [] : next);
  }

  protected toggleRarity(rarity: string): void {
    const current = this.filters().rarities;
    this.setList('rarities', current.includes(rarity) ? current.filter((r) => r !== rarity) : [...current, rarity]);
  }

  protected setView<K extends keyof CardView>(key: K, value: CardView[K]): void {
    this.viewChange.emit({ ...this.view(), [key]: value });
  }

  protected setSort(event: Event): void {
    this.setView('sort', (event.target as HTMLSelectElement).value as CardSortKey);
  }

  protected setSize(event: Event): void {
    this.setView('size', (event.target as HTMLInputElement).valueAsNumber);
  }
}
