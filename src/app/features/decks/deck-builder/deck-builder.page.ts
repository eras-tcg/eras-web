import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { CardFilters, EMPTY_FILTERS, filterCards, hasActiveFilters, sortCards } from '@data/cards/card-filters';
import { CARD_TYPE_LABELS, CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, collapseByName, fullEditionId } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { MAX_CARDS, exportDeckText, idsFromEntries, parseDeckText } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FileButtonComponent } from '@ui/forms/file-button/file-button.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { WorkbenchComponent } from '@ui/layout/workbench/workbench.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { DropzoneComponent } from '@ui/surfaces/dropzone/dropzone.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { InViewDirective } from '@ui/utilities/in-view.directive';
import { cardDetailView } from '../../cards/card-detail-view';
import { CardView, DEFAULT_VIEW } from '../../cards/card-view';
import { ProxyPrintDialogComponent, ProxyPrintDialogData } from '../proxy-print-dialog/proxy-print-dialog.component';
import { BuilderFiltersData, BuilderFiltersDialogComponent } from './builder-filters-dialog.component';
import { DeckDraft } from './deck-draft';
import { DeckMetricsComponent } from './deck-metrics.component';

const PAGE_SIZE = 60;
const DRAG_TYPE = 'application/x-eras-card';

/**
 * Deck builder: search the catalog (right), build the deck (middle), inspect a card (left).
 * Anyone can build and export; saving needs manage_decks.
 */
@Component({
  selector: 'eras-deck-builder-page',
  imports: [
    WorkbenchComponent,
    StackComponent,
    GridComponent,
    SectionHeaderComponent,
    CardThumbComponent,
    CardDetailComponent,
    DeckMetricsComponent,
    AlertComponent,
    EmptyStateComponent,
    FileButtonComponent,
    FormFieldComponent,
    DropzoneComponent,
    ButtonComponent,
    ChipComponent,
    IconComponent,
    SpinnerComponent,
    InViewDirective,
  ],
  providers: [DeckDraft],
  templateUrl: './deck-builder.page.html',
  styleUrl: './deck-builder.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'warnBeforeLeaving($event)' },
})
export class DeckBuilderPage {
  /** `?id=` deck to edit, `?copy=true` to start a copy of it (bound by the router). */
  readonly id = input<string>();
  readonly copy = input<string>();

  protected readonly draft = inject(DeckDraft);
  protected readonly cards = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);

  protected readonly maxCards = MAX_CARDS;
  protected readonly typeLabels = CARD_TYPE_LABELS;
  protected readonly imageUrl = cardImageUrl;
  protected readonly canSave = computed(() => this.auth.user() !== null && this.auth.can('manage_decks'));

  // ── Messages ──────────────────────────────────────────────────────────
  protected readonly loadError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly savedNotice = signal(false);
  protected readonly importWarnings = signal<string[]>([]);
  protected readonly copyNotice = signal(false);

  // ── Search ────────────────────────────────────────────────────────────
  protected readonly query = signal('');
  protected readonly quickType = signal('');
  protected readonly filters = signal<CardFilters>(EMPTY_FILTERS);
  protected readonly view = signal<CardView>({ ...DEFAULT_VIEW, size: 110 });
  protected readonly renderCount = signal(PAGE_SIZE);
  protected readonly filtersActive = computed(() => hasActiveFilters(this.filters()) || !!this.query() || !!this.quickType());

  private readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.quickType();
    const base = filterCards(this.cards.cards(), type ? { ...this.filters(), type } : this.filters(), false).filter(
      (c) => !q || (c.name ?? '').toLowerCase().includes(q) || fullEditionId(c).toLowerCase().includes(q),
    );
    const sorted = sortCards(base, this.view().sort, this.view().direction);
    return this.view().collapse ? collapseByName(sorted, this.editions.releaseDates()) : sorted;
  });
  protected readonly resultCount = computed(() => this.results().length);
  protected readonly visibleResults = computed(() => this.results().slice(0, this.renderCount()));

  // ── Detail ────────────────────────────────────────────────────────────
  protected readonly selected = signal<CatalogCard | null>(null);
  protected readonly detail = computed(() => {
    const card = this.selected();
    return card ? cardDetailView(card, this.cards.ref(), this.cards.unprogrammedOf(card)) : null;
  });

  protected readonly showMetrics = signal(true);
  protected readonly dragOver = signal(false);

  private loadedFor: string | null = null;

  constructor() {
    void this.cards.load();
    void this.editions.load();

    // Load the deck once the catalog is there (entries are resolved against it)
    effect(() => {
      const id = this.id();
      const copy = this.copy() === 'true';
      const catalog = this.cards.cards();
      if (!id || catalog.length === 0) return;
      const key = `${id}|${copy}`;
      if (this.loadedFor === key) return;
      this.loadedFor = key;
      untracked(() => void this.loadDeck(id, copy, catalog));
    });

    // A new search starts again from the first page
    effect(() => {
      this.results();
      untracked(() => this.renderCount.set(PAGE_SIZE));
    });
  }

  private async loadDeck(id: string, copy: boolean, catalog: readonly CatalogCard[]): Promise<void> {
    this.loadError.set(null);
    let deck: Deck;
    try {
      deck = await this.decks.getDeck(id);
    } catch (e) {
      this.loadError.set(apiErrorMessage(e, 'No se pudo cargar el mazo'));
      return;
    }
    // Only the owner can overwrite a deck, so anyone else edits a copy
    const notMine = deck.userId !== this.auth.user()?.id;
    this.copyNotice.set(!copy && notMine);
    this.draft.load(deck, catalog, copy || notMine);
  }

  // ── Deck actions ──────────────────────────────────────────────────────

  protected add(card: CatalogCard): void {
    this.draft.add(card);
    this.selected.set(card);
    this.savedNotice.set(false);
  }

  protected remove(card: CatalogCard): void {
    this.draft.remove(card.id);
    this.savedNotice.set(false);
  }

  protected onNameInput(event: Event): void {
    this.draft.rename((event.target as HTMLInputElement).value);
    this.savedNotice.set(false);
  }

  protected async save(): Promise<void> {
    this.saveError.set(null);
    try {
      await this.draft.save();
      this.savedNotice.set(true);
      this.copyNotice.set(false);
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'No se pudo guardar el mazo');
    }
  }

  protected openFilters(): void {
    const data: BuilderFiltersData = {
      filters: this.filters,
      view: this.view,
      options: this.cards.options(),
      editions: this.editions.editions(),
    };
    this.modal.open(BuilderFiltersDialogComponent, { data });
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
    this.query.set('');
    this.quickType.set('');
  }

  protected toggleQuickType(type: string): void {
    this.quickType.set(this.quickType() === type ? '' : type);
  }

  protected showMore(): void {
    if (this.renderCount() < this.resultCount()) this.renderCount.update((n) => n + PAGE_SIZE);
  }

  protected openProxies(): void {
    const data: ProxyPrintDialogData = { deckName: this.draft.name(), cardIds: idsFromEntries(this.draft.entries()) };
    this.modal.open(ProxyPrintDialogComponent, { data });
  }

  protected exportList(): void {
    const blob = new Blob([exportDeckText(this.draft.name(), this.draft.entries())], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.draft.name() || 'mazo'}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  protected async importList(file: File): Promise<void> {
    if (this.draft.total() > 0) {
      const ok = await this.modal.confirm({
        title: 'Importar lista',
        message: 'La lista importada reemplaza las cartas del mazo actual.',
        confirmLabel: 'Reemplazar',
      });
      if (!ok) return;
    }
    const result = parseDeckText(await file.text(), this.cards.cards());
    if (result.entries.length === 0) {
      this.importWarnings.set(['No se encontró ninguna carta del archivo. ¿Es una lista exportada desde ERAS?', ...result.warnings]);
      return;
    }
    this.draft.replace(result.entries, result.name ?? file.name.replace(/\.txt$/i, ''));
    this.importWarnings.set(result.warnings);
  }

  // ── Drag & drop (desktop): search → deck ──────────────────────────────

  protected dragStart(event: DragEvent, card: CatalogCard): void {
    event.dataTransfer?.setData(DRAG_TYPE, card.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  protected dragOverDeck(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected drop(event: DragEvent): void {
    this.dragOver.set(false);
    const id = event.dataTransfer?.getData(DRAG_TYPE);
    if (!id) return;
    event.preventDefault();
    const card = this.cards.cards().find((c) => c.id === id);
    if (card) this.add(card);
  }

  /** Right click adds from search / removes from the deck, as in the legacy builder. */
  protected contextAdd(event: MouseEvent, card: CatalogCard): void {
    event.preventDefault();
    this.add(card);
  }

  protected contextRemove(event: MouseEvent, card: CatalogCard): void {
    event.preventDefault();
    this.remove(card);
  }

  // ── Leaving with unsaved changes ──────────────────────────────────────

  /** Used by the route's canDeactivate guard. */
  async confirmLeave(): Promise<boolean> {
    if (!this.draft.dirty() || this.draft.total() === 0) return true;
    return this.modal.confirm({
      title: 'Cambios sin guardar',
      message: 'Si sales ahora se pierden los cambios del mazo.',
      confirmLabel: 'Salir sin guardar',
      danger: true,
    });
  }

  protected warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (this.draft.dirty() && this.draft.total() > 0) event.preventDefault();
  }
}

