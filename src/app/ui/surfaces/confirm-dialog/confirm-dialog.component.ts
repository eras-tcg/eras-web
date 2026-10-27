import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '../../primitives/button/button.component';
import { ModalComponent } from '../modal/modal.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

/** Yes/no question. Closes with `true` when confirmed. Open it with `ModalService.confirm()`. */
@Component({
  selector: 'eras-confirm-dialog',
  imports: [ModalComponent, ButtonComponent],
  template: `
    <eras-modal [title]="data.title" (closed)="ref.close(false)">
      <p>{{ data.message }}</p>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close(false)">Cancelar</button>
        <button erasButton [variant]="data.danger ? 'danger' : 'primary'" type="button" (click)="ref.close(true)">
          {{ data.confirmLabel ?? 'Aceptar' }}
        </button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
