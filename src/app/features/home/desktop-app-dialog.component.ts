import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** "Descargar ERAS" on Windows: the installer from the site (not in the Microsoft Store) and how to install it. */
@Component({
  selector: 'eras-desktop-app-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal title="ERAS para Windows" (closed)="ref.close()">
      <p class="lead">
        ERAS en su propia ventana, con acceso directo en el escritorio: juega contra el bot sin conexión y se actualiza sola.
        No está en la Microsoft Store: se descarga de esta página.
      </p>
      <ol class="steps">
        <li>Toca <strong>Descargar</strong> y abre el archivo <strong>ERAS-Setup.exe</strong> cuando termine.</li>
        <li>
          Windows puede avisar que el programa no es reconocido: elige <strong>Más información</strong> y luego
          <strong>Ejecutar de todas formas</strong>.
        </li>
        <li>Se instala sola y abre ERAS. Inicia sesión una vez con internet; después juegas sin conexión.</li>
      </ol>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cerrar</button>
        <a erasButton [href]="exe" download="ERAS-Setup.exe" (click)="ref.close()"><eras-icon name="download" /> Descargar</a>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .lead { margin: 0 0 var(--space-3); }
    .steps { display: grid; gap: var(--space-3); margin: 0 0 var(--space-3); padding-inline-start: 1.25rem; }
    eras-icon { display: inline-block; inline-size: 1rem; block-size: 1rem; vertical-align: -0.15em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAppDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly exe = inject<string>(DIALOG_DATA);
}
