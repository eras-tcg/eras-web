import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, booleanAttribute, inject, input } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { openCardDetailDialog } from '../../cards/card-detail-dialog/card-detail-dialog.component';
import { holdToPeek } from './hold-peek';

/**
 * A card listed in a choice, a panel or a viewer opens in detail when it is held pressed (mouse, finger or pen): a
 * card on the table with what it has now (Materiales, Recursos, modifiers), any other as in the cards catalog. Placed
 * inside the card's box, it listens on that box; the click the release sends is swallowed, so holding does not pick
 * the card. Not for a face-down card the player may not see. With `openOnClick` (a viewer only to look at cards), a click
 * opens it too.
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
  /** A click on its box opens it too (where clicking the card does nothing else). */
  readonly openOnClick = input(false, { transform: booleanAttribute });

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const box = this.host.nativeElement.parentElement;
      if (!box) return;
      destroy.onDestroy(holdToPeek(box, () => this.peekable(), () => this.open()));
      const click = () => {
        if (this.openOnClick() && this.peekable()) this.open();
      };
      box.addEventListener('click', click);
      destroy.onDestroy(() => box.removeEventListener('click', click));
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

/**
 * Opens a card of the game in detail: the card itself as in the catalog (nothing of the game: its place, Materiales or
 * modifiers show in the panel beside the board), in the finish of this copy, read only.
 */
export function openCardDetail(_game: GameStore, cards: CardsStore, modal: ModalService, c: CardSlot): void {
  openCatalogCard(cards, modal, c.cardId, c.finish ?? null);
}

/**
 * Opens a card of the game as in the cards catalog, read only (no administration, even for editors), shining in
 * `finish` (the copy's). Nothing when the catalog does not have it.
 */
export function openCatalogCard(cards: CardsStore, modal: ModalService, cardId: string | null | undefined, finish: 'foil' | 'prism' | null = null): void {
  const catalog = cards.cards().find((x) => x.id === cardId);
  if (catalog) openCardDetailDialog(modal, [catalog], 0, { copy: { foil: finish }, readonly: true });
}
