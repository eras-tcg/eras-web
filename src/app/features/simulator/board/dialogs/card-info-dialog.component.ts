import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { CardSheetComponent } from '../card-sheet.component';
import { SendDestination, destinationOf } from '../send-destinations';
import { SendToOption, chooseSendTo, destinationOptions } from './send-to-dialog.component';

export type AttachmentType = 'materials' | 'resources';

export interface CardInfoData {
  instanceId: string;
  zone: ZoneName;
  opponent: boolean;
  /** Only show this attachment group (from "Separar materiales/recursos"). */
  only?: AttachmentType;
  /** Only to look at it (a choice is lowered): no actions. */
  readonly?: boolean;
}

const ATTACH_LABELS: Record<AttachmentType, string> = { materials: 'Materiales', resources: 'Recursos' };

/** A card on the board in detail (CardSheet) plus its attachments (materials/resources) and what can be done with them. */
@Component({
  selector: 'eras-card-info-dialog',
  imports: [IconComponent, ModalComponent, CardSheetComponent, GameCardComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent],
  templateUrl: './card-info-dialog.component.html',
  styleUrl: './card-info-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardInfoDialogComponent {
  protected readonly data = inject<CardInfoData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly modal = inject(ModalService);
  protected readonly labels = ATTACH_LABELS;

  /** Live slot: the dialog follows the card through every broadcast. */
  protected readonly slot = computed<CardSlot | null>(() => {
    const player = this.data.opponent ? this.game.opponentState() : this.game.myState();
    return player?.[this.data.zone].find((c) => c.instanceId === this.data.instanceId) ?? null;
  });
  // Moving attachments by hand is only for "Separar materiales/recursos" (editor mode)
  protected readonly groups = computed<AttachmentType[]>(() => (this.slot() && this.data.zone === 'field' && this.data.only ? [this.data.only] : []));
  protected readonly targetPlayer = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));

  /** "Enviar a…" for a Material or Recurso: the board's destinations, then what else can be done with it here. */
  protected async sendAttachment(parent: CardSlot, a: CardSlot, type: AttachmentType, i: number): Promise<void> {
    const card: SendToOption[] = [
      { id: 'swap', label: 'Intercambiar con la principal' },
      { id: 'reclassify', label: 'Pasar a ' + (type === 'materials' ? 'recursos' : 'materiales') },
    ];
    if (i > 0) card.push({ id: 'up', label: 'Subir' });
    if (i < parent[type].length - 1) card.push({ id: 'down', label: 'Bajar' });
    const id = await chooseSendTo(this.modal, {
      title: 'Enviar a…',
      subtitle: a.faceDown ? 'Carta oculta' : (a.cardName ?? undefined),
      groups: [
        { label: 'Zona', options: destinationOptions(null) },
        { label: ATTACH_LABELS[type], options: card },
      ],
    });
    if (!id) return;
    const to = destinationOf(id);
    if (to) this.moveOut(a, type, to);
    else if (id === 'swap') this.game.swapWithMain(a.instanceId, type, parent.instanceId, this.targetPlayer());
    else if (id === 'reclassify') this.game.reclassifyAttachment(a.instanceId, type, parent.instanceId, this.targetPlayer());
    else if (id === 'up') this.reorder(parent, type, i, -1);
    else if (id === 'down') this.reorder(parent, type, i, 1);
  }

  protected moveOut(a: CardSlot, type: AttachmentType, to: SendDestination): void {
    const parent = this.slot();
    if (!parent) return;
    this.game.moveFromAttachment({
      instanceId: a.instanceId,
      attachmentOf: parent.instanceId,
      attachmentType: type,
      toZone: to.zone,
      faceDown: to.faceDown,
      position: to.position ?? 'bottom',
      targetPlayerId: this.targetPlayer(),
    });
  }

  protected reorder(parent: CardSlot, type: AttachmentType, index: number, step: -1 | 1): void {
    const ids = parent[type].map((c) => c.instanceId);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    this.game.reorderAttachment(parent.instanceId, type, ids, this.targetPlayer());
  }
}
