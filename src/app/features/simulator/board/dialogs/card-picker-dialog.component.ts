import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CardSlot } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface CardPickerData {
  title: string;
  subtitle?: string;
  cards: readonly CardSlot[];
  /** Most cards that can be chosen. */
  max: number;
  /** Exactly `max` must be chosen (otherwise "up to"). */
  exact?: boolean;
  /** Cards that meet the effect's filter; the rest can still be shown and chosen on request. */
  matches?: (slot: CardSlot) => boolean;
  filterLabel?: string;
  confirmLabel?: string;
}

/** Choose cards for an effect. Closes with the chosen instance ids (undefined when cancelled). */
@Component({
  selector: 'eras-card-picker-dialog',
  imports: [SheetComponent, GameCardComponent, StackComponent, EmptyStateComponent, ButtonComponent],
  template: `
    <eras-sheet size="lg" [title]="data.title" [subtitle]="subtitle()" (closed)="ref.close()">
      @if (data.matches && hiddenCount() > 0) {
        <eras-stack direction="row" [gap]="2" align="center" justify="space-between" wrap>
          <span>{{ showAll() ? 'Mostrando todas las cartas' : hiddenCount() + ' no cumplen el filtro' + (data.filterLabel ? ' (' + data.filterLabel + ')' : '') }}</span>
          <button erasButton variant="ghost" size="sm" type="button" (click)="showAll.set(!showAll())">
            {{ showAll() ? 'Solo las que cumplen' : 'Mostrar todas' }}
          </button>
        </eras-stack>
      }
      @if (visible().length === 0) {
        <eras-empty-state title="No hay cartas para elegir" />
      } @else {
        <div class="cards" role="group" [attr.aria-label]="data.title">
          @for (c of visible(); track c.instanceId) {
            <button
              type="button"
              class="pick"
              [class.chosen]="chosen().has(c.instanceId)"
              [class.outside]="data.matches && !data.matches(c)"
              [attr.aria-pressed]="chosen().has(c.instanceId)"
              [attr.aria-label]="c.cardName ?? 'Carta'"
              (click)="toggle(c.instanceId)"
            >
              <eras-game-card [imageUrl]="c.imageUrl" />
              <span class="name">{{ c.cardName }}</span>
            </button>
          }
        </div>
      }
      <ng-container sheet-footer>
        <button erasButton variant="secondary" type="button" (click)="ref.close()">Cancelar</button>
        <button erasButton type="button" [disabled]="!canConfirm()" (click)="ref.close([...chosen()])">
          {{ data.confirmLabel ?? 'Confirmar' }} ({{ chosen().size }}/{{ data.max }})
        </button>
      </ng-container>
    </eras-sheet>
  `,
  styles: `
    .cards {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-3);
    }
    .pick {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      cursor: pointer;
      --game-card-width: 5rem;
    }
    .pick:hover { background: var(--color-surface-muted); }
    .pick.chosen { border-color: var(--color-primary); background: var(--color-surface-muted); }
    .pick.outside { opacity: 0.5; }
    .pick:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
    .name {
      max-inline-size: 100%;
      overflow: hidden;
      font-size: var(--font-size-xs);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPickerDialogComponent {
  protected readonly data = inject<CardPickerData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string[]>>(DialogRef);

  protected readonly chosen = signal<Set<string>>(new Set());
  protected readonly showAll = signal(false);

  protected readonly hiddenCount = computed(() => (this.data.matches ? this.data.cards.filter((c) => !this.data.matches!(c)).length : 0));
  protected readonly visible = computed(() =>
    this.data.matches && !this.showAll() ? this.data.cards.filter((c) => this.data.matches!(c)) : this.data.cards,
  );
  protected readonly subtitle = computed(
    () => this.data.subtitle ?? `Elige ${this.data.exact ? '' : 'hasta '}${this.data.max} ${this.data.max === 1 ? 'carta' : 'cartas'}`,
  );
  protected readonly canConfirm = computed(() => {
    const n = this.chosen().size;
    return this.data.exact ? n === this.data.max : n <= this.data.max;
  });

  protected toggle(id: string): void {
    const next = new Set(this.chosen());
    if (next.has(id)) next.delete(id);
    else if (next.size < this.data.max) next.add(id);
    else if (this.data.max === 1) {
      next.clear();
      next.add(id);
    }
    this.chosen.set(next);
  }
}
