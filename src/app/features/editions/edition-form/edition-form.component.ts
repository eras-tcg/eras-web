import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BoxEntry,
  BoxEntryMode,
  Edition,
  EditionSaveRequest,
  RARITIES,
  RarityCode,
} from '@data/editions/edition.model';
import { probabilitySum, validateBoxConfig } from '@data/editions/edition-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { CardComponent } from '@ui/surfaces/card/card.component';

type RarityControls = Record<RarityCode, FormControl<number>>;

function rarityControls(fb: NonNullableFormBuilder, values?: Partial<Record<RarityCode, number>>) {
  const controls = {} as RarityControls;
  for (const r of RARITIES) controls[r] = fb.control(values?.[r] ?? 0);
  return fb.group(controls);
}

/** Create/edit form for an edition (basic data, pack types, box configuration). */
@Component({
  selector: 'eras-edition-form',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    GridComponent,
    IconComponent,
    SectionHeaderComponent,
    StackComponent,
  ],
  templateUrl: './edition-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  /** Edition to edit; null creates a new one. */
  readonly edition = input<Edition | null>(null);
  readonly saving = input(false);
  readonly serverError = input<string | null>(null);

  readonly submitted = output<EditionSaveRequest>();
  readonly cancelled = output<void>();

  protected readonly rarities = RARITIES;
  protected readonly modes: BoxEntryMode[] = ['FIXED', 'PROB', 'FLEX'];
  protected readonly validationError = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.edition() !== null);

  protected readonly form = this.fb.group({
    editionId: [''],
    editionName: [''],
    numberOfCards: [0],
    releaseDate: [''],
    editionImage: [''],
    editionDescription: [''],
    packTypes: this.fb.array<FormGroup>([]),
    boxConfig: this.fb.group({
      totalPacks: [0],
      entries: this.fb.array<FormGroup>([]),
    }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly packTypeNames = computed(() =>
    (this.formValue().packTypes ?? []).map((pt) => String(pt?.['name'] ?? '')).filter((n) => n.trim() !== ''),
  );

  constructor() {
    effect(() => this.reset(this.edition()));
  }

  protected get packTypes(): FormArray<FormGroup> {
    return this.form.controls.packTypes;
  }

  protected get entries(): FormArray<FormGroup> {
    return this.form.controls.boxConfig.controls.entries;
  }

  protected probOptions(entry: FormGroup): FormArray<FormGroup> {
    return entry.get('probOptions') as FormArray<FormGroup>;
  }

  protected entryMode(entry: FormGroup): BoxEntryMode {
    return entry.get('mode')?.value as BoxEntryMode;
  }

  protected probSum(entry: FormGroup): number {
    return probabilitySum(entry.getRawValue() as BoxEntry);
  }

  protected probSumOk(entry: FormGroup): boolean {
    return Math.abs(this.probSum(entry) - 1) < 0.001;
  }

  protected addPackType(): void {
    this.packTypes.push(this.fb.group({ name: [''], cardsPerRarity: rarityControls(this.fb) }));
  }

  protected addEntry(): void {
    this.entries.push(this.entryGroup());
  }

  protected addProbOption(entry: FormGroup): void {
    this.probOptions(entry).push(this.fb.group({ quantity: [1], prob: [0] }));
  }

  protected submit(): void {
    this.validationError.set(null);
    const value = this.form.getRawValue();
    if (!value.editionId.trim()) {
      this.validationError.set('El ID de la edición es obligatorio.');
      return;
    }
    const request = value as unknown as EditionSaveRequest;
    const boxError = validateBoxConfig(request.boxConfig);
    if (boxError) {
      this.validationError.set(boxError);
      return;
    }
    this.submitted.emit({ ...request, editionId: value.editionId.trim() });
  }

  private entryGroup(entry?: Partial<BoxEntry>): FormGroup {
    return this.fb.group({
      packTypeName: [entry?.packTypeName ?? ''],
      mode: [entry?.mode ?? ('FIXED' as BoxEntryMode)],
      quantity: [entry?.quantity ?? 1],
      probOptions: this.fb.array(
        (entry?.probOptions ?? []).map((o) => this.fb.group({ quantity: [o.quantity ?? 1], prob: [o.prob ?? 0] })),
      ),
    });
  }

  private reset(edition: Edition | null): void {
    this.validationError.set(null);
    this.packTypes.clear();
    this.entries.clear();
    for (const pt of edition?.packTypes ?? []) {
      this.packTypes.push(this.fb.group({ name: [pt.name ?? ''], cardsPerRarity: rarityControls(this.fb, pt.cardsPerRarity) }));
    }
    for (const entry of edition?.boxConfig?.entries ?? []) this.entries.push(this.entryGroup(entry));
    this.form.patchValue({
      editionId: edition?.editionId ?? '',
      editionName: edition?.editionName ?? '',
      numberOfCards: edition?.numberOfCards ?? 0,
      releaseDate: edition?.releaseDate ?? '',
      editionImage: '',
      editionDescription: edition?.editionDescription ?? '',
      boxConfig: { totalPacks: edition?.boxConfig?.totalPacks ?? 0 },
    });
    if (edition) this.form.controls.editionId.disable();
    else this.form.controls.editionId.enable();
  }
}
