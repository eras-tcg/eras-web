import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardsStore } from '@data/cards/cards.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckAuthors, deckEditions, filterDecks, summarizeDecks } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SortControlComponent } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { DeckFiltersBarComponent } from './deck-filters-bar.component';
import { PUBLIC_SORT_OPTIONS, deckViewLink } from './deck-links';

/** Community decks shown like cards, with filters by name, author, colors and edition. */
@Component({
  selector: 'eras-public-decks-page',
  imports: [
    PageComponent,
    StackComponent,
    GridComponent,
    DeckCoverComponent,
    DeckFiltersBarComponent,
    SortControlComponent,
    AlertComponent,
    EmptyStateComponent,
    SpinnerComponent,
  ],
  template: `
    <eras-page title="Mazos públicos" subtitle="Mazos compartidos por la comunidad" width="wide">
      <eras-sort-control
        page-actions
        [options]="sortOptions"
        [key]="sortKey()"
        [direction]="direction()"
        (keyChange)="sortKey.set($any($event))"
        (directionChange)="direction.set($event)"
      />

      <eras-stack [gap]="4">
        <eras-deck-filters-bar
          [filters]="filters()"
          [authors]="authors()"
          [editions]="editions()"
          [shown]="decks().length"
          [total]="store.publicDecks().length"
          (filtersChange)="filters.set($event)"
        />

        @if (store.error(); as error) {
          <eras-alert tone="danger">{{ error }}</eras-alert>
        }
        @if (store.loading() && store.publicDecks().length === 0) {
          <eras-empty-state title="Cargando mazos…"><eras-spinner /></eras-empty-state>
        } @else if (decks().length === 0) {
          <eras-empty-state [title]="store.publicDecks().length ? 'Ningún mazo coincide con los filtros' : 'Todavía no hay mazos públicos'" />
        } @else {
          <eras-grid minColumn="11rem" [gap]="4">
            @for (deck of decks(); track deck.id) {
              <eras-deck-cover
                [name]="deck.deckName"
                [author]="deck.username ?? null"
                [imageUrl]="deck.deckImage ?? null"
                [cardCount]="deck.cards.length"
                (selected)="open(deck)"
              />
            }
          </eras-grid>
        }
      </eras-stack>
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicDecksPage {
  protected readonly store = inject(DecksStore);
  private readonly cards = inject(CardsStore);
  private readonly router = inject(Router);

  protected readonly sortOptions = PUBLIC_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly filters = signal<DeckFilters>(EMPTY_DECK_FILTERS);

  private readonly summaries = computed(() => summarizeDecks(this.store.publicDecks(), this.cards.cards()));
  protected readonly authors = computed(() => deckAuthors(this.store.publicDecks()));
  protected readonly editions = computed(() => deckEditions(this.summaries()));
  protected readonly decks = computed(() =>
    sortDecks(filterDecks(this.store.publicDecks(), this.filters(), this.summaries()), this.sortKey(), this.direction()),
  );

  constructor() {
    void this.store.loadPublic();
    // Colors and editions of each deck come from the card catalog
    void this.cards.load();
  }

  protected open(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id));
  }
}
