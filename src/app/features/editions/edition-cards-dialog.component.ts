import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CatalogCard } from '@data/cards/card.model';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { RARITY_DISPLAY_ORDER, RARITY_NAMES, cardsByRarity } from '@data/editions/booster-rules';
import { Edition } from '@data/editions/edition.model';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { Rarity, RarityBadgeComponent } from '@ui/domain/rarity-badge/rarity-badge.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';

/** The cards a pack of this edition can bring, rarest first. A card opens its detail on top (no page change). */
@Component({
  selector: 'eras-edition-cards-dialog',
  imports: [ModalComponent, GridComponent, SectionHeaderComponent, CardThumbComponent, RarityBadgeComponent, EmptyStateComponent, SpinnerComponent],
  template: `
    <eras-modal title="Cartas incluidas" [subtitle]="edition.editionName ?? edition.editionId" size="xl" (closed)="ref.close()">
      @if (cards.cards().length === 0) {
        <eras-empty-state title="Cargando cartas…"><eras-spinner /></eras-empty-state>
      } @else if (groups().length === 0) {
        <eras-empty-state title="Esta edición todavía no tiene cartas con rareza" />
      } @else {
        @for (group of groups(); track group.rarity) {
          <eras-section-header [title]="rarityName(group.rarity) + ' (' + group.cards.length + ')'">
            <eras-rarity-badge [rarity]="asRarity(group.rarity)" />
          </eras-section-header>
          <eras-grid minColumn="min(8rem, 26vw)" [gap]="3" class="group">
            @for (card of group.cards; track card.id) {
              <eras-card-thumb [name]="card.name ?? ''" [imageUrl]="imageUrl(card)" (selected)="open(card)" />
            }
          </eras-grid>
        }
      }
    </eras-modal>
  `,
  styles: `
    .group {
      margin-block-end: var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionCardsDialogComponent {
  protected readonly edition = inject<Edition>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);

  protected readonly groups = computed(() => {
    const pool = cardsByRarity(this.cards.cards(), this.edition.editionId);
    return RARITY_DISPLAY_ORDER.map((rarity) => ({ rarity, cards: [...(pool.get(rarity) ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)) })).filter(
      (g) => g.cards.length > 0,
    );
  });
  protected readonly imageUrl = cardImageUrl;
  protected readonly rarityName = (r: string) => RARITY_NAMES[r] ?? r;
  protected readonly asRarity = (r: string) => r as Rarity;

  constructor() {
    void this.cards.load();
  }

  protected open(card: CatalogCard): void {
    const flat = this.groups().flatMap((g) => g.cards);
    const data: CardDetailDialogData = { cards: flat, index: flat.indexOf(card) };
    this.modal.open(CardDetailDialogComponent, { data });
  }
}
