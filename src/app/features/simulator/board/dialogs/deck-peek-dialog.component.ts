import { CdkMenuTrigger } from '@angular/cdk/menu';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';

export interface DeckPeekData {
  position: 'top' | 'bottom';
  n: number;
}

/**
 * Looks at the top/bottom N cards of your deck (the opponent is told): take some out,
 * reorder the rest and put them back on top, at the bottom, or shuffle them in.
 */
@Component({
  selector: 'eras-deck-peek-dialog',
  imports: [SheetComponent, GameCardComponent, StackComponent, EmptyStateComponent, ButtonComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  template: `
    <eras-sheet [title]="(data.position === 'top' ? 'Tope' : 'Fondo') + ' del mazo'" [subtitle]="cards().length + ' cartas, en orden'" (closed)="ref.close()">
      @if (cards().length === 0) {
        <eras-empty-state title="No quedan cartas por ordenar" />
      } @else {
        <ol class="cards">
          @for (c of cards(); track c.instanceId; let i = $index) {
            <li>
              <span class="pos">{{ i + 1 }}</span>
              <eras-game-card [imageUrl]="c.imageUrl" [name]="c.cardName ?? null" [attr.aria-label]="c.cardName" />
              <eras-stack direction="row" [gap]="1">
                <button erasButton variant="ghost" size="sm" type="button" aria-label="Mover antes" [disabled]="i === 0" (click)="shift(i, -1)">◀</button>
                <button erasButton variant="secondary" size="sm" type="button" [cdkMenuTriggerFor]="actions" [attr.aria-label]="'Sacar ' + (c.cardName ?? 'carta')">Sacar…</button>
                <button erasButton variant="ghost" size="sm" type="button" aria-label="Mover después" [disabled]="i === cards().length - 1" (click)="shift(i, 1)">▶</button>
              </eras-stack>
              <ng-template #actions>
                <eras-menu>
                  <button erasMenuItem (triggered)="take(c, 'hand')">A la mano</button>
                  <button erasMenuItem (triggered)="reveal(c)">Revelar y a la mano</button>
                  <button erasMenuItem (triggered)="take(c, 'field')">Al campo</button>
                  <button erasMenuItem (triggered)="take(c, 'tributeZone', undefined, false)">A tributos</button>
                  <button erasMenuItem (triggered)="take(c, 'discardPile', undefined, false)">Al descarte</button>
                  <button erasMenuItem (triggered)="take(c, 'lifeStack', 'top', true)">A las vidas (boca abajo)</button>
                </eras-menu>
              </ng-template>
            </li>
          }
        </ol>
      }
      <ng-container sheet-footer>
        <button erasButton variant="secondary" type="button" [disabled]="!cards().length" (click)="putBack('top', false)">Devolver al tope</button>
        <button erasButton variant="secondary" type="button" [disabled]="!cards().length" (click)="putBack('bottom', false)">Al fondo</button>
        <button erasButton type="button" (click)="cards().length ? putBack('top', true) : ref.close()">{{ cards().length ? 'Barajar en el mazo' : 'Cerrar' }}</button>
      </ng-container>
    </eras-sheet>
  `,
  styles: `
    .cards { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
    li { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
    .pos { color: var(--color-text-muted); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckPeekDialogComponent {
  protected readonly data = inject<DeckPeekData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  private readonly game = inject(GameStore);

  // Snapshot taken when opened: the order is the player's working copy until it is put back
  private readonly deck = this.game.myState()?.deck ?? [];
  protected readonly cards = signal<CardSlot[]>((this.data.position === 'top' ? this.deck.slice(0, this.data.n) : this.deck.slice(-this.data.n)).map((c) => ({ ...c, faceDown: false })));

  constructor() {
    this.game.viewDeck(this.data.position, this.data.n);
  }

  protected shift(index: number, step: -1 | 1): void {
    this.cards.update((list) => {
      const next = [...list];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  }

  protected take(c: CardSlot, to: ZoneName, toPosition?: 'top' | 'bottom', faceDown?: boolean): void {
    this.game.moveCard(c.instanceId, 'deck', to, { toPosition, faceDown });
    this.cards.update((list) => list.filter((x) => x.instanceId !== c.instanceId));
  }

  protected reveal(c: CardSlot): void {
    this.game.revealToHand(c.instanceId);
    this.cards.update((list) => list.filter((x) => x.instanceId !== c.instanceId));
  }

  protected putBack(position: 'top' | 'bottom', shuffle: boolean): void {
    this.game.deckReorderTop(this.cards().map((c) => c.instanceId), position, shuffle);
    this.ref.close();
  }
}
