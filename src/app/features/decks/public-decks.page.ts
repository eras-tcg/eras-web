import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCardComponent } from '@ui/domain/deck-card/deck-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SortControlComponent } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { PUBLIC_SORT_OPTIONS, deckViewLink } from './deck-links';

@Component({
  selector: 'eras-public-decks-page',
  imports: [PageComponent, GridComponent, DeckCardComponent, SortControlComponent, AlertComponent, EmptyStateComponent, SpinnerComponent],
  template: `
    <eras-page title="Mazos públicos" subtitle="Mazos compartidos por la comunidad">
      <eras-sort-control
        page-actions
        [options]="sortOptions"
        [key]="sortKey()"
        [direction]="direction()"
        (keyChange)="sortKey.set($any($event))"
        (directionChange)="direction.set($event)"
      />

      @if (store.error(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }
      @if (store.loading() && decks().length === 0) {
        <eras-empty-state title="Cargando mazos…"><eras-spinner /></eras-empty-state>
      } @else if (!store.error() && decks().length === 0) {
        <eras-empty-state title="Todavía no hay mazos públicos" />
      } @else {
        <eras-grid minColumn="14rem">
          @for (deck of decks(); track deck.id) {
            <eras-deck-card
              [name]="deck.deckName"
              [author]="deck.username ?? null"
              [imageUrl]="deck.deckImage ?? null"
              [cardCount]="deck.cards.length"
              (selected)="open(deck)"
            />
          }
        </eras-grid>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicDecksPage {
  protected readonly store = inject(DecksStore);
  private readonly router = inject(Router);

  protected readonly sortOptions = PUBLIC_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly decks = computed(() => sortDecks(this.store.publicDecks(), this.sortKey(), this.direction()));

  constructor() {
    void this.store.loadPublic();
  }

  protected open(deck: Deck): void {
    void this.router.navigate(deckViewLink(deck.id));
  }
}
