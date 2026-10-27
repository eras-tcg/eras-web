import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, OnDestroy, booleanAttribute, computed, inject, input } from '@angular/core';
import { displayStrength, isHidden } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDrag } from './board-drag';
import { BoardDialogs } from './board-dialogs';

/**
 * A card on the board with its interactions: click taps (field) or picks the target, double click
 * shows details (field) or flips it, right click opens actions, own cards can be dragged.
 */
@Component({
  selector: 'eras-sim-card',
  imports: [GameCardComponent, CdkContextMenuTrigger, MenuComponent, MenuItemDirective],
  template: `
    <eras-game-card
      [imageUrl]="slot().imageUrl"
      [hidden]="hidden()"
      [tapped]="slot().tapped"
      [strength]="strength()"
      [modifier]="slot().strengthModifier || 0"
      [materialsCount]="zone() === 'field' ? slot().materials.length : 0"
      [resourcesCount]="zone() === 'field' ? slot().resources.length : 0"
      [targeted]="game.targetedId() === slot().instanceId"
      [source]="game.targetingSourceId() === slot().instanceId || game.pendingTargetSource() === slot().instanceId"
      [selectable]="game.pendingTargetSource() !== null"
      [small]="small()"
      [attr.draggable]="opponent() ? null : 'true'"
      [attr.title]="hidden() ? null : slot().cardName"
      tabindex="0"
      role="button"
      [attr.aria-label]="label()"
      [cdkContextMenuTriggerFor]="menu"
      (click)="onClick()"
      (dblclick)="onDoubleClick()"
      (keydown.enter)="onClick()"
      (dragstart)="onDragStart($event)"
      (dragend)="drag.end()"
    />

    <ng-template #menu>
      <eras-menu>
        @if (!hidden() || !opponent()) {
          <button erasMenuItem (triggered)="dialogs.cardInfo(slot(), zone(), opponent())">Ver</button>
        }
        @if (zone() === 'field') {
          <button erasMenuItem (triggered)="game.tapCard(slot().instanceId, zone(), targetPlayer())">{{ slot().tapped ? 'Enderezar' : 'Agotar' }}</button>
          @if (slot().strength !== null) {
            <button erasMenuItem (triggered)="game.modifyStrength(slot().instanceId, -1, targetPlayer())">Reducir fuerza</button>
            <button erasMenuItem (triggered)="game.modifyStrength(slot().instanceId, 1, targetPlayer())">Incrementar fuerza</button>
            @if (slot().strengthModifier) {
              <button erasMenuItem (triggered)="game.modifyStrength(slot().instanceId, -slot().strengthModifier, targetPlayer())">Restaurar fuerza</button>
            }
          }
          <button erasMenuItem (triggered)="game.pendingTargetSource.set(slot().instanceId)">Hacer objetivo</button>
          @if (slot().materials.length) {
            <button erasMenuItem (triggered)="dialogs.detach(slot(), 'materials', opponent())">Separar materiales</button>
          }
          @if (slot().resources.length) {
            <button erasMenuItem (triggered)="dialogs.detach(slot(), 'resources', opponent())">Separar recursos</button>
          }
        }
        @if (!opponent() && zone() !== 'field') {
          <button erasMenuItem (triggered)="game.flipCard(slot().instanceId, zone())">{{ slot().faceDown ? 'Poner boca arriba' : 'Poner boca abajo' }}</button>
        }
        <hr />
        <button erasMenuItem class="danger" (triggered)="remove()">Eliminar del juego</button>
      </eras-menu>
    </ng-template>
  `,
  styles: `
    :host { display: inline-block; }
    eras-game-card:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimCardComponent implements OnDestroy {
  readonly slot = input.required<CardSlot>();
  readonly zone = input.required<ZoneName>();
  readonly opponent = input(false, { transform: booleanAttribute });
  readonly small = input(false, { transform: booleanAttribute });

  protected readonly game = inject(GameStore);
  protected readonly drag = inject(BoardDrag);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly modal = inject(ModalService);
  private tapTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly hidden = computed(() => isHidden(this.slot(), this.zone(), this.opponent()));
  protected readonly strength = computed(() => (this.zone() === 'field' && !this.hidden() && this.slot().cardType === 'creature' ? displayStrength(this.slot()) : null));
  protected readonly targetPlayer = computed(() => (this.opponent() ? (this.game.opponentState()?.userId ?? null) : null));
  protected readonly label = computed(() => {
    const s = this.slot();
    const name = this.hidden() ? 'Carta boca abajo' : s.cardName || 'Carta';
    return `${name}${s.tapped ? ', agotada' : ''}${this.opponent() ? ', del rival' : ''}`;
  });

  protected onClick(): void {
    if (this.game.pendingTargetSource() !== null) {
      this.game.target(this.slot().instanceId);
      return;
    }
    if (this.zone() !== 'field') return;
    // Single click taps; a second click within 250 ms is a double click instead
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
      return;
    }
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null;
      this.game.tapCard(this.slot().instanceId, this.zone(), this.targetPlayer());
    }, 250);
  }

  protected onDoubleClick(): void {
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
    if (this.zone() === 'field') this.dialogs.cardInfo(this.slot(), this.zone(), this.opponent());
    else if (!this.opponent()) this.game.flipCard(this.slot().instanceId, this.zone());
  }

  protected onDragStart(event: DragEvent): void {
    if (this.opponent()) {
      event.preventDefault();
      return;
    }
    this.drag.start(event, { instanceId: this.slot().instanceId, fromZone: this.zone() });
  }

  protected async remove(): Promise<void> {
    const ok = await this.modal.confirm({
      title: 'Eliminar carta',
      message: '¿Eliminar esta carta del juego por completo? No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) this.game.removeCard(this.slot().instanceId, this.zone(), this.targetPlayer());
  }

  ngOnDestroy(): void {
    if (this.tapTimer) clearTimeout(this.tapTimer);
  }
}
