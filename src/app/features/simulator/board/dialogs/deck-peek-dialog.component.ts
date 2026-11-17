import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { SheetComponent } from '@ui/surfaces/sheet/sheet.component';
import { CardPeekComponent } from '../card-peek.component';
import { SendDestination, destinationOf } from '../send-destinations';
import { chooseSendTo, destinationOptions } from './send-to-dialog.component';

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
  imports: [CardPeekComponent, SheetComponent, GameCardComponent, StackComponent, EmptyStateComponent, ButtonComponent],
  template: `
    <eras-sheet [title]="(data.position === 'top' ? 'Tope' : 'Fondo') + ' del mazo'" [subtitle]="cards().length + ' cartas, en orden'" (closed)="ref.close()">
      @if (cards().length === 0) {
        <eras-empty-state title="No quedan cartas por ordenar" />
      } @else {
        <ol class="cards">
          @for (c of cards(); track c.instanceId; let i = $index) {
            <li>
              <span class="pos">{{ i + 1 }}</span>
              <eras-game-card [imageUrl]="c.imageUrl" [foil]="c.finish ?? null" [name]="c.cardName ?? null" [attr.aria-label]="c.cardName" />
              <eras-card-peek [card]="c" [mine]="true" />
              <eras-stack direction="row" [gap]="1">
                <button erasButton variant="ghost" size="sm" type="button" aria-label="Mover antes" [disabled]="i === 0" (click)="shift(i, -1)">◀</button>
                <button erasButton variant="secondary" size="sm" type="button" [attr.aria-label]="'Sacar ' + (c.cardName ?? 'carta')" (click)="send(c)">Sacar…</button>
                <button erasButton variant="ghost" size="sm" type="button" aria-label="Mover después" [disabled]="i === cards().length - 1" (click)="shift(i, 1)">▶</button>
              </eras-stack>
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
    li { position: relative; }
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
  private readonly modal = inject(ModalService);

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

  /** "Sacar…": the board's destinations (not the deck: the rest is put back below), or reveal it to the hand. */
  protected async send(c: CardSlot): Promise<void> {
    const id = await chooseSendTo(this.modal, {
      title: 'Sacar…',
      subtitle: c.cardName ?? undefined,
      groups: [
        { label: 'Zona', options: destinationOptions('deck') },
        { label: 'Carta', options: [{ id: 'reveal', label: 'Revelar y a la mano', icon: 'eye' }] },
      ],
    });
    if (id === 'reveal') return this.reveal(c);
    const to = id ? destinationOf(id) : null;
    if (to) this.take(c, to);
  }

  protected take(c: CardSlot, to: SendDestination): void {
    // Out of the deck face up into the Tributos and the Descarte (face down into the lives)
    const faceDown = to.faceDown || (to.zone === 'tributeZone' || to.zone === 'discardPile' ? false : undefined);
    this.game.moveCard(c.instanceId, 'deck', to.zone, { toPosition: to.position ?? undefined, faceDown });
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
