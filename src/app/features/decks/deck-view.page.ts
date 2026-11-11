import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { ScreenLink } from '@core/navigation/screens';
import { apiErrorMessage } from '@core/http/api-error';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { entriesFromIds, groupByType, idsFromEntries, totalCards } from '@data/decks/deck-rules';
import { Deck } from '@data/decks/deck.model';
import { DecksStore } from '@data/decks/decks.store';
import { boxOf, deckBoxColor } from '@data/decks/deckbox-rules';
import { DeckBoxesStore } from '@data/decks/deckboxes.store';
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
import { chooseDeckBox } from './deckbox-picker-dialog.component';
import { FROM_PUBLIC_DECKS, deckBuilderQuery } from './deck-links';
import { ProxyPrintDialogComponent, ProxyPrintDialogData } from './proxy-print-dialog/proxy-print-dialog.component';

const PUBLIC_DECKS: ScreenLink = { route: '/public-decks', label: 'Mazos públicos' };

const TYPE_LABELS: Record<string, string> = { creature: 'Criaturas', structure: 'Estructuras', utility: 'Utilidades', 'sin tipo': 'Sin tipo' };

/**
 * Read-only view of a deck: cards grouped by type, card detail, proxies, edit (owner) and copy (signed in). One
 * screen high: the name, the buttons and the quick buttons stay; only the cards scroll. The owner sees the deckbox
 * the deck is in under the buttons (it opens it) and picks it with "Deckbox" (manage_decks).
 */
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
  styles: `
    .actions {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      min-block-size: 2.75rem;
    }
    .in-box {
      display: inline-flex;
      flex-shrink: 0;
      align-self: flex-start;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-pill);
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      text-decoration: none;
    }
    .in-box:hover { color: var(--color-text); }
    .in-box .dot { inline-size: 0.6rem; block-size: 0.6rem; border-radius: 50%; }
    .body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-5);
      min-block-size: 0;
      padding-block-end: var(--space-4);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
  `,
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
  // Opened from the public list: "back" returns there instead of to the player's own decks
  protected readonly back = (inject(Location).getState() as { from?: string } | null)?.from === FROM_PUBLIC_DECKS.from ? PUBLIC_DECKS : undefined;

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
  private readonly router = inject(Router);
  protected readonly deleting = signal(false);
  private readonly boxes = inject(DeckBoxesStore);
  protected readonly canManageBoxes = computed(() => this.auth.can('manage_decks'));
  /** The deckbox the (owner's) deck is in, or null when it is loose. */
  protected readonly inBox = computed(() => (this.canEdit() ? boxOf(this.id(), this.boxes.boxes()) : null));
  protected readonly boxColor = deckBoxColor;

  /** "Deckbox" (the owner): in which of their deckboxes this deck goes. */
  protected async pickBox(): Promise<void> {
    const deck = this.deck();
    if (!deck) return;
    this.error.set(null);
    try {
      await chooseDeckBox(this.modal, this.boxes, { deckId: deck.id, deckName: deck.deckName });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo mover el mazo');
    }
  }

  /** "Borrar" (the owner): after confirming, the deck is deleted and the player goes back to their decks. */
  protected async remove(): Promise<void> {
    const deck = this.deck();
    if (!deck) return;
    const ok = await this.modal.confirm({
      title: 'Eliminar mazo',
      message: `¿Eliminar "${deck.deckName}"? No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    this.error.set(null);
    try {
      await this.decks.delete(deck.id);
      void this.router.navigateByUrl('/my-decks');
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo eliminar el mazo'));
    } finally {
      this.deleting.set(false);
    }
  }

  constructor() {
    void this.cards.load();
    void this.editions.load();
    const userId = this.auth.user()?.id;
    if (userId) void this.boxes.load(userId);
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
