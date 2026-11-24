import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { entriesFromIds, groupByType, totalCards } from '@data/decks/deck-rules';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { FitWidthDirective } from '@ui/layout/fit-grid/fit-width.directive';
import { PageComponent } from '@ui/layout/page/page.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../cards/card-detail-dialog/card-detail-dialog.component';
import { RivalDeckState } from './rival-deck-link';

/**
 * The deck a rival played in a game of the history (the bot's as it played it), shown as a deck is: every copy side
 * by side, the whole deck in sight, a card opening in detail. Its cards come from the history in the navigation's
 * state; without them (the page reloaded) it goes back to the history.
 */
@Component({
  selector: 'eras-rival-deck-page',
  imports: [PageComponent, CardThumbComponent, EmptyStateComponent, SpinnerComponent, FitWidthDirective],
  template: `
    <eras-page [title]="'Mazo de ' + (deck?.rival ?? 'tu rival')" width="wide" fill>
      @if (deck) {
        <p class="sub">{{ deck.deckName ?? 'Mazo' }} · {{ total() }} cartas</p>
      }
      @if (cards.loading() && copies().length === 0) {
        <eras-empty-state title="Cargando mazo…"><eras-spinner /></eras-empty-state>
      } @else if (copies().length === 0) {
        <eras-empty-state title="Este mazo no tiene cartas" />
      } @else {
        <!-- Every copy on its own, side by side (creatures, then structures and utilities), the whole deck in sight -->
        <div class="fit" [erasFitWidth]="copies().length" [fitGap]="8">
          <div class="copies">
            @for (card of copies(); track $index) {
              <eras-card-thumb [name]="card.name ?? ''" [imageUrl]="imageUrl(card)" (selected)="openCard(card.id)" />
            }
          </div>
        </div>
      }
    </eras-page>
  `,
  styles: `
    .sub {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .fit {
      flex: 1;
      min-block-size: 0;
    }
    .copies {
      display: grid;
      grid-template-columns: repeat(auto-fill, var(--fit-width, 9rem));
      justify-content: center;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RivalDeckPage {
  protected readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly deck =
    (this.router.getCurrentNavigation()?.extras.state as RivalDeckState | undefined)?.rivalDeck ??
    (history.state as Partial<RivalDeckState> | null)?.rivalDeck ??
    null;

  private readonly resolved = computed(() =>
    entriesFromIds(
      (this.deck?.cards ?? []).flatMap((c) => (c.cardId ? Array.from({ length: c.count }, () => c.cardId as string) : [])),
      this.cards.cards(),
    ),
  );
  private readonly groups = computed(() => groupByType(this.resolved().entries));
  /** Every copy, one after another in the groups' order. */
  protected readonly copies = computed(() =>
    this.groups().flatMap((g) => g.entries.flatMap((e) => Array.from({ length: e.count }, () => e.card))),
  );
  /** As the history counted it (cards the catalog no longer has included). */
  protected readonly total = computed(() =>
    this.deck ? this.deck.cards.reduce((n, c) => n + c.count, 0) : totalCards(this.resolved().entries),
  );
  protected readonly imageUrl = cardImageUrl;

  constructor() {
    // Reloaded (nothing handed over): back to the history, where the games are
    if (!this.deck) void this.router.navigate(['/profile/history'], { replaceUrl: true });
    void this.cards.load();
  }

  protected openCard(cardId: string): void {
    const flat = this.groups().flatMap((g) => g.entries.map((e) => e.card));
    openCardDetailDialog(this.modal, flat, flat.findIndex((c) => c.id === cardId));
  }
}
