import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

export interface SendToOption {
  id: string;
  label: string;
  danger?: boolean;
}

export interface SendToData {
  title: string;
  subtitle?: string;
  groups: { label: string; options: SendToOption[] }[];
}

/** "Enviar a…": the places a card (or the cards selected) can go and what else can be done with it. Closes with the option's id. */
@Component({
  selector: 'eras-send-to-dialog',
  imports: [ModalComponent, ButtonComponent],
  template: `
    <eras-modal [title]="data.title" [subtitle]="data.subtitle ?? null" (closed)="ref.close()">
      @for (g of data.groups; track g.label) {
        @if (g.options.length) {
          <section>
            <h4>{{ g.label }}</h4>
            <div class="options">
              @for (o of g.options; track o.id) {
                <button erasButton [variant]="o.danger ? 'danger' : 'secondary'" type="button" (click)="ref.close(o.id)">{{ o.label }}</button>
              }
            </div>
          </section>
        }
      }
    </eras-modal>
  `,
  styles: `
    section + section { margin-block-start: var(--space-4); }
    h4 { margin: 0 0 var(--space-2); font-size: var(--font-size-sm); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .options { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: var(--space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendToDialogComponent {
  protected readonly data = inject<SendToData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
}
