import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Edition, EditionSaveRequest } from '@data/editions/edition.model';
import { EditionsStore } from '@data/editions/editions.store';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { EditionFormComponent } from './edition-form.component';

/** Create (data = null) or edit an edition in a dialog. Closes with `true` once saved. */
@Component({
  selector: 'eras-edition-form-dialog',
  imports: [ModalComponent, EditionFormComponent],
  template: `
    <eras-modal
      size="xl"
      [title]="edition ? 'Editar ' + edition.editionId : 'Nueva edición'"
      [subtitle]="edition?.editionName ?? 'Datos, tipos de sobre y configuración de caja'"
      (closed)="ref.close()"
    >
      <eras-edition-form
        [edition]="edition"
        [saving]="saving()"
        [serverError]="error()"
        (submitted)="save($event)"
        (cancelled)="ref.close()"
      />
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditionFormDialogComponent {
  protected readonly edition = inject<Edition | null>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly store = inject(EditionsStore);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save(request: EditionSaveRequest): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.store.save(request);
      this.ref.close(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la edición');
    } finally {
      this.saving.set(false);
    }
  }
}
