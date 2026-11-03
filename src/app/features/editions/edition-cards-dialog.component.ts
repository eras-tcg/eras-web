import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { RARITY_DISPLAY_ORDER, cardsByRarity } from '@data/editions/booster-rules';
import { Edition } from '@data/editions/edition.model';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';

/** The cards this edition can bring, one after another, rarest first. A card opens its detail on top (no page change). */
@Component({
  selector: 'eras-edition-cards-dialog',
  imports: [ModalComponent, GridComponent, CardThumbComponent, EmptyStateComponent, SpinnerComponent],
  template: `
    <eras-modal title="Cartas incluidas" [subtitle]="edition.editionName ?? edition.editionId" size="xl" (closed)="ref.close()">
      @if (catalog.cards().length === 0) {
        <eras-empty-state title="Cargando cartas…"><eras-spinner /></eras-empty-state>
      } @else if (cards().length === 0) {
        <eras-empty-state title="Esta edición todavía no tiene cartas con rareza" />
      } @else {
        <!-- One card after another, rarest first -->
        <eras-grid minColumn="min(8rem, 26vw)" [gap]="3">
          @for (card of cards(); track card.id) {
            <eras-card-thumb [name]="card.name ?? ''" [imageUrl]="imageUrl(card)" (selected)="open(card)" />
          }
        </eras-grid>
      }
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionCardsDialogComponent {
  protected readonly edition = inject<Edition>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly catalog = inject(CardsStore);
  private readonly modal = inject(ModalService);

  /** The edition's cards, rarest first, by number inside each rarity. */
  protected readonly cards = computed(() => {
    const pool = cardsByRarity(this.catalog.cards(), this.edition.editionId);
    return RARITY_DISPLAY_ORDER.flatMap((rarity) => [...(pool.get(rarity) ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)));
  });
  protected readonly imageUrl = cardImageUrl;

  constructor() {
    void this.catalog.load();
  }

  protected open(card: CatalogCard): void {
    const data: CardDetailDialogData = { cards: this.cards(), index: this.cards().indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }
}
