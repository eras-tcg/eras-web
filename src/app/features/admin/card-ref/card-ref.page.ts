import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardRefApi } from '@data/cards/card-ref.api';
import { CardRefData, RefListField } from '@data/cards/card.model';
import { CardsStore } from '@data/cards/cards.store';
import { effectSummary } from '@data/cards/effect-rules';
import { TableComponent } from '@ui/data/table/table.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { CardComponent } from '@ui/surfaces/card/card.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { feedbackState } from '../admin-feedback';
import { KeywordDialogComponent, KeywordDialogData } from './keyword-dialog.component';
import { UsageDialogComponent, UsageDialogData } from './usage-dialog.component';

const LIST_FIELDS: { key: RefListField; label: string; hint: string }[] = [
  { key: 'classes', label: 'Clases', hint: 'Clases de carta (bestia, ente…)' },
  { key: 'instances', label: 'Instancias', hint: 'Momento del efecto; cada una puede tener un tipo por defecto' },
  { key: 'kinds', label: 'Tipos de efecto', hint: 'disparado, continuo…' },
  { key: 'tags', label: 'Tags', hint: 'Etiquetas para filtrar efectos' },
];

/** Reference data used by card metadata: value lists, instance → kind defaults and keyword effects (manage_cards). */
@Component({
  selector: 'eras-card-ref-page',
  imports: [
    PageComponent,
    GridComponent,
    CardComponent,
    StackComponent,
    SectionHeaderComponent,
    FormFieldComponent,
    TableComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './card-ref.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardRefPage {
  private readonly api = inject(CardRefApi);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);

  protected readonly fields = LIST_FIELDS;
  protected readonly fb = feedbackState();
  protected readonly ref = signal<CardRefData | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly drafts = signal<Record<string, string>>({});
  protected readonly searches = signal<Record<string, string>>({});
  protected readonly keywordSearch = signal('');

  protected readonly keywords = computed(() => {
    const q = this.keywordSearch().trim().toLowerCase();
    return Object.entries(this.ref()?.keywordEffects ?? {})
      .map(([keyword, entry]) => ({ keyword, summary: entry?.effect ? effectSummary(entry.effect) : (entry?.description ?? '') }))
      .filter((k) => !q || k.keyword.toLowerCase().includes(q) || k.summary.toLowerCase().includes(q))
      .sort((a, b) => a.keyword.localeCompare(b.keyword, 'es'));
  });

  constructor() {
    void this.load();
  }

  protected values(field: RefListField): string[] {
    const q = (this.searches()[field] ?? '').trim().toLowerCase();
    return [...(this.ref()?.[field] ?? [])].filter((v) => !q || v.toLowerCase().includes(q)).sort((a, b) => a.localeCompare(b, 'es'));
  }

  protected kindOf(instance: string): string {
    return this.ref()?.instanceKinds?.[instance] ?? '';
  }

  protected setDraft(field: string, value: string): void {
    this.drafts.update((d) => ({ ...d, [field]: value }));
  }

  protected setSearch(field: string, value: string): void {
    this.searches.update((s) => ({ ...s, [field]: value }));
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.apply(await firstValueFrom(this.api.get()));
    } catch (e) {
      this.fb.fail(e, 'No se pudieron cargar los datos de referencia');
    } finally {
      this.loading.set(false);
    }
  }

  protected async add(field: RefListField): Promise<void> {
    const value = (this.drafts()[field] ?? '').trim();
    if (!value) return;
    this.busy.set(field);
    this.fb.clear();
    try {
      this.apply(await firstValueFrom(this.api.addValue(field, value)));
      this.setDraft(field, '');
    } catch (e) {
      this.fb.fail(e, 'No se pudo agregar');
    } finally {
      this.busy.set(null);
    }
  }

  protected async remove(field: RefListField | 'keywordEffects', value: string): Promise<void> {
    const alternatives = field === 'keywordEffects' ? [] : (this.ref()?.[field] ?? []).filter((v) => v !== value);
    const data: UsageDialogData = { field, value, alternatives };
    const updated = await firstValueFrom(this.modal.open<CardRefData>(UsageDialogComponent, { data }).closed);
    if (updated) {
      this.apply(updated);
      this.fb.ok(`Se eliminó "${value}"`);
    }
  }

  protected async setKind(instance: string, kind: string): Promise<void> {
    this.busy.set(instance);
    this.fb.clear();
    try {
      this.apply(await firstValueFrom(this.api.setInstanceKind(instance, kind || null)));
    } catch (e) {
      this.fb.fail(e, 'No se pudo actualizar el tipo por defecto');
    } finally {
      this.busy.set(null);
    }
  }

  protected async editKeyword(keyword: string | null): Promise<void> {
    const ref = this.ref();
    if (!ref) return;
    const data: KeywordDialogData = { ref, keyword };
    const updated = await firstValueFrom(this.modal.open<CardRefData>(KeywordDialogComponent, { data }).closed);
    if (updated) {
      this.apply(updated);
      this.fb.ok('Keyword guardado');
    }
  }

  private apply(ref: CardRefData): void {
    this.ref.set(ref);
    this.cards.setRef(ref);
  }
}
