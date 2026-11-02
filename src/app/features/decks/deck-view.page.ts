import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { apiErrorMessage } from '@core/http/api-error';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { entriesFromIds, groupByType, idsFromEntries, totalCards } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { EditionsStore } from '@data/editions/editions.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';
import { deckBuilderQuery } from './deck-links';
import { ProxyPrintDialogComponent, ProxyPrintDialogData } from './proxy-print-dialog/proxy-print-dialog.component';

const TYPE_LABELS: Record<string, string> = { creature: 'Criaturas', structure: 'Estructuras', utility: 'Utilidades', 'sin tipo': 'Sin tipo' };

/** Read-only view of a deck: cards grouped by type, card detail, proxies, edit (owner) and copy (signed in). */
@Component({
  selector: 'eras-deck-view-page',
  imports: [
    RouterLink,
    PageComponent,
    GridComponent,
    SectionHeaderComponent,
    CardThumbComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './deck-view.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckViewPage {
  /** Route param `:id`. */
  readonly id = input.required<string>();

  private readonly decks = inject(DecksStore);
  protected readonly cards = inject(CardsStore);
  private readonly editions = inject(EditionsStore);
  private readonly auth = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly location = inject(Location);

  protected readonly deck = signal<Deck | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly resolved = computed(() => entriesFromIds(this.deck()?.cards ?? [], this.cards.cards()));
  protected readonly groups = computed(() => groupByType(this.resolved().entries));
  protected readonly total = computed(() => totalCards(this.resolved().entries));
  protected readonly missing = computed(() => (this.cards.cards().length ? this.resolved().missing.length : 0));
  protected readonly canEdit = computed(() => !!this.deck() && this.auth.user()?.id === this.deck()?.userId);
  protected readonly canCopy = computed(() => this.auth.isAuthenticated());
  protected readonly imageUrl = cardImageUrl;
  protected readonly typeLabel = (type: string) => TYPE_LABELS[type] ?? type;
  protected readonly editQuery = computed(() => deckBuilderQuery(this.id()));
  protected readonly copyQuery = computed(() => deckBuilderQuery(this.id(), true));

  constructor() {
    void this.cards.load();
    void this.editions.load();
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.deck.set(await this.decks.getDeck(id));
    } catch (e) {
      this.deck.set(null);
      this.error.set(apiErrorMessage(e, 'No se encontró el mazo'));
    } finally {
      this.loading.set(false);
    }
  }

  protected back(): void {
    this.location.back();
  }

  protected openCard(cardId: string): void {
    const flat = this.groups().flatMap((g) => g.entries.map((e) => e.card));
    const data: CardDetailDialogData = { cards: flat, index: flat.findIndex((c) => c.id === cardId) };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  protected openProxies(): void {
    const data: ProxyPrintDialogData = { deckName: this.deck()?.deckName ?? 'mazo', cardIds: idsFromEntries(this.resolved().entries) };
    this.modal.open(ProxyPrintDialogComponent, { data });
  }
}
