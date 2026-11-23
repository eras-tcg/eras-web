import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { InstallPrompt } from '@core/pwa/install-prompt';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/**
 * "Descargar ERAS" as the installed page: what it gives, then how. Where the browser can install it (`prompt`: Chrome,
 * Edge), "Instalar" asks it (the browser confirms with its own small window); on iPhone and iPad (Safari has no prompt)
 * and on Android when the browser has not offered it, the steps by hand.
 */
@Component({
  selector: 'eras-install-app-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal title="Descargar ERAS" (closed)="ref.close()">
      <p class="lead">
        ERAS como aplicación: con su propio ícono, en su propia ventana y a pantalla completa, sin la barra del navegador.
        Se actualiza sola y, una vez descargado, juegas contra el bot sin conexión.
      </p>
      <ol class="steps">
        @if (platform === 'prompt') {
          <li>Toca <strong>Instalar</strong>.</li>
          <li>El navegador pide confirmarlo: elige <strong>Instalar</strong> en su ventana.</li>
          <li>ERAS se abre en su propia ventana y queda con su ícono en el escritorio o el menú de inicio.</li>
        } @else if (platform === 'android') {
          <li>Toca el menú <strong>⋮</strong> del navegador, arriba a la derecha.</li>
          <li>Elige <strong>Instalar app</strong> (en algunos teléfonos, <strong>Agregar a pantalla principal</strong>).</li>
          <li>Abre ERAS desde su ícono.</li>
        } @else {
          <li>Toca <strong>Compartir</strong> <eras-icon name="share" /> en la barra de Safari.</li>
          <li>Elige <strong>Agregar a inicio</strong> <eras-icon name="square-plus" />.</li>
          <li>Abre ERAS desde su ícono.</li>
        }
      </ol>
      <ng-container modal-footer>
        @if (platform === 'prompt') {
          <button erasButton variant="secondary" type="button" (click)="ref.close()">Cerrar</button>
          <button erasButton type="button" [loading]="busy()" (click)="install()"><eras-icon name="download" /> Instalar</button>
        } @else {
          <button erasButton type="button" (click)="ref.close()">Entendido</button>
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .lead { margin: 0 0 var(--space-3); }
    .steps { display: grid; gap: var(--space-3); margin: 0; padding-inline-start: 1.25rem; }
    eras-icon { display: inline-block; inline-size: 1rem; block-size: 1rem; vertical-align: -0.15em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallAppDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly platform = inject<'prompt' | 'ios' | 'android' | null>(DIALOG_DATA, { optional: true }) ?? 'ios';
  private readonly installer = inject(InstallPrompt);
  protected readonly busy = signal(false);

  /** The browser's own confirmation; installed (or dismissed), this window closes. */
  protected async install(): Promise<void> {
    this.busy.set(true);
    try {
      await this.installer.install();
    } finally {
      this.busy.set(false);
      this.ref.close();
    }
  }
}
