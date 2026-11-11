import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DECKBOX_COLORS, DeckBox, DeckBoxColor } from '@data/decks/deckbox.model';
import { DECKBOX_MAX, DECKBOX_NAME_MAX, boxNameError, cleanBoxName, deckBoxColor, moveBox } from '@data/decks/deckbox-rules';
import { DeckBoxesStore } from '@data/decks/deckboxes.store';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { FormFieldComponent } from '@ui/forms/form-field/form-field.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { ColorSwatchesComponent } from './color-swatches.component';

export interface DeckBoxConfigData {
  /** The deckbox to edit; without one, a new deckbox is created. */
  box?: DeckBox;
}

/** What happened: the deckbox created or saved, or that it was deleted. */
export type DeckBoxConfigResult = { saved: DeckBox } | { deleted: true };

/**
 * A deckbox's settings: name and color. New ("Nueva deckbox" in "Mazos"), or an existing one, which can also move
 * a place back or forward among the deckboxes and be deleted (its decks are left loose).
 */
@Component({
  selector: 'eras-deckbox-config-dialog',
  imports: [ModalComponent, FormFieldComponent, ButtonComponent, IconComponent, AlertComponent, ColorSwatchesComponent],
  template: `
    <eras-modal [title]="editing ? 'Editar deckbox' : 'Nueva deckbox'" (closed)="ref.close()">
      @if (error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <form class="form" (submit)="$event.preventDefault(); save()">
        <div class="preview" aria-hidden="true">
          <span class="box" [style.--box]="previewColor()"><span class="lid"></span></span>
        </div>
        <eras-form-field label="Nombre" [error]="name() && nameError() ? nameError() : null">
          <input
            [maxLength]="nameMax"
            [value]="name()"
            placeholder="Por ejemplo: Competitivos"
            (input)="name.set($any($event.target).value)"
            (keydown.enter)="$event.preventDefault(); save()"
          />
        </eras-form-field>
        <div class="field">
          <span class="field-label">Color</span>
          <eras-color-swatches [value]="color()" (valueChange)="color.set($event)" />
        </div>
        @if (editing && position(); as pos) {
          <div class="field">
            <span class="field-label">Posición: {{ pos.index + 1 }} de {{ pos.total }}</span>
            <div class="moves">
              <button erasButton variant="secondary" size="sm" type="button" [disabled]="busy() || pos.index === 0" (click)="move(-1)">
                <eras-icon name="chevron-left" /> Antes
              </button>
              <button erasButton variant="secondary" size="sm" type="button" [disabled]="busy() || pos.index === pos.total - 1" (click)="move(1)">
                Después <eras-icon name="chevron-right" />
              </button>
            </div>
          </div>
        }
      </form>
      <ng-container modal-footer>
        @if (editing) {
          <button erasButton variant="ghost" type="button" class="delete" [disabled]="busy()" (click)="remove()"><eras-icon name="trash" /> Borrar</button>
        }
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="busy() || !!nameError() || full()" (click)="save()">{{ editing ? 'Guardar' : 'Crear' }}</button>
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .form {
      display: grid;
      gap: var(--space-4);
    }
    .preview {
      display: grid;
      place-items: center;
    }
    .box {
      position: relative;
      inline-size: 4.5rem;
      block-size: 3rem;
      border-radius: var(--radius-sm) var(--radius-sm) var(--radius-md) var(--radius-md);
      background: linear-gradient(165deg, color-mix(in srgb, var(--box) 80%, var(--color-surface)), color-mix(in srgb, var(--box) 75%, var(--color-text)));
      box-shadow: var(--shadow-md);
    }
    .lid {
      position: absolute;
      inset-inline: 0;
      inset-block-start: 0;
      block-size: 22%;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      background: color-mix(in srgb, var(--box) 65%, var(--color-text));
    }
    .field {
      display: grid;
      gap: var(--space-2);
    }
    .field-label {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .moves {
      display: flex;
      gap: var(--space-2);
    }
    .delete {
      margin-inline-end: auto;
      color: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckBoxConfigDialogComponent {
  protected readonly ref = inject<DialogRef<DeckBoxConfigResult>>(DialogRef);
  private readonly data = inject<DeckBoxConfigData | null>(DIALOG_DATA, { optional: true }) ?? {};
  private readonly store = inject(DeckBoxesStore);
  private readonly modal = inject(ModalService);

  protected readonly editing = !!this.data.box;
  private readonly boxId = this.data.box?.id ?? null;
  protected readonly nameMax = DECKBOX_NAME_MAX;
  protected readonly name = signal(this.data.box?.name ?? '');
  // A new deckbox gets the first color the player has not used yet
  protected readonly color = signal<DeckBoxColor>(
    this.data.box?.color ?? DECKBOX_COLORS.find((c) => !this.store.boxes().some((b) => b.color === c)) ?? DECKBOX_COLORS[0],
  );
  protected readonly previewColor = computed(() => deckBoxColor({ color: this.color() }));
  protected readonly nameError = computed(() => boxNameError(this.name(), this.store.boxes(), this.boxId));
  protected readonly full = computed(() => !this.editing && this.store.boxes().length >= DECKBOX_MAX);
  protected readonly position = computed(() => {
    const index = this.store.boxes().findIndex((b) => b.id === this.boxId);
    return index < 0 ? null : { index, total: this.store.boxes().length };
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(
    !this.editing && this.store.boxes().length >= DECKBOX_MAX ? `Llegaste al máximo de ${DECKBOX_MAX} deckboxes.` : null,
  );

  protected async save(): Promise<void> {
    if (this.nameError() || this.full() || this.busy()) return;
    const request = { name: cleanBoxName(this.name()), color: this.color() };
    await this.run(async () => {
      if (this.boxId) {
        await this.store.update(this.boxId, request);
        const saved = this.store.boxes().find((b) => b.id === this.boxId);
        if (saved) this.ref.close({ saved });
      } else {
        this.ref.close({ saved: await this.store.create(request) });
      }
    });
  }

  protected move(step: -1 | 1): void {
    if (this.boxId) void this.run(() => this.store.reorder(moveBox(this.store.boxes(), this.boxId!, step)));
  }

  protected async remove(): Promise<void> {
    if (!this.boxId) return;
    const ok = await this.modal.confirm({
      title: 'Borrar deckbox',
      message: `¿Borrar "${this.data.box?.name}"? Sus mazos no se borran: quedan sueltos en Mazos.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    await this.run(async () => {
      await this.store.delete(this.boxId!);
      this.ref.close({ deleted: true });
    });
  }

  private async run(task: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await task();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      this.busy.set(false);
    }
  }
}
