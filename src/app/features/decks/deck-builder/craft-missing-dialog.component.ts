import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MissingCard, craftCosts, craftedSummary } from '@data/collection/collection-rules';
import { CollectionStore } from '@data/collection/collection.store';
import { RARITY_NAMES } from '@data/editions/booster-rules';
import { AlertComponent } from '@ui/feedback/alert/alert.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';

export interface CraftMissingData {
  missing: MissingCard[];
}

/**
 * Crafting every card a deck lacks: what it costs rarity by rarity against the fragments the player has; "Fabricar"
 * only when every rarity is covered (all of them are crafted together, or none).
 */
@Component({
  selector: 'eras-craft-missing-dialog',
  imports: [ModalComponent, ButtonComponent, AlertComponent, DecimalPipe],
  template: `
    <eras-modal title="Fabricar cartas no poseídas" (closed)="ref.close()">
      @if (result(); as text) {
        <p role="status">{{ text }}</p>
      } @else {
        <table class="costs">
          <thead>
            <tr><th>Rareza</th><th>Copias</th><th>Cuesta</th><th>Tienes</th></tr>
          </thead>
          <tbody>
            @for (row of costs(); track row.rarity) {
              <tr [class.short]="row.owned < row.cost">
                <td>{{ names[row.rarity] ?? row.rarity }}</td>
                <td>{{ row.copies }}</td>
                <td>{{ row.cost | number: '1.0-0' : 'es' }}</td>
                <td>{{ row.owned | number: '1.0-0' : 'es' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (uncraftable() > 0) {
          <p class="hint">{{ uncraftable() }} {{ uncraftable() === 1 ? 'copia no se puede fabricar' : 'copias no se pueden fabricar' }} (cartas sin datos).</p>
        }
        <p class="hint" [class.short]="!enough()">
          {{ enough() ? 'Tienes fragmentos suficientes.' : 'No te alcanzan los fragmentos de las rarezas marcadas.' }}
        </p>
      }
      @if (collection.error(); as message) {
        <eras-alert tone="danger">{{ message }}</eras-alert>
      }
      <ng-container modal-footer>
        @if (result()) {
          <button erasButton type="button" (click)="ref.close()">Cerrar</button>
        } @else {
          <button erasButton variant="ghost" type="button" (click)="ref.close()">Cancelar</button>
          <button erasButton type="button" [loading]="collection.busy()" [disabled]="!enough() || !costs().length" (click)="craft()">Fabricar</button>
        }
      </ng-container>
    </eras-modal>
  `,
  styles: `
    .costs { inline-size: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    .costs th, .costs td { padding: var(--space-1) var(--space-2); text-align: end; }
    .costs th:first-child, .costs td:first-child { text-align: start; }
    .costs th { color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); }
    .costs tbody tr { border-block-start: 1px solid var(--color-border); }
    .short { color: var(--color-danger); }
    .hint { margin: var(--space-3) 0 0; color: var(--color-text-muted); }
    .hint.short { color: var(--color-danger); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CraftMissingDialogComponent {
  protected readonly data = inject<CraftMissingData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly collection = inject(CollectionStore);

  protected readonly names = RARITY_NAMES;
  protected readonly costs = computed(() => craftCosts(this.data.missing, this.collection.fragments()));
  protected readonly enough = computed(() => this.costs().every((c) => c.owned >= c.cost));
  protected readonly uncraftable = computed(() => this.data.missing.filter((m) => !m.card.meta).reduce((sum, m) => sum + m.count, 0));
  protected readonly result = signal<string | null>(null);

  protected async craft(): Promise<void> {
    const cards = Object.fromEntries(this.data.missing.filter((m) => m.card.meta).map((m) => [m.card.id, m.count]));
    const finishes = await this.collection.craftMany(cards);
    if (finishes.length) this.result.set(`Fabricaste: ${craftedSummary(finishes)}.`);
  }
}
