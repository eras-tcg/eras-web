import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { EditModeService } from '@core/auth/edit-mode.service';
import { persistedFlag } from '@core/storage/persisted-flag';
import { CardFilters, EMPTY_FILTERS, filterCards, hasActiveFilters, sortCards } from '@data/cards/card-filters';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl, collapseByName } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ChipComponent } from '@ui/primitives/chip/chip.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { InViewDirective } from '@ui/utilities/in-view.directive';
import { CardDetailDialogComponent, CardDetailDialogData } from './card-detail-dialog/card-detail-dialog.component';
import { CardFiltersPanelComponent } from './card-filters-panel/card-filters-panel.component';
import { CardView, DEFAULT_VIEW } from './card-view';

const PAGE_SIZE = 40;

/** Card catalog: filter, sort and browse every card; click one for its detail. */
@Component({
  selector: 'eras-cards-page',
  imports: [
    PageComponent,
    SplitComponent,
    GridComponent,
    StackComponent,
    CardFiltersPanelComponent,
    CardThumbComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    ChipComponent,
    IconComponent,
    SpinnerComponent,
    InViewDirective,
  ],
  templateUrl: './cards.page.html',
  styles: `
    .marks-label { color: var(--color-text-muted); font-size: var(--font-size-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsPage {
  /** `?edition=E1` (bound by the router). */
  readonly edition = input<string>();

  protected readonly store = inject(CardsStore);
  protected readonly editions = inject(EditionsStore);
  private readonly editMode = inject(EditModeService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly filters = signal<CardFilters>(EMPTY_FILTERS);
  private readonly wide = typeof window === 'undefined' || window.matchMedia('(min-width: 56rem)').matches;
  // Narrow screens start with two columns instead of one huge card
  protected readonly view = signal<CardView>(this.wide ? DEFAULT_VIEW : { ...DEFAULT_VIEW, size: 150 });
  protected readonly showFilters = signal(this.wide);
  protected readonly renderCount = signal(PAGE_SIZE);

  protected readonly canManage = computed(() => this.editMode.allows('manage_cards'));
  /** Marks on the cards ("Sin programar", "Sin metadatos"): hidden unless turned on. Remembered on the device. */
  protected readonly showUnprogrammed = persistedFlag('eras-cards-mark-unprogrammed');
  protected readonly showNoMeta = persistedFlag('eras-cards-mark-no-meta');

  /** Filtered and sorted, before collapsing repeated names (the count shows collapsed). */
  private readonly filtered = computed(() =>
    sortCards(filterCards(this.store.cards(), this.filters(), this.canManage()), this.view().sort, this.view().direction),
  );
  private readonly collapsed = computed(() => collapseByName(this.filtered(), this.editions.releaseDates()));
  protected readonly displayed = computed(() => (this.view().collapse ? this.collapsed() : this.filtered()));
  protected readonly visible = computed(() => this.displayed().slice(0, this.renderCount()));
  protected readonly count = computed(() => this.collapsed().length);
  protected readonly filtersActive = computed(() => hasActiveFilters(this.filters()));
  protected readonly imageUrl = cardImageUrl;

  constructor() {
    void this.store.load();
    void this.editions.load();

    // URL → filter (deep links from Editions/Home and the browser back button)
    effect(() => {
      const edition = this.edition() ?? '';
      untracked(() => {
        if (this.filters().edition !== edition) this.filters.update((f) => ({ ...f, edition }));
      });
    });

    // Filter → URL, so the selected edition can be shared and survives a reload
    effect(() => {
      const edition = this.filters().edition;
      untracked(() => {
        if ((this.edition() ?? '') !== edition) {
          void this.router.navigate([], { queryParams: { edition: edition || null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
      });
    });

    // A new result set starts again from the first page
    effect(() => {
      this.displayed();
      untracked(() => this.renderCount.set(PAGE_SIZE));
    });
  }

  /** Missing metadata first; with metadata, whether the simulator runs it. Each one only when its mark is on. */
  protected badge(card: CatalogCard): string | null {
    if (!card.meta) return this.showNoMeta() ? 'Sin metadatos' : null;
    return this.showUnprogrammed() && this.store.unprogrammedOf(card) ? 'Sin programar' : null;
  }

  protected showMore(): void {
    if (this.renderCount() < this.displayed().length) this.renderCount.update((n) => n + PAGE_SIZE);
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_FILTERS);
  }

  protected open(card: CatalogCard): void {
    const cards = this.displayed();
    const data: CardDetailDialogData = { cards, index: cards.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }
}
