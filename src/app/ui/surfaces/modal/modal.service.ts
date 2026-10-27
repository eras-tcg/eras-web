import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';

/** Opens dialogs with the app's backdrop and sensible defaults (focus trap, Esc to close). */
@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly dialog = inject(Dialog);

  open<R = unknown, D = unknown, C = unknown>(
    component: ComponentType<C>,
    config: DialogConfig<D, DialogRef<R, C>> = {},
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      backdropClass: 'eras-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ...config,
    });
  }
}
