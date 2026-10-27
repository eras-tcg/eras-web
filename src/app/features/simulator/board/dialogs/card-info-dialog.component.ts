import { CdkMenuTrigger } from '@angular/cdk/menu';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardsStore } from '@data/cards/cards.store';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { CardDetailComponent } from '@ui/domain/card-detail/card-detail.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { EmptyStateComponent } from '@ui/feedback/empty-state/empty-state.component';
import { SectionHeaderComponent } from '@ui/layout/section-header/section-header.component';
import { StackComponent } from '@ui/layout/stack/stack.component';
import { ButtonComponent } from '@ui/primitives/button/button.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalComponent } from '@ui/surfaces/modal/modal.component';
import { cardDetailView } from '../../../cards/card-detail-view';

export type AttachmentType = 'materials' | 'resources';

export interface CardInfoData {
  instanceId: string;
  zone: ZoneName;
  opponent: boolean;
  /** Only show this attachment group (from "Separar materiales/recursos"). */
  only?: AttachmentType;
}

const ATTACH_LABELS: Record<AttachmentType, string> = { materials: 'Materiales', resources: 'Recursos' };

/** Card details on the board plus its attachments (materials/resources) and what can be done with them. */
@Component({
  selector: 'eras-card-info-dialog',
  imports: [ModalComponent, CardDetailComponent, GameCardComponent, StackComponent, SectionHeaderComponent, EmptyStateComponent, ButtonComponent, CdkMenuTrigger, MenuComponent, MenuItemDirective],
  template: `
    <eras-modal [title]="data.only ? 'Separar ' + labels[data.only].toLowerCase() : (slot()?.cardName ?? 'Carta')" (closed)="ref.close()">
      @if (slot(); as s) {
        <eras-stack [gap]="4">
          @if (!data.only) {
            @if (view(); as v) {
              <eras-card-detail
                stacked
                [name]="v.name"
                [edition]="v.edition"
                [number]="v.number"
                [color]="v.color"
                [colorLabel]="v.colorLabel"
                [imageUrl]="s.imageUrl ?? v.imageUrl"
                [facts]="v.facts"
                [textGroups]="v.groups"
              />
            } @else {
              <eras-game-card [imageUrl]="s.imageUrl" />
            }
          }
          @for (type of groups(); track type) {
            <eras-section-header [title]="labels[type] + ' (' + s[type].length + ')'" />
            <eras-stack direction="row" [gap]="3" wrap>
              @for (a of s[type]; track a.instanceId; let i = $index) {
                <eras-stack [gap]="1" align="center">
                  <eras-game-card small [imageUrl]="a.imageUrl" [hidden]="a.faceDown" [attr.title]="a.cardName" />
                  <button erasButton variant="secondary" size="sm" type="button" [cdkMenuTriggerFor]="actions" [attr.aria-label]="'Acciones de ' + (a.cardName ?? 'anexo')">Mover…</button>
                  <ng-template #actions>
                    <eras-menu>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'hand')">A la mano</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'discardPile')">Al descarte</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'tributeZone')">A tributos</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'deck', 'bottom')">Al fondo del mazo</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'lifeStack', 'top', true)">A las vidas (boca abajo)</button>
                      <button erasMenuItem (triggered)="moveOut(a, type, 'field')">Al campo</button>
                      <hr />
                      <button erasMenuItem (triggered)="game.swapWithMain(a.instanceId, type, s.instanceId, targetPlayer())">Intercambiar con la principal</button>
                      <button erasMenuItem (triggered)="game.reclassifyAttachment(a.instanceId, type, s.instanceId, targetPlayer())">
                        Pasar a {{ type === 'materials' ? 'recursos' : 'materiales' }}
                      </button>
                      @if (i > 0) {
                        <button erasMenuItem (triggered)="reorder(s, type, i, -1)">Subir</button>
                      }
                      @if (i < s[type].length - 1) {
                        <button erasMenuItem (triggered)="reorder(s, type, i, 1)">Bajar</button>
                      }
                    </eras-menu>
                  </ng-template>
                </eras-stack>
              }
            </eras-stack>
          }
        </eras-stack>
      } @else {
        <eras-empty-state title="La carta ya no está en esa zona" />
      }
    </eras-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardInfoDialogComponent {
  protected readonly data = inject<CardInfoData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly game = inject(GameStore);
  private readonly cards = inject(CardsStore);
  protected readonly labels = ATTACH_LABELS;

  /** Live slot: the dialog follows the card through every broadcast. */
  protected readonly slot = computed<CardSlot | null>(() => {
    const player = this.data.opponent ? this.game.opponentState() : this.game.myState();
    return player?.[this.data.zone].find((c) => c.instanceId === this.data.instanceId) ?? null;
  });
  protected readonly view = computed(() => {
    const s = this.slot();
    const card = s && this.cards.cards().find((c) => c.id === s.cardId);
    return card ? cardDetailView(card, this.cards.ref()) : null;
  });
  protected readonly groups = computed<AttachmentType[]>(() => {
    const s = this.slot();
    if (!s || this.data.zone !== 'field') return [];
    if (this.data.only) return [this.data.only];
    return (['materials', 'resources'] as const).filter((t) => s[t].length > 0);
  });
  protected readonly targetPlayer = computed(() => (this.data.opponent ? (this.game.opponentState()?.userId ?? null) : null));

  protected moveOut(a: CardSlot, type: AttachmentType, toZone: ZoneName, position: 'top' | 'bottom' = 'bottom', faceDown = false): void {
    const parent = this.slot();
    if (!parent) return;
    this.game.moveFromAttachment({ instanceId: a.instanceId, attachmentOf: parent.instanceId, attachmentType: type, toZone, faceDown, position, targetPlayerId: this.targetPlayer() });
  }

  protected reorder(parent: CardSlot, type: AttachmentType, index: number, step: -1 | 1): void {
    const ids = parent[type].map((c) => c.instanceId);
    [ids[index], ids[index + step]] = [ids[index + step], ids[index]];
    this.game.reorderAttachment(parent.instanceId, type, ids, this.targetPlayer());
  }
}
