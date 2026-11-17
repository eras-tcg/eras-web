import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { CardRefData } from '@data/cards/card.model';
import { CardsAdminApi } from '@data/cards/cards-admin.api';
import { MetaForm, toMetaPayload, validateMeta } from '@data/cards/meta-rules';
import { CardImageComponent } from '@ui/domain/card-image/card-image.component';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { SplitComponent } from '@ui/layout/split/split.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { MetaFieldsComponent } from './meta-fields.component';

export interface MetaFormData {
  form: MetaForm;
  /** Existing metadata id; null creates new metadata. */
  metaId: string | null;
  imageUrl: string | null;
  ref: CardRefData | null;
}

/** Create or edit a card's metadata (manage_cards). Closes with `true` when saved. */
@Component({
  selector: 'eras-meta-form-dialog',
  imports: [ModalComponent, SplitComponent, StackComponent, CardImageComponent, AlertComponent, ButtonComponent, MetaFieldsComponent],
  templateUrl: './meta-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaFormDialogComponent {
  protected readonly data = inject<MetaFormData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(CardsAdminApi);

  protected readonly f = signal<MetaForm>(structuredClone(this.data.form));
  protected readonly saving = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected async save(): Promise<void> {
    const errors = validateMeta(this.f());
    this.errors.set(errors);
    if (errors.length) return;
    this.saving.set(true);
    try {
      const payload = toMetaPayload(this.f());
      await firstValueFrom(this.data.metaId ? this.api.updateMeta(this.data.metaId, payload) : this.api.createMeta(payload));
      this.ref.close(true);
    } catch (e) {
      this.errors.set([apiErrorMessage(e, 'No se pudieron guardar los metadatos')]);
    } finally {
      this.saving.set(false);
    }
  }
}
