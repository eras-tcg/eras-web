import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { CARD_COLORS, CARD_RARITIES, CARD_TYPE_LABELS, COLOR_LABELS, CardEffect, CardRefData, KeywordEffect, SPECIAL_SUMMON_LABELS } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { effectSummary } from '@data/cards/effect-rules';
import { MetaForm, toMetaPayload, validateMeta } from '@data/cards/meta-rules';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { MultiselectComponent } from '@ui/forms/multiselect/multiselect.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EffectDialogComponent, EffectDialogData } from './effect-dialog.component';

export interface MetaFormData {
  form: MetaForm;
  /** Existing metadata id; null creates new metadata. */
  metaId: string | null;
  imageUrl: string | null;
  ref: CardRefData | null;
}

type EffectList = 'effects' | 'inheritEffects';
type KeywordList = 'keywordEffects' | 'inheritKeywordEffects';
type NumberField = 'cardNumber' | 'strength' | 'cost' | 'level' | 'specialCost';

/** Create or edit a card's metadata (manage_cards). Closes with `true` when saved. */
@Component({
  selector: 'eras-meta-form-dialog',
  imports: [
    ModalComponent,
    SplitComponent,
    StackComponent,
    GridComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    MultiselectComponent,
    CardImageComponent,
    AlertComponent,
    ButtonComponent,
    ChipComponent,
    IconComponent,
  ],
  templateUrl: './meta-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaFormDialogComponent {
  protected readonly data = inject<MetaFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(CardsAdminApi);
  private readonly modal = inject(ModalService);

  protected readonly f = signal<MetaForm>(structuredClone(this.data.form));
  protected readonly saving = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected readonly types = Object.keys(CARD_TYPE_LABELS);
  protected readonly typeLabels = CARD_TYPE_LABELS;
  protected readonly summons = Object.keys(SPECIAL_SUMMON_LABELS);
  protected readonly summonLabels = SPECIAL_SUMMON_LABELS;
  protected readonly colors = CARD_COLORS;
  protected readonly colorLabels = COLOR_LABELS;
  protected readonly rarities = CARD_RARITIES;
  protected readonly classes = computed(() => [...(this.data.ref?.classes ?? [])].sort());
  protected readonly keywords = computed(() => Object.keys(this.data.ref?.keywordEffects ?? {}).sort());
  protected readonly summary = effectSummary;
  protected readonly effectLists: { key: EffectList; title: string }[] = [
    { key: 'effects', title: 'Efectos' },
    { key: 'inheritEffects', title: 'Efectos heredados' },
  ];
  protected readonly keywordLists: { key: KeywordList; title: string }[] = [
    { key: 'keywordEffects', title: 'Keywords' },
    { key: 'inheritKeywordEffects', title: 'Keywords heredados' },
  ];

  protected set<K extends keyof MetaForm>(key: K, value: MetaForm[K]): void {
    this.f.update((f) => ({ ...f, [key]: value }));
  }

  protected setNumber(key: NumberField, raw: string): void {
    this.set(key, raw.trim() === '' ? null : Number(raw));
  }

  protected toggleColor(color: string): void {
    const colors = this.f().colors;
    this.set('colors', colors.includes(color) ? colors.filter((c) => c !== color) : [...colors, color]);
  }

  // ── Effects ───────────────────────────────────────────────────────────

  protected async editEffect(list: EffectList, index: number | null): Promise<void> {
    const data: EffectDialogData = {
      effect: index === null ? null : this.f()[list][index],
      ref: this.data.ref,
      title: `${index === null ? 'Nuevo' : 'Editar'} ${list === 'effects' ? 'efecto' : 'efecto heredado'}`,
    };
    const effect = await firstValueFrom(this.modal.open<CardEffect>(EffectDialogComponent, { data }).closed);
    if (!effect) return;
    const current = this.f()[list];
    this.set(list, index === null ? [...current, effect] : current.map((e, i) => (i === index ? effect : e)));
  }

  protected removeEffect(list: EffectList, index: number): void {
    this.set(list, this.f()[list].filter((_, i) => i !== index));
  }

  // ── Keyword effects ───────────────────────────────────────────────────

  protected addKeyword(list: KeywordList): void {
    this.set(list, [...this.f()[list], { keyword: this.keywords()[0] ?? null, number: null }]);
  }

  protected setKeyword(list: KeywordList, index: number, patch: Partial<KeywordEffect>): void {
    this.set(list, this.f()[list].map((k, i) => (i === index ? { ...k, ...patch } : k)));
  }

  protected removeKeyword(list: KeywordList, index: number): void {
    this.set(list, this.f()[list].filter((_, i) => i !== index));
  }

  /** Keywords with a {parameter} take a value (e.g. Provocar {nivel} → 3). */
  protected hasParameter(keyword: string | null): boolean {
    return !!keyword && /\{[^}]+\}/.test(keyword);
  }

  protected withCurrent(options: readonly string[], current: string | null | undefined): readonly string[] {
    return current && !options.includes(current) ? [current, ...options] : options;
  }

  // ── Save ──────────────────────────────────────────────────────────────

  protected async save(): Promise<void> {
    const errors = validateMeta(this.f());
    this.errors.set(errors);
    if (errors.length) return;
    this.saving.set(true);
    try {
      const payload = toMetaPayload(this.f());
      await firstValueFrom(this.data.metaId ? this.api.updateMeta(this.data.metaId, payload) : this.api.createMeta(payload));
      this.ref.close(true);
    } catch (e) {
      this.errors.set([apiErrorMessage(e, 'No se pudieron guardar los metadatos')]);
    } finally {
      this.saving.set(false);
    }
  }
}
