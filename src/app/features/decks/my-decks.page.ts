import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CanDirective } from '@core/auth/can.directive';
import { AuthService } from '@core/auth/auth.service';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCardComponent } from '@ui/domain/deck-card/deck-card.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SortControlComponent } from '@ui/forms/sort-control/sort-control.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { MY_SORT_OPTIONS, deckBuilderQuery, deckViewLink } from './deck-links';

/** The signed-in user's decks (private ones included). Editing and deleting need manage_decks. */
@Component({
  selector: 'eras-my-decks-page',
  imports: [
    RouterLink,
    CanDirective,
    PageComponent,
    GridComponent,
    DeckCardComponent,
    SortControlComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <eras-page title="Mis mazos">
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

      @if (store.error(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }
      @if (actionError(); as error) {
        <eras-alert tone="danger">{{ error }}</eras-alert>
      }
      @if (store.loading() && decks().length === 0) {
        <eras-empty-state title="Cargando tus mazos…"><eras-spinner /></eras-empty-state>
      } @else if (!store.error() && decks().length === 0) {
        <eras-empty-state title="No tienes mazos guardados">
          <a *erasCan="'manage_decks'" erasButton routerLink="/deck-builder">Crear mazo</a>
        </eras-empty-state>
      } @else {
        <eras-grid minColumn="14rem">
          @for (deck of decks(); track deck.id) {
            <eras-deck-card
              [name]="deck.deckName"
              [imageUrl]="deck.deckImage ?? null"
              [cardCount]="deck.cards.length"
              [isPrivate]="!!deck.privateDeck"
              (selected)="view(deck)"
            >
              <ng-container ngProjectAs="[deck-actions]">
                <ng-container *erasCan="'manage_decks'">
                  <a erasButton variant="secondary" size="sm" routerLink="/deck-builder" [queryParams]="editQuery(deck)">
                    <eras-icon name="edit" /> Editar
                  </a>
                  <button erasButton variant="ghost" size="sm" type="button" [disabled]="deleting() === deck.id" (click)="remove(deck)">
                    <eras-icon name="x" /> Borrar
                  </button>
                </ng-container>
              </ng-container>
            </eras-deck-card>
          }
        </eras-grid>
      }
    </eras-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyDecksPage {
  protected readonly store = inject(DecksStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly sortOptions = MY_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly deleting = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly decks = computed(() => sortDecks(this.store.myDecks(), this.sortKey(), this.direction()));
  protected readonly editQuery = (deck: Deck) => deckBuilderQuery(deck.id);

  constructor() {
    const userId = this.auth.user()?.id;
    if (userId) void this.store.loadMine(userId);
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
