import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** What was chosen: a list file to import, exporting the list, or printing proxies. */
export type DeckOption = { action: 'import'; file: File } | { action: 'export' } | { action: 'proxies' };

export interface DeckOptionsData {
  /** The deck has no cards: there is nothing to export or print. */
  empty: boolean;
}

/** The deck's other options, behind the builder's options icon: import a list, export it, print proxies. */
@Component({
  selector: 'eras-deck-options-dialog',
  imports: [ModalComponent, ButtonComponent],
  template: `
    <eras-modal title="Opciones del mazo" (closed)="ref.close()">
      <div class="options">
        <button erasButton variant="secondary" type="button" (click)="file.click()">Importar lista</button>
        <input #file type="file" accept=".txt,text/plain" hidden (change)="pick($event)" />
        <button erasButton variant="secondary" type="button" [disabled]="data.empty" (click)="ref.close({ action: 'export' })">Exportar lista</button>
        <button erasButton variant="secondary" type="button" [disabled]="data.empty" (click)="ref.close({ action: 'proxies' })">Proxies</button>
      </div>
    </eras-modal>
  `,
  styles: `
    .options { display: grid; gap: var(--space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckOptionsDialogComponent {
  protected readonly data = inject<DeckOptionsData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<DeckOption>>(DialogRef);

  protected pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.ref.close({ action: 'import', file });
  }
}
