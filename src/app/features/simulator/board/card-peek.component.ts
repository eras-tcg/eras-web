import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONES } from '@data/simulator/simulator.model';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { CardInfoData, CardInfoDialogComponent } from './dialogs/card-info-dialog.component';

/**
 * The eye at the upper right corner of a card listed in a choice or a panel: the card in detail. A card on the table
 * opens with what it has now (Materiales, Recursos, modifiers); any other, as in the cards catalog. The card's box
 * must be positioned (position: relative). Hidden for a face-down card the player may not see.
 */
@Component({
  selector: 'eras-card-peek',
  imports: [IconButtonComponent],
  template: `
    @if (card(); as c) {
      @if (!c.faceDown || game.seeAll() || mine()) {
        <button type="button" erasIconButton icon="eye" size="sm" [attr.aria-label]="'Ver ' + (c.cardName ?? 'la carta')" (click)="open($event, c)"></button>
      }
    }
  `,
  styles: `
    :host { position: absolute; inset-block-start: 0.4rem; inset-inline-end: 0.4rem; z-index: 2; opacity: 0.85; }
    :host(:hover), :host(:focus-within) { opacity: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPeekComponent {
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);

  readonly card = input<CardSlot | null>(null);
  /** A card of the player's own that they may look at even face down (their deck, their face-down Tributos). */
  readonly mine = input(false);

  protected open(event: Event, c: CardSlot): void {
    // The eye sits on the card's button: looking does not pick it
    event.stopPropagation();
    for (const opponent of [false, true]) {
      const player = opponent ? this.game.opponentState() : this.game.myState();
      const zone = ZONES.find((z) => player?.[z].some((x) => x.instanceId === c.instanceId));
      if (zone && zone !== 'deck') {
        const data: CardInfoData = { instanceId: c.instanceId, zone, opponent, readonly: true };
        this.modal.open(CardInfoDialogComponent, { data });
        return;
      }
    }
    const catalog = this.cards.cards().find((x) => x.id === c.cardId);
    if (!catalog) return;
    const data: CardDetailDialogData = { cards: [catalog], index: 0 };
    this.modal.open(CardDetailDialogComponent, { data });
  }
}
