import { Injectable, inject } from '@angular/core';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { AttachmentType, CardInfoData, CardInfoDialogComponent } from './dialogs/card-info-dialog.component';
import { CreatureInteractionData, CreatureInteractionDialogComponent } from './dialogs/creature-interaction-dialog.component';
import { DeckPeekData, DeckPeekDialogComponent } from './dialogs/deck-peek-dialog.component';
import { DecklistDialogComponent } from './dialogs/decklist-dialog.component';
import { LogDialogComponent } from './dialogs/log-dialog.component';
import { ZoneDialogComponent, ZoneDialogData } from './dialogs/zone-dialog.component';

/** Opens the board's dialogs (one instance per board page). */
@Injectable()
export class BoardDialogs {
  private readonly modal = inject(ModalService);

  cardInfo(slot: CardSlot, zone: ZoneName, opponent: boolean): void {
    const data: CardInfoData = { instanceId: slot.instanceId, zone, opponent };
    this.modal.open(CardInfoDialogComponent, { data, width: 'min(40rem, 96vw)' });
  }

  detach(slot: CardSlot, only: AttachmentType, opponent: boolean): void {
    const data: CardInfoData = { instanceId: slot.instanceId, zone: 'field', opponent, only };
    this.modal.open(CardInfoDialogComponent, { data });
  }

  zone(zone: ZoneName, opponent: boolean): void {
    const data: ZoneDialogData = { zone, opponent };
    this.modal.open(ZoneDialogComponent, { data, width: 'min(48rem, 96vw)' });
  }

  creatureInteraction(summoned: CardSlot, summoner: CardSlot, fromZone: ZoneName): void {
    const data: CreatureInteractionData = { summoned, summoner, fromZone };
    this.modal.open(CreatureInteractionDialogComponent, { data });
  }

  deckPeek(position: 'top' | 'bottom', n: number): void {
    const data: DeckPeekData = { position, n };
    this.modal.open(DeckPeekDialogComponent, { data, width: 'min(56rem, 96vw)' });
  }

  decklist(): void {
    this.modal.open(DecklistDialogComponent, { width: 'min(40rem, 96vw)' });
  }

  log(): void {
    this.modal.open(LogDialogComponent, { width: 'min(40rem, 96vw)' });
  }
}
