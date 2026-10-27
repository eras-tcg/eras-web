import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CanDirective } from '@core/auth/can.directive';
import { legacyUrl } from '@core/navigation/legacy-url';
import { Edition, EditionSaveRequest } from '@data/editions/edition.model';
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
import { EditionFormComponent } from './edition-form/edition-form.component';
import { SimulateDialogComponent } from './simulate-dialog/simulate-dialog.component';

type FormState = { open: false } | { open: true; edition: Edition | null };

/** Editions list: browse, simulate openings and (with manage_editions) create or edit. */
@Component({
  selector: 'eras-editions-page',
  imports: [
    CanDirective,
    PageComponent,
    GridComponent,
    EditionTileComponent,
    EditionFormComponent,
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

  protected readonly formState = signal<FormState>({ open: false });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly canSimulate = canSimulatePack;

  constructor() {
    void this.store.load();
  }

  protected openCards(edition: Edition): void {
    // The cards page is not migrated yet
    window.location.assign(legacyUrl(`/cards?edition=${encodeURIComponent(edition.editionId)}`));
  }

  protected openSimulation(edition: Edition): void {
    this.modal.open(SimulateDialogComponent, { data: edition });
  }

  protected openForm(edition: Edition | null): void {
    this.saveError.set(null);
    this.formState.set({ open: true, edition });
  }

  protected closeForm(): void {
    this.formState.set({ open: false });
  }

  protected async save(request: EditionSaveRequest): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.store.save(request);
      this.closeForm();
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'No se pudo guardar la edición');
    } finally {
      this.saving.set(false);
    }
  }
}
