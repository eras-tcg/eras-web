import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CARD_COLORS, CARD_RARITIES, CARD_TYPE_LABELS, COLOR_LABELS, CardEffect, CardRefData, KeywordEffect, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { effectSummary } from '@data/cards/effect-rules';
import { MetaForm } from '@data/cards/meta-rules';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EffectDialogComponent, EffectDialogData } from './effect-dialog.component';

type EffectList = 'effects' | 'inheritEffects' | 'formationEffects';
type KeywordList = 'keywordEffects' | 'inheritKeywordEffects' | 'formationKeywordEffects';
type NumberField = 'cardNumber' | 'strength' | 'cost' | 'level' | 'specialCost';

/** The fields of a card's metadata, editing `form` in place (metadata dialog and card editor). */
@Component({
  selector: 'eras-meta-fields',
  imports: [StackComponent, GridComponent, SectionHeaderComponent, FormFieldComponent, MultiselectComponent, ButtonComponent, ChipComponent, IconComponent],
  templateUrl: './meta-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaFieldsComponent {
  readonly form = model.required<MetaForm>();
  readonly refData = input<CardRefData | null>(null);
  private readonly modal = inject(ModalService);

  protected readonly types = Object.keys(CARD_TYPE_LABELS);
  protected readonly typeLabels = CARD_TYPE_LABELS;
  protected readonly summons = Object.keys(SPECIAL_SUMMON_LABELS);
  protected readonly summonLabels = SPECIAL_SUMMON_LABELS;
  protected readonly colors = CARD_COLORS;
  protected readonly colorLabels = COLOR_LABELS;
  protected readonly rarities = CARD_RARITIES;
  protected readonly classes = computed(() => [...(this.refData()?.classes ?? [])].sort());
  protected readonly keywords = computed(() => Object.keys(this.refData()?.keywordEffects ?? {}).sort());
  protected readonly summary = effectSummary;
  // A Criatura Enlace also has its link effect (what it gives the neighbours it points to)
  protected readonly effectLists = computed<{ key: EffectList; title: string }[]>(() => [
    { key: 'effects', title: 'Efectos' },
    { key: 'inheritEffects', title: 'Efectos heredados' },
    ...(this.form().enlace ? [{ key: 'formationEffects' as const, title: 'Efectos de enlace' }] : []),
  ]);
  protected readonly keywordLists = computed<{ key: KeywordList; title: string }[]>(() => [
    { key: 'keywordEffects', title: 'Keywords' },
    { key: 'inheritKeywordEffects', title: 'Keywords heredados' },
    ...(this.form().enlace ? [{ key: 'formationKeywordEffects' as const, title: 'Keywords de enlace' }] : []),
  ]);

  protected set<K extends keyof MetaForm>(key: K, value: MetaForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  protected setNumber(key: NumberField, raw: string): void {
    this.set(key, raw.trim() === '' ? null : Number(raw));
  }

  protected toggleColor(color: string): void {
    const colors = this.form().colors;
    this.set('colors', colors.includes(color) ? colors.filter((c) => c !== color) : [...colors, color]);
  }

  protected async editEffect(list: EffectList, index: number | null): Promise<void> {
    const data: EffectDialogData = {
      effect: index === null ? null : this.form()[list][index],
      ref: this.refData(),
      title: `${index === null ? 'Nuevo' : 'Editar'} ${list === 'effects' ? 'efecto' : 'efecto heredado'}`,
    };
    const effect = await firstValueFrom(this.modal.open<CardEffect>(EffectDialogComponent, { data }).closed);
    if (!effect) return;
    const current = this.form()[list];
    this.set(list, index === null ? [...current, effect] : current.map((e, i) => (i === index ? effect : e)));
  }

  protected removeEffect(list: EffectList, index: number): void {
    this.set(list, this.form()[list].filter((_, i) => i !== index));
  }

  protected addKeyword(list: KeywordList): void {
    this.set(list, [...this.form()[list], { keyword: this.keywords()[0] ?? null, number: null }]);
  }

  protected setKeyword(list: KeywordList, index: number, patch: Partial<KeywordEffect>): void {
    this.set(list, this.form()[list].map((k, i) => (i === index ? { ...k, ...patch } : k)));
  }

  protected removeKeyword(list: KeywordList, index: number): void {
    this.set(list, this.form()[list].filter((_, i) => i !== index));
  }

  /** Keywords with a {parameter} take a value (e.g. Provocar {nivel} → 3). */
  protected hasParameter(keyword: string | null): boolean {
    return !!keyword && /\{[^}]+\}/.test(keyword);
  }

  protected withCurrent(options: readonly string[], current: string | null | undefined): readonly string[] {
    return current && !options.includes(current) ? [current, ...options] : options;
  }
}
