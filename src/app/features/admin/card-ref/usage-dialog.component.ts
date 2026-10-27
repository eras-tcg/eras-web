import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '@core/http/api-error';
import { CardRefApi, RefUsage } from '@data/cards/card-ref.api';
import { CardRefData, RefListField } from '@data/cards/card.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SpinnerComponent } from '@ui/primitives/spinner/spinner.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

export interface UsageDialogData {
  field: RefListField | 'keywordEffects';
  value: string;
  /** Other values it can be replaced with (list fields only). */
  alternatives: string[];
}

/**
 * Deleting a reference value: shows which cards use it and lets the admin replace it in those cards
 * (list fields), remove it from them, or just drop it from the list. Closes with the new reference data.
 */
@Component({
  selector: 'eras-usage-dialog',
  imports: [ModalComponent, StackComponent, FormFieldComponent, AlertComponent, ButtonComponent, SpinnerComponent],
  template: `
    <eras-modal title="Eliminar valor" [subtitle]="data.value" (closed)="ref.close()">
      <eras-stack [gap]="3">
        @if (error(); as message) {
          <eras-alert tone="danger">{{ message }}</eras-alert>
        }
        @if (usage(); as u) {
          @if (u.count === 0) {
            <p>Ninguna carta lo usa; se puede eliminar sin afectar nada.</p>
          } @else {
            <p>Lo usan {{ u.count }} {{ u.count === 1 ? 'carta' : 'cartas' }}:</p>
            <ul>
              @for (c of u.cards.slice(0, 20); track c.id) {
                <li>{{ c.cardName || c.id }} ({{ c.edition }} #{{ c.cardNumber }})</li>
              }
            </ul>
            @if (u.count > 20) {
              <p>…y {{ u.count - 20 }} más.</p>
            }
            @if (isList) {
              <eras-form-field label="Reemplazar por" hint="Vacío: se quita de esas cartas">
                <select (change)="replacement.set($any($event.target).value)">
                  <option value="">— Quitar de las cartas —</option>
                  @for (a of data.alternatives; track a) {
                    <option [value]="a">{{ a }}</option>
                  }
                </select>
              </eras-form-field>
            } @else {
              <eras-alert>Las cartas conservarán el texto del keyword, pero ya no tendrá descripción.</eras-alert>
            }
          }
        } @else if (!checkFailed()) {
          <eras-spinner />
        }
      </eras-stack>
      <ng-container modal-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        @if (isList && usage()?.count) {
          <button erasButton variant="danger" type="button" [loading]="busy()" [disabled]="busy()" (click)="replace()">
            {{ replacement() ? 'Reemplazar y eliminar' : 'Quitar de las cartas y eliminar' }}
          </button>
        } @else {
          <button erasButton variant="danger" type="button" [loading]="busy()" [disabled]="busy() || !usage()" (click)="remove()">Eliminar</button>
        }
      </ng-container>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageDialogComponent {
  protected readonly data = inject<UsageDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<CardRefData>>(DialogRef);
  private readonly api = inject(CardRefApi);

  protected readonly isList = this.data.field !== 'keywordEffects';
  protected readonly usage = signal<RefUsage | null>(null);
  protected readonly replacement = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly checkFailed = signal(false);

  constructor() {
    firstValueFrom(this.api.usage(this.data.field, this.data.value))
      .then((u) => this.usage.set(u))
      // Without knowing which cards use it, deleting stays disabled
      .catch((e) => {
        this.checkFailed.set(true);
        this.error.set(apiErrorMessage(e, 'No se pudo revisar qué cartas lo usan'));
      });
  }

  protected remove(): void {
    const field = this.data.field;
    void this.run(field === 'keywordEffects' ? this.api.removeKeyword(this.data.value) : this.api.removeValue(field, this.data.value));
  }

  protected replace(): void {
    if (this.data.field === 'keywordEffects') return;
    void this.run(this.api.replaceValue(this.data.field, this.data.value, this.replacement() || null));
  }

  private async run(call: Observable<CardRefData>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.ref.close(await firstValueFrom(call));
    } catch (e) {
      this.error.set(apiErrorMessage(e, 'No se pudo eliminar'));
    } finally {
      this.busy.set(false);
    }
  }
}
