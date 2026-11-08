import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/**
 * "Instalar ERAS" by hand: on iPhone and iPad (Safari has no install prompt) and on Android when the browser has not
 * offered its prompt (its menu installs it).
 */
@Component({
  selector: 'eras-install-ios-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal title="Instalar ERAS" (closed)="ref.close()">
      <ol class="steps">
        @if (platform === 'android') {
          <li>Toca el menú <strong>⋮</strong> del navegador, arriba a la derecha.</li>
          <li>Elige <strong>Instalar app</strong> (en algunos teléfonos, <strong>Agregar a pantalla principal</strong>).</li>
        } @else {
          <li>Toca <strong>Compartir</strong> <eras-icon name="share" /> en la barra de Safari.</li>
          <li>Elige <strong>Agregar a inicio</strong> <eras-icon name="square-plus" />.</li>
        }
        <li>Abre ERAS desde su ícono: se abre como una aplicación y, una vez descargado, juegas contra el bot sin conexión.</li>
      </ol>
      <ng-container modal-footer>
        <button erasButton type="button" (click)="ref.close()">Entendido</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .steps { display: grid; gap: var(--space-3); margin: 0; padding-inline-start: 1.25rem; }
    eras-icon { display: inline-block; inline-size: 1rem; block-size: 1rem; vertical-align: -0.15em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallIosDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly platform = inject<'ios' | 'android' | null>(DIALOG_DATA, { optional: true }) ?? 'ios';
}
