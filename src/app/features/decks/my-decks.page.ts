import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CanDirective } from '@core/auth/can.directive';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '@data/cards/cards.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckEditions, filterDecks, hasDeckFilters, summarizeDecks } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SortControlComponent } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { DeckFiltersBarComponent } from './deck-filters-bar.component';
import { MY_SORT_OPTIONS, deckBuilderQuery, deckViewLink } from './deck-links';

/**
 * "Mazos": the signed-in user's own decks (private ones included), shown like cards. One screen high like the
 * home: only the deck grid scrolls. The filter panel carries the sorting and folds into a rail. Creating, editing
 * and deleting need manage_decks.
 */
@Component({
  selector: 'eras-my-decks-page',
  imports: [
    RouterLink,
    CanDirective,
    PageComponent,
    GridComponent,
    DeckCoverComponent,
    DeckFiltersBarComponent,
    SortControlComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './my-decks.page.html',
  styleUrl: './my-decks.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDecksPage {
  protected readonly store = inject(DecksStore);
  private readonly cards = inject(CardsStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly sortOptions = MY_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly filters = signal<DeckFilters>(EMPTY_DECK_FILTERS);
  protected readonly emptyFilters = EMPTY_DECK_FILTERS;
  // Open beside the list on wide screens, folded into a rail on phones
  protected readonly showFilters = signal(typeof window === 'undefined' || window.matchMedia('(min-width: 56rem)').matches);
  protected readonly filtersActive = computed(() => hasDeckFilters(this.filters()));
  protected readonly countLabel = computed(() => {
    const n = this.decks().length;
    return `${n} ${n === 1 ? 'mazo' : 'mazos'}${this.filtersActive() ? ' (filtrados)' : ''}`;
  });
  protected readonly deleting = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  private readonly summaries = computed(() => summarizeDecks(this.store.myDecks(), this.cards.cards()));
  protected readonly editions = computed(() => deckEditions(this.summaries()));
  protected readonly decks = computed(() =>
    sortDecks(filterDecks(this.store.myDecks(), this.filters(), this.summaries()), this.sortKey(), this.direction()),
  );
  protected readonly editQuery = (deck: Deck) => deckBuilderQuery(deck.id);

  constructor() {
    const userId = this.auth.user()?.id;
    if (userId) void this.store.loadMine(userId);
    // Colors and editions of each deck come from the card catalog
    void this.cards.load();
  }

  protected view(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id));
  }

  protected async remove(deck: Deck): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Eliminar mazo',
      message: `¿Eliminar "${deck.deckName}"? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(deck.id);
    this.actionError.set(null);
    try {
      await this.store.delete(deck.id);
    } catch (e) {
      this.actionError.set(e instanceof Error ? e.message : 'No se pudo eliminar el mazo');
    } finally {
      this.deleting.set(null);
    }
  }
}
