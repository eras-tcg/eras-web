import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONES } from '@data/simulator/simulator.model';
import { TableComponent } from '@ui/data/table/table.component';
import { BadgeComponent } from '@ui/primitives/badge/badge.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { PluralPipe } from '@ui/utilities/plural.pipe';

interface DeckRow {
  cardId: string;
  name: string;
  copies: CardSlot[];
  /** Copies no longer in any zone (removed from the game). */
  missing: CardSlot[];
}

/** The deck you joined with: copies per card, restore removed copies, refresh card data after an admin edit. */
@Component({
  selector: 'eras-decklist-dialog',
  imports: [PluralPipe, ModalComponent, TableComponent, BadgeComponent, ButtonComponent],
  template: `
    <eras-modal title="Tu mazo" [subtitle]="total() | plural: 'carta'" (closed)="ref.close()">
      <eras-table>
        <table>
          <thead><tr><th>Carta</th><th>Copias</th><th class="actions">Acciones</th></tr></thead>
          <tbody>
            @for (row of rows(); track row.cardId) {
              <tr>
                <td>{{ row.name }}</td>
                <td>
                  {{ row.copies.length }}
                  @if (row.missing.length) {
                    <eras-badge tone="danger">{{ row.missing.length }} eliminada{{ row.missing.length > 1 ? 's' : '' }}</eras-badge>
                  }
                </td>
                <td class="actions">
                  @if (row.missing.length) {
                    <button erasButton variant="secondary" size="sm" type="button" (click)="game.restoreCard(row.missing[0])">Restaurar 1</button>
                  }
                  <button erasButton variant="ghost" size="sm" type="button" (click)="game.refreshCardMetadata(row.cardId)">Actualizar datos</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </eras-table>
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecklistDialogComponent {
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);

  protected readonly total = computed(() => this.game.myState()?.originalDeck.length ?? 0);
  protected readonly rows = computed<DeckRow[]>(() => {
    const me = this.game.myState();
    if (!me) return [];
    const present = new Set<string>();
    for (const zone of ZONES) {
      for (const c of me[zone]) {
        present.add(c.instanceId);
        for (const a of [...c.materials, ...c.resources]) present.add(a.instanceId);
      }
    }
    const rows = new Map<string, DeckRow>();
    for (const slot of me.originalDeck) {
      const row = rows.get(slot.cardId) ?? { cardId: slot.cardId, name: slot.cardName ?? '—', copies: [], missing: [] };
      row.copies.push(slot);
      if (!present.has(slot.instanceId)) row.missing.push(slot);
      rows.set(slot.cardId, row);
    }
    return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });
}
