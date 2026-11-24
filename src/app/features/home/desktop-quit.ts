import { DestroyRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { isDesktopApp } from '@core/pwa/app-mode';
import { ModalService } from '@ui/surfaces/modal/modal.service';

/**
 * In the Windows app, Escape on the home asks whether to close the app (a confirmation), as a game's main menu does.
 * Only with nothing open over the home: there Escape closes what is open (a dialog, a sheet, a menu), as always. Call
 * it from the home's constructor; it stops when the home goes.
 */
export function escapeToQuit(): void {
  if (!isDesktopApp()) return;
  const doc = inject(DOCUMENT);
  const overlays = inject(OverlayContainer);
  const modal = inject(ModalService);
  let asking = false;
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.repeat || asking) return;
    // Something open over the home takes the key (checked before it closes: this listens first, in capture)
    if (overlays.getContainerElement().querySelector('.cdk-overlay-pane')) return;
    asking = true;
    void modal
      .confirm({ title: 'Salir de ERAS', message: '¿Cerrar la aplicación?', confirmLabel: 'Salir', danger: true })
      .then((quit) => {
        asking = false;
        if (quit) doc.defaultView?.close();
      });
  };
  doc.addEventListener('keydown', onKey, true);
  inject(DestroyRef).onDestroy(() => doc.removeEventListener('keydown', onKey, true));
}
