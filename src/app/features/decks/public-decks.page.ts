import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardsStore } from '@data/cards/cards.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckAuthors, deckEditions, filterDecks, summarizeDecks, systemRows } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { DeckBrowserComponent } from './deck-browser.component';
import { FROM_PUBLIC_DECKS, PUBLIC_SORT_OPTIONS, deckViewLink } from './deck-links';

/**
 * Public decks, in the deck browser like "Mazos" (one screen high, only the list scrolls): first the system's ("Mazos ERAS",
 * one row per group: Structure, Bloque E1, Arquetipos, each in the system's order), then the community's, sorted as chosen.
 * The filters apply to both.
 */
@Component({
  selector: 'eras-public-decks-page',
  imports: [PageComponent, DeckBrowserComponent, DeckCoverComponent, AlertComponent, GridComponent],
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
        showOrigin
      >
        <div deck-sections>
          @if (rows().length) {
            <h2 class="group">Mazos ERAS</h2>
            @for (row of rows(); track row.id) {
              <section class="row" [attr.aria-label]="row.label">
                <h3 class="row-title">{{ row.label }}</h3>
                <eras-grid minColumn="var(--cover-column, min(11rem, 40vw, 34dvh))" [gap]="4">
                  @for (deck of row.decks; track deck.id) {
                    <eras-deck-cover
                      [name]="deck.deckName"
                      [author]="deck.username ?? null"
                      [imageUrl]="deck.deckImage ?? null"
                      [cardCount]="deck.cards.length"
                      (selected)="open(deck)"
                    />
                  }
                </eras-grid>
              </section>
            }
            @if (community().length) {
              <h2 class="group">Comunidad <span class="count">{{ community().length }}</span></h2>
            }
          }
        </div>
        @for (deck of community(); track deck.id) {
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
  styles: `
    .group {
      margin: var(--space-2) 0 var(--space-3);
      font-size: var(--font-size-lg);
    }
    .count {
      color: var(--color-text-muted);
      font-weight: 400;
    }
    .row {
      margin-block-end: var(--space-5);
    }
    .row-title {
      margin: 0 0 var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
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
  protected readonly decks = computed(() => filterDecks(this.store.publicDecks(), this.filters(), this.summaries()));
  /** The system's decks that pass the filters, by row. */
  protected readonly rows = computed(() => systemRows(this.decks()));
  /** The players' decks that pass the filters, sorted as chosen. */
  protected readonly community = computed(() => sortDecks(this.decks().filter((d) => !d.systemDeck), this.sortKey(), this.direction()));

  constructor() {
    void this.store.loadPublic();
    // Colors and editions of each deck come from the card catalog
    void this.cards.load();
  }

  protected open(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id), { state: FROM_PUBLIC_DECKS });
  }
}
