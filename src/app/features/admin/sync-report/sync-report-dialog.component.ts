import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SyncReport } from '@data/cards/sync-report.api';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** What the server found in Drive when it woke up, for an admin. Closes with true to go and review the changes. */
@Component({
  selector: 'eras-sync-report-dialog',
  imports: [ModalComponent, ButtonComponent, DatePipe],
  template: `
    <eras-modal [title]="report.status === 'error' ? 'No se pudo revisar Drive' : 'Cambios en Drive'" (closed)="ref.close(false)">
      @if (report.status === 'error') {
        <p>Al encender el servidor no se pudieron leer los cambios de Drive: {{ report.error }}</p>
      } @else {
        <p>
          {{ report.items.length }} {{ report.items.length === 1 ? 'cambio' : 'cambios' }}
          {{ report.previousCheckAt ? 'desde el ' + (report.previousCheckAt | date: 'd MMM, HH:mm') : 'desde la última revisión' }},
          pendientes de revisar.
          @if (report.mode === 'full') {
            Se comparó todo Drive con las cartas registradas.
          }
        </p>
        <ul class="items">
          @for (item of shown; track item.fileId) {
            <li>
              <span class="action" [class.delete]="item.action === 'delete'">{{ item.action === 'delete' ? 'Quitar' : 'Nueva o cambiada' }}</span>
              {{ item.fileName ?? item.fileId }}
            </li>
          }
        </ul>
        @if (report.items.length > shown.length) {
          <p class="muted">Y {{ report.items.length - shown.length }} más.</p>
        }
      }
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close(false)">Más tarde</button>
        @if (report.status !== 'error') {
          <button erasButton type="button" (click)="ref.close(true)">Revisar cambios</button>
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .items { margin: 0; padding-inline-start: 1.25rem; max-block-size: 16rem; overflow: auto; }
    .action { font-weight: 600; margin-inline-end: 0.25rem; }
    .action.delete { color: var(--color-danger, inherit); }
    .muted { color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncReportDialogComponent {
  protected readonly report = inject<SyncReport>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly shown = this.report.items.slice(0, 20);
}
