import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { CardRefApi } from '@data/cards/card-ref.api';
import { CardEffect, CardRefData } from '@data/cards/card.model';
import { applyPlaceholder, cleanEffect, emptyEffect } from '@data/cards/effect-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { EffectEditorComponent } from '../../cards/effect-editor/effect-editor.component';

export interface KeywordDialogData {
  ref: CardRefData;
  /** Existing keyword to edit, or null for a new one. */
  keyword: string | null;
}

/** Creates or edits a keyword effect. Closes with the updated reference data when saved. */
@Component({
  selector: 'eras-keyword-dialog',
  imports: [ModalComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent, EffectEditorComponent],
  template: `
    <eras-modal [title]="data.keyword ? 'Editar keyword' : 'Nuevo keyword'" (closed)="ref.close()">
      <eras-stack [gap]="4">
        @if (error(); as message) {
          <eras-alert tone="danger">{{ message }}</eras-alert>
        }
        <eras-form-field label="Keyword" required hint="Con parámetro, marca su lugar con @: “Provocar @”">
          <input [value]="name()" (input)="name.set($any($event.target).value)" />
        </eras-form-field>
        <eras-form-field label="Nombre del parámetro" hint="Opcional. Ej.: nivel → “Provocar {nivel}”; también reemplaza @ en el texto del efecto">
          <input [value]="placeholder()" (input)="placeholder.set($any($event.target).value)" />
        </eras-form-field>
        <eras-effect-editor
          [value]="effect()"
          [instances]="data.ref.instances ?? []"
          [kinds]="data.ref.kinds ?? []"
          [tags]="data.ref.tags ?? []"
          [instanceKinds]="data.ref.instanceKinds ?? {}"
          (valueChange)="effect.set($event)"
        />
      </eras-stack>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [loading]="saving()" [disabled]="saving() || !name().trim()" (click)="save()">Guardar</button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordDialogComponent {
  protected readonly data = inject<KeywordDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CardRefData>>(DialogRef);
  private readonly api = inject(CardRefApi);

  private readonly existing = this.data.keyword ? this.data.ref.keywordEffects?.[this.data.keyword] : undefined;
  protected readonly name = signal(this.data.keyword ?? '');
  protected readonly placeholder = signal('');
  protected readonly effect = signal<CardEffect>(this.existing?.effect ? structuredClone(this.existing.effect) : emptyEffect());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save(): Promise<void> {
    const { keyword, effect } = applyPlaceholder(this.name(), cleanEffect(this.effect()), this.placeholder());
    if (!keyword) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      // Renaming: the backend keys keywords by name, so the old entry goes first
      if (this.data.keyword && this.data.keyword !== keyword) await firstValueFrom(this.api.removeKeyword(this.data.keyword));
      this.ref.close(await firstValueFrom(this.api.saveKeyword(keyword, effect)));
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo guardar el keyword'));
    } finally {
      this.saving.set(false);
    }
  }
}
