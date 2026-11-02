import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { persistedFlag } from '@core/storage/persisted-flag';
import { apiErrorMessage } from '@core/http/api-error';
import { CardFilters, EMPTY_FILTERS, filterCards, hasActiveFilters, sortCards } from '@data/cards/card-filters';
import { CARD_TYPE_LABELS, CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, collapseByName, fullEditionId } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { bestFinish, deckCopyFinishes, missingCopies, ownedFinishes, shineOf } from '@data/collection/collection-rules';
import { Finish } from '@data/collection/collection.model';
import { CollectionStore } from '@data/collection/collection.store';
import { MAX_CARDS, exportDeckText, idsFromEntries, parseDeckText } from '@data/decks/deck-rules';
import { Deck, DeckEntry } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { WorkbenchComponent } from '@ui/layout/workbench/workbench.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ToggleGroupComponent, ToggleOption } from '@ui/forms/toggle-group/toggle-group.component';
import { DropzoneComponent } from '@ui/surfaces/dropzone/dropzone.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { InViewDirective } from '@ui/utilities/in-view.directive';
import { cardDetailView } from '../../cards/card-detail-view';
import { CardView, DEFAULT_VIEW } from '../../cards/card-view';
import { ProxyPrintDialogComponent, ProxyPrintDialogData } from '../proxy-print-dialog/proxy-print-dialog.component';
import { BuilderFiltersData, BuilderFiltersDialogComponent } from './builder-filters-dialog.component';
import { CollectionPanelComponent } from './collection-panel.component';
import { FragmentsBarComponent } from './fragments-bar.component';
import { DeckDraft } from './deck-draft';
import { DeckMetricsComponent } from './deck-metrics.component';

const PAGE_SIZE = 60;
const DRAG_TYPE = 'application/x-eras-card';

/**
 * Deck builder: search the catalog (right), build the deck (middle), inspect a card (left).
 * Anyone can build and export; saving needs manage_decks. Any card can go in a deck, but a signed-in player plays
 * only decks whose every copy is in their collection: the cards they lack show in grey (in the search, and the deck's
 * copies beyond what they own), and the card on the left can be broken or crafted.
 */
@Component({
  selector: 'eras-deck-builder-page',
  imports: [
    PageComponent,
    WorkbenchComponent,
    StackComponent,
    GridComponent,
    SectionHeaderComponent,
    CardThumbComponent,
    CardDetailComponent,
    DeckMetricsComponent,
    AlertComponent,
    EmptyStateComponent,
    FormFieldComponent,
    DropzoneComponent,
    ButtonComponent,
    ChipComponent,
    IconComponent,
    SpinnerComponent,
    InViewDirective,
    CollectionPanelComponent,
    FragmentsBarComponent,
    ToggleGroupComponent,
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
  protected readonly collection = inject(CollectionStore);
  private readonly editions = inject(EditionsStore);
  private readonly decks = inject(DecksStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly maxCards = MAX_CARDS;
  protected readonly typeLabels = CARD_TYPE_LABELS;
  protected readonly imageUrl = cardImageUrl;

  protected badge(card: CatalogCard): string | null {
    return this.showUnprogrammed() && this.cards.unprogrammedOf(card) ? 'Sin programar' : null;
  }
  protected readonly canSave = computed(() => this.auth.user() !== null && this.auth.can('manage_decks'));
  protected readonly signedIn = computed(() => this.auth.user() !== null);

  // ── Collection ────────────────────────────────────────────────────────
  /** Copies the deck needs that the player does not own (signed in only). */
  protected readonly missing = computed(() => (this.signedIn() ? missingCopies(this.draft.entries(), this.collection.collection()) : 0));
  protected owns(card: CatalogCard): boolean {
    return !this.signedIn() || this.collection.owned(card.id) > 0;
  }
  /** The finest finish the player owns of a card (null when none). */
  protected best(card: CatalogCard): Finish | null {
    return bestFinish(this.collection.collection()?.cards[card.id]);
  }
  /** Each of the deck's copies of a card with its finish (the player's finest first; null for one they lack). */
  protected copyFinishes(entry: DeckEntry): (Finish | null)[] {
    return deckCopyFinishes(this.collection.collection()?.cards[entry.card.id], entry.count);
  }
  protected readonly shineOf = shineOf;
  /** The deck's copies of a card together (one card, ×N) or each by itself, smaller (remembered on the device). */
  protected readonly groupCopies = persistedFlag('eras-deck-builder-group-copies', true);

  /** A deck's copies of a card the player does not have. */
  protected lacking(entry: DeckEntry): number {
    return this.signedIn() ? Math.max(0, entry.count - this.collection.owned(entry.card.id)) : 0;
  }

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
  /** Marks, on the card itself, the cards the simulator does not run yet (in the deck and in the search). */
  protected readonly showUnprogrammed = persistedFlag('eras-deck-builder-mark-unprogrammed');
  protected readonly renderCount = signal(PAGE_SIZE);
  protected readonly typeOptions = computed<ToggleOption[]>(() =>
    this.cards.options().types.map((t) => ({ value: t, label: CARD_TYPE_LABELS[t] ?? t })),
  );
  protected readonly ownershipOptions: ToggleOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'owned', label: 'Las que tengo', text: 'Tengo' },
    { value: 'missing', label: 'Las que no tengo', text: 'No tengo' },
  ];
  protected readonly copyViews: ToggleOption[] = [
    { value: 'grouped', label: 'Agrupadas (×N)', text: 'Agrupadas' },
    { value: 'each', label: 'Cada copia por separado', text: 'Separadas' },
  ];
  /** "Mostrar todas las…": printings, finishes (signed in) and the cards not programmed yet, each on or off. */
  protected readonly showOptions = computed<ToggleOption[]>(() => [
    { value: 'printings', label: 'Todas las impresiones', text: 'Impresiones' },
    ...(this.signedIn() ? [{ value: 'finishes', label: 'Todas las rarezas (acabados que tienes)', text: 'Rarezas' }] : []),
    { value: 'unprogrammed', label: 'Marcar las cartas sin programar', text: 'Sin programar' },
  ]);
  protected readonly shown = computed(() =>
    [!this.view().collapse && 'printings', this.allFinishes() && 'finishes', this.showUnprogrammed() && 'unprogrammed'].filter((v): v is string => !!v),
  );
  protected toggleShown(value: string): void {
    if (value === 'printings') this.view.set({ ...this.view(), collapse: !this.view().collapse });
    if (value === 'finishes') this.allFinishes.set(!this.allFinishes());
    if (value === 'unprogrammed') this.showUnprogrammed.set(!this.showUnprogrammed());
  }

  /** Every finish the player owns of a card as its own entry, instead of only the finest. */
  protected readonly allFinishes = signal(false);
  /** Only the cards the player has, or only the ones they lack ('' for all). */
  protected readonly ownership = signal<'' | 'owned' | 'missing'>('');
  protected readonly filtersActive = computed(() => hasActiveFilters(this.filters()) || !!this.query() || !!this.quickType() || !!this.ownership());

  private readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const type = this.quickType();
    const base = filterCards(this.cards.cards(), type ? { ...this.filters(), type } : this.filters(), false).filter(
      (c) => !q || (c.name ?? '').toLowerCase().includes(q) || fullEditionId(c).toLowerCase().includes(q),
    );
    const sorted = sortCards(base, this.view().sort, this.view().direction);
    const shown = this.view().collapse ? this.preferOwned(collapseByName(sorted, this.editions.releaseDates()), sorted) : sorted;
    const ownership = this.ownership();
    return ownership ? shown.filter((c) => this.owns(c) === (ownership === 'owned')) : shown;
  });
  /** The search's cards as shown: each with the finest finish the player owns, or one per finish they own. */
  private readonly items = computed(() =>
    this.results().flatMap((card) => {
      const finishes = ownedFinishes(this.collection.collection()?.cards[card.id]);
      if (this.allFinishes() && finishes.length > 1) return finishes.map((finish) => ({ card, finish, key: `${card.id}|${finish}` }));
      return [{ card, finish: finishes[0] ?? null, key: card.id }];
    }),
  );
  protected readonly resultCount = computed(() => this.items().length);
  protected readonly visibleResults = computed(() => this.items().slice(0, this.renderCount()));

  // ── Detail ────────────────────────────────────────────────────────────
  protected readonly selected = signal<CatalogCard | null>(null);
  /** The finish of the copy picked (from "Todas las rarezas" or a deck's copy); otherwise the finest owned shows. */
  protected readonly selectedFinish = signal<Finish | null | undefined>(undefined);
  protected readonly detailShine = computed(() => {
    const card = this.selected();
    const picked = this.selectedFinish();
    return shineOf(picked !== undefined ? picked : card ? this.best(card) : null);
  });
  protected readonly detail = computed(() => {
    const card = this.selected();
    return card ? cardDetailView(card, this.cards.ref(), this.cards.unprogrammedOf(card)) : null;
  });

  /** The metrics at the bottom of the deck, open or compact (remembered on the device). */
  protected readonly showMetrics = persistedFlag('eras-deck-builder-metrics-open', true);
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

  /** Shows a card on the left, as the copy picked (`finish`) or, without one, its finest owned. */
  protected select(card: CatalogCard | null, finish?: Finish | null): void {
    this.selected.set(card);
    this.selectedFinish.set(finish);
  }

  protected add(card: CatalogCard): void {
    this.draft.add(card);
    this.select(card);
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
    this.ownership.set('');
  }

  /** One printing per name, as collapsed, but one the player owns when they have any of that name. */
  private preferOwned(collapsed: readonly CatalogCard[], all: readonly CatalogCard[]): CatalogCard[] {
    if (!this.signedIn()) return [...collapsed];
    const owned = new Map<string, CatalogCard>();
    for (const c of all) {
      const name = (c.name ?? '').toLowerCase();
      if (name && !owned.has(name) && this.collection.owned(c.id) > 0) owned.set(name, c);
    }
    return collapsed.map((c) => (this.collection.owned(c.id) > 0 ? c : (owned.get((c.name ?? '').toLowerCase()) ?? c)));
  }

  /** Breaks every copy beyond the 4 a deck can use, keeping the finest, after asking. */
  protected async breakExtras(): Promise<void> {
    const extras = this.collection.extras();
    const ok = await this.modal.confirm({
      title: 'Romper copias sobrantes',
      message: `Tienes ${extras} ${extras === 1 ? 'copia' : 'copias'} de más (más de 4 de una misma carta). Se rompen por fragmentos y te quedas con las 4 mejores de cada una.`,
      confirmLabel: 'Romper',
      danger: true,
    });
    if (ok) await this.collection.breakExtras();
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

  /** The file chosen for "Importar lista" (the input is cleared, so the same file can be picked again). */
  protected pickList(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.importList(file);
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

  /** Starts a new deck; with unsaved changes it asks first. */
  protected async newDeck(): Promise<void> {
    if (this.draft.dirty() && this.draft.total() > 0) {
      const ok = await this.modal.confirm({
        title: 'Cambios sin guardar',
        message: 'Si creas un mazo nuevo se pierden los cambios de este.',
        confirmLabel: 'Crear sin guardar',
        danger: true,
      });
      if (!ok) return;
    }
    this.draft.reset();
    this.loadedFor = null;
    this.select(null);
    this.loadError.set(null);
    this.saveError.set(null);
    this.savedNotice.set(false);
    this.copyNotice.set(false);
    this.importWarnings.set([]);
    // Out of the loaded deck's address (the draft is clean now: leaving does not ask again)
    await this.router.navigate(['/deck-builder']);
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

