import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent, PromptDialogData } from '../prompt-dialog/prompt-dialog.component';

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

  /** Resolves the entered text, or undefined when cancelled. */
  prompt(data: PromptDialogData): Promise<string | undefined> {
    return firstValueFrom(this.open<string, PromptDialogData>(PromptDialogComponent, { data }).closed);
  }

  /** Resolves `true` only when the user confirms. */
  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const ref = this.open<boolean, ConfirmDialogData>(ConfirmDialogComponent, { data });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
