import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** "Descargar la app para Android": the APK from the site (not in Google Play) and how to install it. */
@Component({
  selector: 'eras-android-app-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal title="App de ERAS para Android" (closed)="ref.close()">
      <p class="lead">
        La app se abre siempre en horizontal y a pantalla completa, juega contra el bot sin conexión y se actualiza sola.
        No está en Google Play: se descarga de esta página.
      </p>
      <ol class="steps">
        <li>Toca <strong>Descargar</strong> y abre el archivo <strong>ERAS.apk</strong> cuando termine.</li>
        <li>
          La primera vez Android pide permiso para <strong>instalar apps de origen desconocido</strong> desde el navegador:
          actívalo y vuelve atrás.
        </li>
        <li>
          En Xiaomi (MIUI/HyperOS) puede aparecer un aviso de seguridad o un análisis: elige <strong>Instalar de todos modos</strong>.
        </li>
        <li>Abre ERAS desde su ícono. Inicia sesión una vez con internet; después juegas sin conexión.</li>
      </ol>
      <p class="note">Si ya usas ERAS instalada desde el navegador, puedes quitarla: la app la reemplaza.</p>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cerrar</button>
        <a erasButton [href]="apk" download="ERAS.apk" (click)="ref.close()"><eras-icon name="download" /> Descargar</a>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .lead, .note { margin: 0 0 var(--space-3); }
    .note { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .steps { display: grid; gap: var(--space-3); margin: 0 0 var(--space-3); padding-inline-start: 1.25rem; }
    eras-icon { display: inline-block; inline-size: 1rem; block-size: 1rem; vertical-align: -0.15em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AndroidAppDialogComponent {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly apk = inject<string>(DIALOG_DATA);
}
