import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { CatalogCard } from '@data/cards/card.model';
import { EMPTY_FILTERS, filterCards, sortCards } from '@data/cards/card-filters';
import { cardImageUrl } from '@data/cards/card-rules';
import { CardsStore } from '@data/cards/cards.store';
import { Edition } from '@data/editions/edition.model';
import { canSimulatePack } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { CardThumbComponent } from '@ui/domain/card-thumb/card-thumb.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../cards/card-detail-dialog/card-detail-dialog.component';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { SimulateDialogComponent } from './simulate-dialog/simulate-dialog.component';

/** Editions as rows of their cards: browse, simulate openings and (with manage_editions) create or edit. */
@Component({
  selector: 'eras-editions-page',
  imports: [
    EditDirective,
    PageComponent,
    CardThumbComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './editions.page.html',
  styleUrl: './editions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionsPage {
  protected readonly store = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);
  protected readonly cardsStore = inject(CardsStore);

  protected readonly canSimulate = canSimulatePack;
  protected readonly imageUrl = cardImageUrl;
  /** Cards shown in a row; the rest are one click away ("Ver todas"). */
  protected readonly rowSize = 24;

  /** Each edition's cards, in printed order. */
  private readonly byEdition = computed(() => {
    const all = this.cardsStore.cards();
    return new Map(
      this.store.editions().map((e) => [e.editionId, sortCards(filterCards(all, { ...EMPTY_FILTERS, edition: e.editionId }, false), 'number', 'asc')]),
    );
  });

  constructor() {
    void this.store.load();
    void this.cardsStore.load();
  }

  protected cardsOf(editionId: string): CatalogCard[] {
    return this.byEdition().get(editionId) ?? [];
  }

  protected openCard(cards: CatalogCard[], index: number): void {
    const data: CardDetailDialogData = { cards, index };
    this.modal.open(CardDetailDialogComponent, { data });
  }

  protected openCards(edition: Edition): void {
    void this.router.navigate(['/cards'], { queryParams: { edition: edition.editionId } });
  }

  protected openSimulation(edition: Edition): void {
    this.modal.open(SimulateDialogComponent, { data: edition });
  }

  /** Create (null) or edit an edition in a dialog; the store refreshes the list on save. */
  protected openForm(edition: Edition | null): void {
    this.modal.open(EditionFormDialogComponent, { data: edition });
  }
}
