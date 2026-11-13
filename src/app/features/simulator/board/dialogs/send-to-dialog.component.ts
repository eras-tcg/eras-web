import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ZoneName } from '@data/simulator/simulator.model';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';
import { destinationOptionId, sendDestinations } from '../send-destinations';

export interface SendToOption {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
}

export interface SendToData {
  title: string;
  subtitle?: string;
  groups: { label: string; options: SendToOption[] }[];
}

/** The "Zona" options of a card of `from` (null: a Material or Recurso): `SEND_DESTINATIONS`, ids `to:<id>`. */
export function destinationOptions(from: ZoneName | null): SendToOption[] {
  return sendDestinations(from).map((d) => ({ id: destinationOptionId(d), label: d.label, icon: d.icon }));
}

/** Opens "Enviar a…"; resolves with the option's id (undefined when closed). */
export function chooseSendTo(modal: ModalService, data: SendToData): Promise<string | undefined> {
  return firstValueFrom(modal.open<string, SendToData>(SendToDialogComponent, { data }).closed);
}

/**
 * "Enviar a…": the places a card (or the cards selected) can go and what else can be done with it, by groups. The
 * one chooser of the board for moving a card by hand (zone dialog, card info's attachments, deck peek). Closes with
 * the option's id.
 */
@Component({
  selector: 'eras-send-to-dialog',
  imports: [ModalComponent, ButtonComponent, IconComponent],
  template: `
    <eras-modal [title]="data.title" [subtitle]="data.subtitle ?? null" (closed)="ref.close()">
      @for (g of data.groups; track g.label) {
        @if (g.options.length) {
          <section>
            <h4>{{ g.label }}</h4>
            <div class="options">
              @for (o of g.options; track o.id) {
                <button erasButton class="option" [variant]="o.danger ? 'danger' : 'secondary'" type="button" (click)="ref.close(o.id)">
                  @if (o.icon) {
                    <eras-icon [name]="o.icon" />
                  }
                  {{ o.label }}
                </button>
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
    .option { justify-content: flex-start; }
    .option eras-icon { flex: none; inline-size: 1.1rem; block-size: 1.1rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendToDialogComponent {
  protected readonly data = inject<SendToData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
}
