import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CollectionStore } from '@data/collection/collection.store';
import { RARITY_NAMES } from '@data/editions/booster-rules';
import { RARITIES } from '@data/editions/edition.model';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

/** Edit mode (manage_users): sets the account's fragments of each rarity, to test crafting. */
@Component({
  selector: 'eras-fragments-edit-dialog',
  imports: [ModalComponent, ButtonComponent, FormFieldComponent, AlertComponent],
  template: `
    <eras-modal title="Editar fragmentos" (closed)="ref.close()">
      <div class="fields">
        @for (rarity of rarities; track rarity) {
          <eras-form-field [label]="names[rarity] + ' (' + rarity + ')'">
            <input type="number" min="0" [value]="amounts()[rarity] ?? 0" (input)="set(rarity, $event)" />
          </eras-form-field>
        }
      </div>
      @if (collection.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <ng-container modal-footer>
        <button erasButton variant="ghost" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [loading]="collection.busy()" (click)="save()">Guardar</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FragmentsEditDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly collection = inject(CollectionStore);

  protected readonly rarities = RARITIES;
  protected readonly names = RARITY_NAMES;
  protected readonly amounts = signal<Record<string, number>>({ ...this.collection.fragments() });

  protected set(rarity: string, event: Event): void {
    const value = Math.floor(Number((event.target as HTMLInputElement).value));
    this.amounts.update((a) => ({ ...a, [rarity]: Number.isFinite(value) && value > 0 ? value : 0 }));
  }

  protected async save(): Promise<void> {
    const all = Object.fromEntries(RARITIES.map((r) => [r, this.amounts()[r] ?? 0]));
    if (await this.collection.setFragments(all)) this.ref.close();
  }
}
