import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** What to do with a deck's unsaved changes when leaving the builder. */
export type LeaveChoice = 'save' | 'discard';

export interface LeaveDeckData {
  /** The player can save (signed in with manage_decks); otherwise only discarding is offered. */
  canSave: boolean;
}

/** Leaving the deck builder with unsaved changes: save them, discard them, or stay. */
@Component({
  selector: 'eras-leave-deck-dialog',
  imports: [ModalComponent, ButtonComponent],
  template: `
    <eras-modal title="Cambios sin guardar" (closed)="ref.close()">
      <p>El mazo tiene cambios sin guardar. ¿Qué hacemos con ellos?</p>
      <ng-container modal-footer>
        <button erasButton variant="ghost" type="button" (click)="ref.close()">Seguir editando</button>
        <button erasButton variant="danger" type="button" (click)="ref.close('discard')">Descartar</button>
        @if (data.canSave) {
          <button erasButton type="button" (click)="ref.close('save')">Guardar</button>
        }
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveDeckDialogComponent {
  protected readonly data = inject<LeaveDeckData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<LeaveChoice>>(DialogRef);
}
