import { Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { AttackTargetData, AttackTargetDialogComponent } from './dialogs/attack-target-dialog.component';
import { AttachmentType, CardInfoData, CardInfoDialogComponent } from './dialogs/card-info-dialog.component';
import { CreatureInteractionData, CreatureInteractionDialogComponent } from './dialogs/creature-interaction-dialog.component';
import { DeckPeekData, DeckPeekDialogComponent } from './dialogs/deck-peek-dialog.component';
import { DecklistDialogComponent } from './dialogs/decklist-dialog.component';
import { EffectPromptData, EffectPromptDialogComponent } from './dialogs/effect-prompt-dialog.component';
import { EffectsDialogComponent, EffectsDialogData } from './dialogs/effects-dialog.component';
import { LogDialogComponent } from './dialogs/log-dialog.component';
import { ZoneDialogComponent, ZoneDialogData } from './dialogs/zone-dialog.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { GameStore } from '@data/simulator/game.store';

/** Opens the board's dialogs (one instance per board page). */
@Injectable()
export class BoardDialogs {
  private readonly modal = inject(ModalService);
  private readonly sheet = inject(SheetState);
  private readonly game = inject(GameStore);
  /** The board's injector: dialogs that use board services (BoardEffects) are created under it. */
  private readonly injector = inject(Injector);

  cardInfo(slot: CardSlot, zone: ZoneName, opponent: boolean): void {
    const data: CardInfoData = { instanceId: slot.instanceId, zone, opponent, readonly: this.sheet.lowered() || !this.game.editorMode() };
    this.modal.open(CardInfoDialogComponent, { data, width: 'min(64rem, 96vw)' });
  }

  detach(slot: CardSlot, only: AttachmentType, opponent: boolean): void {
    const data: CardInfoData = { instanceId: slot.instanceId, zone: 'field', opponent, only };
    this.modal.open(CardInfoDialogComponent, { data });
  }

  zone(zone: ZoneName, opponent: boolean): void {
    const data: ZoneDialogData = { zone, opponent, readonly: this.sheet.lowered() || !this.game.editorMode() };
    this.modal.open(ZoneDialogComponent, { data, width: 'min(48rem, 96vw)' });
  }

  creatureInteraction(summoned: CardSlot, summoner: CardSlot, fromZone: ZoneName): void {
    const data: CreatureInteractionData = { summoned, summoner, fromZone };
    this.modal.sheet(CreatureInteractionDialogComponent, { data });
  }

  /** Target of an attack: an exhausted enemy creature id, null for the rival, undefined when cancelled. */
  attackTarget(data: AttackTargetData): Promise<string | null | undefined> {
    const ref = this.modal.sheet<string | null, AttackTargetData>(AttackTargetDialogComponent, { data });
    return firstValueFrom(ref.closed);
  }

  /** Rules-engine choice; it cannot be dismissed (the board closes it when the engine moves on). */
  effectPrompt(data: EffectPromptData) {
    return this.modal.sheet(EffectPromptDialogComponent, { data, disableClose: true, injector: this.injector });
  }

  /** Assisted effects of one of your cards. */
  effects(slot: CardSlot, zone: ZoneName): void {
    const data: EffectsDialogData = { instanceId: slot.instanceId, zone };
    this.modal.open(EffectsDialogComponent, { data, injector: this.injector });
  }

  deckPeek(position: 'top' | 'bottom', n: number): void {
    const data: DeckPeekData = { position, n };
    this.modal.sheet(DeckPeekDialogComponent, { data });
  }

  decklist(): void {
    this.modal.open(DecklistDialogComponent, { width: 'min(40rem, 96vw)' });
  }

  log(): void {
    this.modal.open(LogDialogComponent, { width: 'min(40rem, 96vw)' });
  }
}
