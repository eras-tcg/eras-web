import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CardEffect, CardRefData } from '@data/cards/card.model';
import { cleanEffect, emptyEffect } from '@data/cards/effect-rules';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { EffectEditorComponent } from '../effect-editor/effect-editor.component';

export interface EffectDialogData {
  effect: CardEffect | null;
  ref: CardRefData | null;
  title: string;
}

/** Edits one effect of a card. Closes with the cleaned effect. */
@Component({
  selector: 'eras-effect-dialog',
  imports: [ModalComponent, EffectEditorComponent, ButtonComponent],
  template: `
    <eras-modal [title]="data.title" (closed)="ref.close()">
      <eras-effect-editor
        [value]="effect()"
        [instances]="data.ref?.instances ?? []"
        [kinds]="data.ref?.kinds ?? []"
        [tags]="data.ref?.tags ?? []"
        [instanceKinds]="data.ref?.instanceKinds ?? {}"
        [keywords]="keywords"
        (valueChange)="effect.set($event)"
      />
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" (click)="ref.close(clean())">Aceptar</button>
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EffectDialogComponent {
  protected readonly data = inject<EffectDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CardEffect>>(DialogRef);
  protected readonly effect = signal<CardEffect>(this.data.effect ? structuredClone(this.data.effect) : emptyEffect());
  protected readonly keywords = Object.keys(this.data.ref?.keywordEffects ?? {}).sort();

  protected clean(): CardEffect {
    return cleanEffect(this.effect());
  }
}
