import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardsStore } from '@data/cards/cards.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckAuthors, deckEditions, filterDecks, summarizeDecks } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { DeckBrowserComponent } from './deck-browser.component';
import { PUBLIC_SORT_OPTIONS, deckViewLink } from './deck-links';

/** Community decks, in the deck browser like "Mazos" (one screen high, only the grid scrolls), with their authors. */
@Component({
  selector: 'eras-public-decks-page',
  imports: [PageComponent, DeckBrowserComponent, DeckCoverComponent, AlertComponent],
  template: `
    <eras-page title="Mazos públicos" width="wide" fill>
      @if (store.error(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }

      <eras-deck-browser
        [(filters)]="filters"
        [(sortKey)]="sortKey"
        [(direction)]="direction"
        [sortOptions]="sortOptions"
        [authors]="authors()"
        [editions]="editions()"
        [shown]="decks().length"
        [total]="store.publicDecks().length"
        [loading]="store.loading() && store.publicDecks().length === 0"
        [note]="note()"
      >
        @for (deck of decks(); track deck.id) {
          <eras-deck-cover
            [name]="deck.deckName"
            [author]="deck.username ?? null"
            [imageUrl]="deck.deckImage ?? null"
            [cardCount]="deck.cards.length"
            (selected)="open(deck)"
          />
        }
      </eras-deck-browser>
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
  protected readonly note = computed(() =>
    this.store.error() ? null : this.store.publicDecks().length === 0 ? 'Todavía no hay mazos públicos.' : this.decks().length === 0 ? 'Ningún mazo coincide con los filtros.' : null,
  );

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
