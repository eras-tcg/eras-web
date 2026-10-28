import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EditDirective } from '@core/auth/edit.directive';
import { Edition } from '@data/editions/edition.model';
import { canSimulatePack } from '@data/editions/edition-rules';
import { EditionsStore } from '@data/editions/editions.store';
import { EditionTileComponent } from '@ui/domain/edition-tile/edition-tile.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { GridComponent } from '@ui/layout/grid/grid.component';
import { PageComponent } from '@ui/layout/page/page.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { EditionFormDialogComponent } from './edition-form/edition-form-dialog.component';
import { SimulateDialogComponent } from './simulate-dialog/simulate-dialog.component';

/** Editions list: browse, simulate openings and (with manage_editions) create or edit. */
@Component({
  selector: 'eras-editions-page',
  imports: [
    EditDirective,
    PageComponent,
    GridComponent,
    EditionTileComponent,
    AlertComponent,
    EmptyStateComponent,
    ButtonComponent,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './editions.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionsPage {
  protected readonly store = inject(EditionsStore);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  protected readonly canSimulate = canSimulatePack;

  constructor() {
    void this.store.load();
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
