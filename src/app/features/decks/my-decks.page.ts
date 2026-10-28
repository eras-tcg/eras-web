import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CanDirective } from '@core/auth/can.directive';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '@data/cards/cards.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckEditions, filterDecks, summarizeDecks } from '@data/decks/deck-filters';
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
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { DeckFiltersBarComponent } from './deck-filters-bar.component';
import { MY_SORT_OPTIONS, deckBuilderQuery, deckViewLink } from './deck-links';

/** The signed-in user's decks (private ones included), shown like cards. Editing and deleting need manage_decks. */
@Component({
  selector: 'eras-my-decks-page',
  imports: [
    RouterLink,
    CanDirective,
    PageComponent,
    StackComponent,
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
  template: `
    <eras-page title="Mis mazos" subtitle="Tus mazos, públicos y privados" width="wide">
      <ng-container ngProjectAs="[page-actions]">
        <eras-sort-control
          [options]="sortOptions"
          [key]="sortKey()"
          [direction]="direction()"
          (keyChange)="sortKey.set($any($event))"
          (directionChange)="direction.set($event)"
        />
        <a *erasCan="'manage_decks'" erasButton routerLink="/deck-builder"><eras-icon name="plus" /> Nuevo mazo</a>
      </ng-container>

      <eras-stack [gap]="4">
        @if (store.myDecks().length) {
          <eras-deck-filters-bar
            showVisibility
            [filters]="filters()"
            [editions]="editions()"
            [shown]="decks().length"
            [total]="store.myDecks().length"
            (filtersChange)="filters.set($event)"
          />
        }

        @if (store.error(); as error) {
          <eras-alert tone="danger">{{ error }}</eras-alert>
        }
        @if (actionError(); as error) {
          <eras-alert tone="danger">{{ error }}</eras-alert>
        }
        @if (store.loading() && store.myDecks().length === 0) {
          <eras-empty-state title="Cargando tus mazos…"><eras-spinner /></eras-empty-state>
        } @else if (!store.error() && store.myDecks().length === 0) {
          <eras-empty-state title="No tienes mazos guardados">
            <a *erasCan="'manage_decks'" erasButton routerLink="/deck-builder">Crear mazo</a>
          </eras-empty-state>
        } @else if (decks().length === 0) {
          <eras-empty-state title="Ningún mazo coincide con los filtros" />
        } @else {
          <eras-grid minColumn="11rem" [gap]="4">
            @for (deck of decks(); track deck.id) {
              <eras-deck-cover
                [name]="deck.deckName"
                [imageUrl]="deck.deckImage ?? null"
                [cardCount]="deck.cards.length"
                [isPrivate]="!!deck.privateDeck"
                (selected)="view(deck)"
              >
                <ng-container ngProjectAs="[cover-actions]">
                  <ng-container *erasCan="'manage_decks'">
                    <a erasButton variant="secondary" size="sm" routerLink="/deck-builder" [queryParams]="editQuery(deck)" [attr.aria-label]="'Editar ' + deck.deckName">
                      <eras-icon name="edit" />
                    </a>
                    <button
                      erasButton
                      variant="secondary"
                      size="sm"
                      type="button"
                      [attr.aria-label]="'Borrar ' + deck.deckName"
                      [disabled]="deleting() === deck.id"
                      (click)="remove(deck)"
                    >
                      <eras-icon name="x" />
                    </button>
                  </ng-container>
                </ng-container>
              </eras-deck-cover>
            }
          </eras-grid>
        }
      </eras-stack>
    </eras-page>
  `,
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
