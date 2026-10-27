import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardFilters, CardSortKey, NumberRange } from '@data/cards/card-filters';
import { FilterOptions } from '@data/cards/card-rules';
import { CARD_TYPE_LABELS, COLOR_LABELS, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { Edition } from '@data/editions/edition.model';
import { ColorPipComponent } from '@ui/domain/color-pip/color-pip.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { RangeSliderComponent } from '@ui/forms/range-slider/range-slider.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardView, SORT_OPTIONS } from '../card-view';

type RangeKey = 'cost' | 'level' | 'strength' | 'specialCost';
type ListKey = 'classes' | 'keywords' | 'tags' | 'rarities';

/** Sidebar with every card filter plus the grid view options. Stateless: emits the new values. */
@Component({
  selector: 'eras-card-filters-panel',
  imports: [StackComponent, FormFieldComponent, MultiselectComponent, RangeSliderComponent, ChipComponent, ButtonComponent, IconComponent, ColorPipComponent],
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

  protected colorActive(color: string): boolean {
    const current = this.filters().colors;
    return current.length === 0 || current.includes(color);
  }

  protected toggleRarity(rarity: string): void {
    const current = this.filters().rarities;
    this.setList('rarities', current.includes(rarity) ? current.filter((r) => r !== rarity) : [...current, rarity]);
  }

  protected setSub(sub: string | null): void {
    this.set('subEdition', this.filters().subEdition === sub ? null : sub);
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

  protected subLabel(sub: string): string {
    return sub === '' ? 'Principal' : `Sub ${sub}`;
  }
}
