import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { EMPTY_FILTERS, filterCards } from '@data/cards/card-filters';
import { CardsStore } from '@data/cards/cards.store';
import { Edition } from '@data/editions/edition.model';
import { canSimulatePack } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { SimulateDialogComponent } from './simulate-dialog/simulate-dialog.component';

/** Editions as cards (art, title, description): open their cards, simulate openings and (with manage_editions) create or edit. */
@Component({
  selector: 'eras-editions-page',
  imports: [
    EditDirective,
    PageComponent,
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

  /** How many cards each edition has in the catalog (as the catalog's edition filter counts them). */
  private readonly counts = computed(() => {
    const all = this.cardsStore.cards();
    return new Map(this.store.editions().map((e) => [e.editionId, filterCards(all, { ...EMPTY_FILTERS, edition: e.editionId }, false).length]));
  });

  constructor() {
    void this.store.load();
    void this.cardsStore.load();
  }

  /** The cards found in the catalog, or the number the edition declares while the catalog loads. */
  protected cardCount(edition: Edition): number {
    return this.counts().get(edition.editionId) || edition.numberOfCards || 0;
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
