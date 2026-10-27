import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormFieldComponent } from '../../forms/form-field/form-field.component';
import { ButtonComponent } from '../../primitives/button/button.component';
import { ModalComponent } from '../modal/modal.component';

export interface PromptDialogData {
  title: string;
  label: string;
  value?: string;
  confirmLabel?: string;
}

/** Asks for one line of text. Closes with the trimmed text, or nothing when cancelled. Open with `ModalService.prompt()`. */
@Component({
  selector: 'eras-prompt-dialog',
  imports: [ModalComponent, FormFieldComponent, ButtonComponent],
  template: `
    <eras-modal [title]="data.title" (closed)="ref.close()">
      <form (submit)="$event.preventDefault(); accept()">
        <eras-form-field [label]="data.label">
          <input [value]="text()" (input)="text.set($any($event.target).value)" />
        </eras-form-field>
      </form>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="!text().trim()" (click)="accept()">{{ data.confirmLabel ?? 'Aceptar' }}</button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptDialogComponent {
  protected readonly data = inject<PromptDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
  protected readonly text = signal(this.data.value ?? '');

  protected accept(): void {
    if (this.text().trim()) this.ref.close(this.text().trim());
  }
}
