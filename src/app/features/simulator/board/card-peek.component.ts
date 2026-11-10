import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZONES } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardDetailDialogComponent, CardDetailDialogData } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { CardInfoData, CardInfoDialogComponent } from './dialogs/card-info-dialog.component';
import { holdToPeek } from './hold-peek';

/**
 * A card listed in a choice, a panel or a viewer opens in detail when it is held pressed (mouse, finger or pen): a
 * card on the table with what it has now (Materiales, Recursos, modifiers), any other as in the cards catalog. Placed
 * inside the card's box, it listens on that box; the click the release sends is swallowed, so holding does not pick
 * the card. Not for a face-down card the player may not see.
 */
@Component({
  selector: 'eras-card-peek',
  template: '',
  styles: `
    :host { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPeekComponent {
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  private readonly modal = inject(ModalService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly card = input<CardSlot | null>(null);
  /** A card of the player's own that they may look at even face down (their deck, their face-down Tributos). */
  readonly mine = input(false);

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const box = this.host.nativeElement.parentElement;
      if (box) destroy.onDestroy(holdToPeek(box, () => this.peekable(), () => this.open()));
    });
  }

  private peekable(): boolean {
    const c = this.card();
    return !!c && (!c.faceDown || this.game.seeAll() || this.mine());
  }

  /** The card in detail: as it is on the table, or from the catalog. */
  open(): void {
    const c = this.card();
    if (!c) return;
    openCardDetail(this.game, this.cards, this.modal, c);
  }
}

/** Opens a card in detail: as it is now on the table (when it is in a zone other than the deck), else from the catalog. */
export function openCardDetail(game: GameStore, cards: CardsStore, modal: ModalService, c: CardSlot): void {
  for (const opponent of [false, true]) {
    const player = opponent ? game.opponentState() : game.myState();
    const zone = ZONES.find((z) => player?.[z].some((x) => x.instanceId === c.instanceId));
    if (zone && zone !== 'deck') {
      const data: CardInfoData = { instanceId: c.instanceId, zone, opponent, readonly: true };
      modal.open(CardInfoDialogComponent, { data });
      return;
    }
  }
  const catalog = cards.cards().find((x) => x.id === c.cardId);
  if (!catalog) return;
  const data: CardDetailDialogData = { cards: [catalog], index: 0 };
  modal.open(CardDetailDialogComponent, { data });
}
