import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DECKBOX_MAX, boxOf, deckBoxColor } from '@data/decks/deckbox-rules';
import { DeckBoxesStore } from '@data/decks/deckboxes.store';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { firstValueFrom } from 'rxjs';
import { DeckBoxConfigDialogComponent, DeckBoxConfigResult } from './deckbox-config-dialog.component';

export interface DeckBoxPickerData {
  deckId: string;
  deckName: string;
}

/** The deckbox chosen (null: loose), or a new one to create first. */
type PickerChoice = { boxId: string | null } | { create: true };

/** In which deckbox a deck goes (a deck is in one at most): one row per deckbox, "Sin deckbox" and "Nueva deckbox". */
@Component({
  selector: 'eras-deckbox-picker-dialog',
  imports: [ModalComponent, IconComponent],
  template: `
    <eras-modal title="Guardar en deckbox" [subtitle]="data.deckName" (closed)="ref.close()">
      <ul class="list" role="listbox" aria-label="Deckboxes">
        <li>
          <button type="button" role="option" [attr.aria-selected]="current() === null" [class.on]="current() === null" (click)="ref.close({ boxId: null })">
            <span class="dot loose" aria-hidden="true"></span>
            <span class="name">Sin deckbox</span>
            @if (current() === null) {
              <eras-icon name="check" />
            }
          </button>
        </li>
        @for (box of store.boxes(); track box.id) {
          <li>
            <button type="button" role="option" [attr.aria-selected]="current() === box.id" [class.on]="current() === box.id" (click)="ref.close({ boxId: box.id })">
              <span class="dot" [style.background]="color(box)" aria-hidden="true"></span>
              <span class="name">{{ box.name }}</span>
              @if (current() === box.id) {
                <eras-icon name="check" />
              }
            </button>
          </li>
        }
        @if (store.boxes().length < max) {
          <li>
            <button type="button" class="create" (click)="ref.close({ create: true })"><eras-icon name="plus" /> Nueva deckbox</button>
          </li>
        }
      </ul>
    </eras-modal>
  `,
  styles: `
    .list {
      display: grid;
      gap: var(--space-1);
      max-block-size: 60vh;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
    }
    button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      inline-size: 100%;
      padding: var(--space-2) var(--space-3);
      border: var(--border-width) solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: var(--color-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    button:hover,
    button:focus-visible {
      background: var(--color-surface-muted);
    }
    button.on {
      border-color: var(--color-primary);
    }
    .name {
      flex: 1;
    }
    .dot {
      inline-size: 0.8rem;
      block-size: 0.8rem;
      border-radius: 50%;
    }
    .dot.loose {
      border: 2px dashed var(--color-border);
    }
    .create {
      color: var(--color-text-muted);
    }
    eras-icon {
      inline-size: 1rem;
      block-size: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckBoxPickerDialogComponent {
  protected readonly data = inject<DeckBoxPickerData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<PickerChoice>>(DialogRef);
  protected readonly store = inject(DeckBoxesStore);
  protected readonly max = DECKBOX_MAX;
  protected readonly current = computed(() => boxOf(this.data.deckId, this.store.boxes())?.id ?? null);
  protected readonly color = deckBoxColor;
}

/**
 * Asks in which deckbox a deck goes ("Nueva deckbox" creates one first) and moves it there. Resolves when done;
 * throws a readable message if the move fails.
 */
export async function chooseDeckBox(modal: ModalService, store: DeckBoxesStore, data: DeckBoxPickerData): Promise<void> {
  const choice = await firstValueFrom(
    modal.open<PickerChoice, DeckBoxPickerData>(DeckBoxPickerDialogComponent, { data, width: 'min(26rem, 94vw)' }).closed,
  );
  if (!choice) return;
  let boxId: string | null;
  if ('create' in choice) {
    const created = await firstValueFrom(modal.open<DeckBoxConfigResult>(DeckBoxConfigDialogComponent, { width: 'min(26rem, 94vw)' }).closed);
    if (!created || !('saved' in created)) return;
    boxId = created.saved.id;
  } else {
    boxId = choice.boxId;
  }
  if (boxId !== (boxOf(data.deckId, store.boxes())?.id ?? null)) await store.moveDeck(data.deckId, boxId);
}
