import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CanDirective } from '@core/auth/can.directive';
import { AuthService } from '@core/auth/auth.service';
import { CardsStore } from '@data/cards/cards.store';
import { coverFinish, shineOf } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { DeckFilters, EMPTY_DECK_FILTERS, deckEditions, filterDecks, summarizeDecks } from '@data/decks/deck-filters';
import { DeckSortKey, sortDecks } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { DeckCoverComponent } from '@ui/domain/deck-cover/deck-cover.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { DeckBrowserComponent } from './deck-browser.component';
import { MY_SORT_OPTIONS, deckBuilderQuery, deckViewLink } from './deck-links';

/**
 * "Mazos": the signed-in user's own decks (private ones included), in the deck browser (one screen high, only the
 * grid scrolls). "Nuevo mazo" comes first. Creating, editing and deleting need manage_decks.
 */
@Component({
  selector: 'eras-my-decks-page',
  imports: [RouterLink, CanDirective, PageComponent, DeckBrowserComponent, DeckCoverComponent, AlertComponent, ButtonComponent, IconComponent],
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
  private readonly collection = inject(CollectionStore);

  protected readonly sortOptions = MY_SORT_OPTIONS;
  protected readonly sortKey = signal<DeckSortKey>('name');
  protected readonly direction = signal<'asc' | 'desc'>('asc');
  protected readonly filters = signal<DeckFilters>(EMPTY_DECK_FILTERS);
  protected readonly note = computed(() =>
    this.store.error() ? null : this.store.myDecks().length === 0 ? 'Aún no tienes mazos guardados.' : this.decks().length === 0 ? 'Ningún mazo coincide con los filtros.' : null,
  );
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

  /** The player's finest copy of a deck's cover card shines over the cover. */
  protected coverShine(deck: Deck): 'foil' | 'prism' | null {
    return shineOf(coverFinish(deck, this.cards.cards(), this.collection.collection()));
  }
}
