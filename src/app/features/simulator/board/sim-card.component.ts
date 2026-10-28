import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { displayStrength, isHidden } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { LegalAction, legalActions } from '@data/simulator/legal-actions';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDrag } from './board-drag';
import { BoardDialogs } from './board-dialogs';
import { BoardEffects } from './board-effects';

/**
 * A card on the board with its interactions: click shows its legal actions (or picks the target), double
 * click shows details (field) or flips it, right click opens the manual actions, own cards can be dragged.
 */
@Component({
  selector: 'eras-sim-card',
  imports: [GameCardComponent, CdkContextMenuTrigger, MenuComponent, MenuItemDirective, IconComponent],
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
      tabindex="0"
      role="button"
      [attr.aria-label]="label()"
      [cdkContextMenuTriggerFor]="menu"
      [class.selected]="selected()"
      (click)="onClick($event)"
      (dblclick)="onDoubleClick()"
      (keydown.enter)="onClick($event)"
      (dragstart)="onDragStart($event)"
      (dragend)="drag.end()"
    />

    @if (selected()) {
      <div class="actions" role="toolbar" [attr.aria-label]="'Acciones de ' + (slot().cardName ?? 'la carta')">
        @for (a of actions(); track a) {
          <button type="button" class="action" [class.attack]="a === 'attack'" [attr.aria-label]="actionLabels[a]" (click)="run(a, $event)">
            <eras-icon [name]="actionIcons[a]" />
            <span>{{ actionLabels[a] }}</span>
          </button>
        }
        @if (!hidden() || !opponent()) {
          <button type="button" class="action" aria-label="Ver" (click)="$event.stopPropagation(); game.selectedId.set(null); dialogs.cardInfo(slot(), zone(), opponent())">
            <eras-icon name="eye" />
            <span>Ver</span>
          </button>
        }
      </div>
    }

    <ng-template #menu>
      <eras-menu>
        @if (!hidden() || !opponent()) {
          <button erasMenuItem (triggered)="dialogs.cardInfo(slot(), zone(), opponent())">Ver</button>
        }
        @if (!opponent() && hasEffects()) {
          <button erasMenuItem (triggered)="dialogs.effects(slot(), zone())"><eras-icon name="sparkles" /> Efectos…</button>
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
          <button erasMenuItem class="danger" (triggered)="game.destroyCard(slot().instanceId, targetPlayer())">Destruir</button>
          @if (!opponent()) {
            <button erasMenuItem class="danger" (triggered)="game.sacrificeCard(slot().instanceId)">Sacrificar</button>
          }
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
    :host { position: relative; display: inline-block; }
    eras-game-card.selected { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: var(--radius-sm); }
    .actions {
      position: absolute;
      inset-inline: 0;
      inset-block-end: var(--space-1);
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-1);
      padding: 0 var(--space-1);
    }
    .action {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.45rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full, 999px);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      color: var(--color-text);
      font-size: 0.7rem;
      font-weight: var(--font-weight-bold);
      cursor: pointer;
    }
    .action eras-icon { inline-size: 0.9rem; block-size: 0.9rem; }
    .action:hover { border-color: var(--color-primary); }
    .action.attack { border-color: var(--color-danger); color: var(--color-danger); }
    .action:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
    eras-game-card:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimCardComponent {
  readonly slot = input.required<CardSlot>();
  readonly zone = input.required<ZoneName>();
  readonly opponent = input(false, { transform: booleanAttribute });
  readonly small = input(false, { transform: booleanAttribute });

  protected readonly game = inject(GameStore);
  protected readonly drag = inject(BoardDrag);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly modal = inject(ModalService);
  protected readonly actionLabels: Record<LegalAction, string> = { attack: 'Atacar', summon: 'Invocar', play: 'Jugar' };
  protected readonly actionIcons: Record<LegalAction, IconName> = { attack: 'sword', summon: 'plus', play: 'play' };

  protected readonly hidden = computed(() => isHidden(this.slot(), this.zone(), this.opponent()));
  private readonly effectsHelper = inject(BoardEffects);
  /** Your card has effect text (its own or inherited from its materials). */
  protected readonly hasEffects = computed(() => !this.opponent() && this.effectsHelper.effects(this.slot(), this.zone()).length > 0);
  protected readonly strength = computed(() => (this.zone() === 'field' && !this.hidden() && this.slot().cardType === 'creature' ? displayStrength(this.slot()) : null));
  protected readonly selected = computed(() => this.game.selectedId() === this.slot().instanceId);
  /** What this card can do now by the rules (the right-click menu keeps the manual actions). */
  protected readonly actions = computed<LegalAction[]>(() => (this.opponent() ? [] : legalActions(this.game.rules(), this.slot(), this.zone())));
  protected readonly targetPlayer = computed(() => (this.opponent() ? (this.game.opponentState()?.userId ?? null) : null));
  protected readonly label = computed(() => {
    const s = this.slot();
    const name = this.hidden() ? 'Carta boca abajo' : s.cardName || 'Carta';
    return `${name}${s.tapped ? ', agotada' : ''}${this.opponent() ? ', del rival' : ''}`;
  });

  protected onClick(event?: Event): void {
    event?.stopPropagation();
    if (this.game.pendingTargetSource() !== null) {
      this.game.target(this.slot().instanceId);
      return;
    }
    // A click shows the card's legal actions; a second click hides them
    this.game.selectedId.set(this.selected() ? null : this.slot().instanceId);
  }

  protected onDoubleClick(): void {
    this.game.selectedId.set(null);
    if (this.zone() === 'field') this.dialogs.cardInfo(this.slot(), this.zone(), this.opponent());
    else if (!this.opponent()) this.game.flipCard(this.slot().instanceId, this.zone());
  }

  protected async run(action: LegalAction, event: Event): Promise<void> {
    event.stopPropagation();
    this.game.selectedId.set(null);
    const s = this.slot();
    switch (action) {
      case 'attack': {
        const opponent = this.game.opponentState();
        const creatures = (opponent?.field ?? []).filter((c) => c.cardType === 'creature' && c.tapped);
        const target = await this.dialogs.attackTarget({ attacker: s, opponentName: opponent?.username ?? 'Rival', creatures });
        if (target !== undefined) this.game.attack(s.instanceId, target);
        return;
      }
      case 'summon':
        this.game.normalSummon(s.instanceId, 50, 75);
        return;
      case 'play':
        this.game.playCard(s.instanceId, 50, 75);
        return;
    }
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
}
