import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, effect, inject, input, signal } from '@angular/core';
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
import { SheetState } from '@ui/surfaces/sheet/sheet-state';

/**
 * A card on the board with its interactions: click shows its legal actions (or picks the target), double
 * click shows details (field) or flips it, right click opens the manual actions, own cards can be dragged.
 */
@Component({
  selector: 'eras-sim-card',
  imports: [GameCardComponent, CdkContextMenuTrigger, CdkConnectedOverlay, CdkOverlayOrigin, MenuComponent, MenuItemDirective, IconComponent],
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
      [attr.draggable]="opponent() || lookOnly() ? null : 'true'"
      tabindex="0"
      role="button"
      [attr.aria-label]="label()"
      [cdkContextMenuTriggerFor]="menu"
      [cdkContextMenuDisabled]="lookOnly()"
      [class.selected]="selected()"
      [class.can-play]="canPlay()"
      [class.can-activate]="canActivate()"
      [class.prompt-chosen]="game.promptChosen().has(slot().instanceId)"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (click)="onClick($event)"
      (dblclick)="onDoubleClick()"
      (keydown.enter)="onClick($event)"
      (dragstart)="onDragStart($event)"
      (dragend)="drag.end()"
    />

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="selected()"
      [cdkConnectedOverlayPositions]="toolbarPositions"
      [cdkConnectedOverlayPush]="true"
      cdkConnectedOverlayPanelClass="eras-card-actions-panel"
    >
      <div class="actions" role="toolbar" [attr.aria-label]="'Acciones de ' + (slot().cardName ?? 'la carta')">
        @if (effectsOpen()) {
          @for (e of myEffects(); track e.scriptId) {
            <button type="button" class="action effect" [attr.title]="e.text" [attr.aria-label]="'Activar ' + e.label + ': ' + e.text" (click)="activate(e.scriptId, $event)">
              <eras-icon name="sparkles" />
              <span>{{ e.label }}</span>
            </button>
          }
        } @else {
          @for (a of actions(); track a) {
            <button type="button" class="action" [class.attack]="a === 'attack'" [class.play]="a === 'summon' || a === 'ritual' || a === 'play'" [class.activate]="a === 'activate'" [attr.aria-label]="actionLabels[a]" (click)="run(a, $event)">
              <eras-icon [name]="actionIcons[a]" />
              <span>{{ actionLabels[a] }}</span>
            </button>
          }
        }
        @if (!hidden() || !opponent()) {
          <button type="button" class="action" aria-label="Ver" (click)="$event.stopPropagation(); game.selectedId.set(null); dialogs.cardInfo(slot(), zone(), opponent())">
            <eras-icon name="eye" />
            <span>Ver</span>
          </button>
        }
      </div>
    </ng-template>

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
    :host(.tapped-field) {
      /* An exhausted card is turned sideways: it takes the card's height in width, so it does not overlap its neighbors */
      display: inline-flex;
      justify-content: center;
      inline-size: calc(var(--game-card-width, 4.5rem) * 88 / 63);
    }
    eras-game-card.prompt-chosen {
      outline: 3px solid #22c55e;
      outline-offset: 3px;
      box-shadow: 0 0 18px 6px rgb(34 197 94 / 75%);
      animation: chosen-pulse 0.9s ease-in-out infinite alternate;
    }
    @keyframes chosen-pulse { to { box-shadow: 0 0 6px 2px rgb(34 197 94 / 45%); } }
    eras-game-card.can-play { box-shadow: 0 0 0 2px #3b82f6, 0 0 14px 3px rgb(59 130 246 / 70%); }
    eras-game-card.can-activate { box-shadow: 0 0 0 2px #f5b301, 0 0 14px 3px rgb(245 179 1 / 70%); }
    eras-game-card.can-play.can-activate {
      box-shadow: 0 0 0 2px #f5b301, 0 0 0 4px #3b82f6, 0 0 16px 4px rgb(245 179 1 / 60%);
    }
    .actions {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-lg, var(--shadow-md));
    }
    .action {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full, 999px);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      color: var(--color-text);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      white-space: nowrap;
      cursor: pointer;
    }
    .action eras-icon { inline-size: 1.1rem; block-size: 1.1rem; }
    .action.play { border-color: #3b82f6; }
    .action.effect, .action.activate { border-color: #f5b301; }
    .action:hover { border-color: var(--color-primary); }
    .action.attack { border-color: var(--color-danger); color: var(--color-danger); }
    .action.effect { border-color: var(--color-primary); }
    .action:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
    eras-game-card:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tapped-field]': "slot().tapped && zone() === 'field'" },
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
  protected readonly actionLabels: Record<LegalAction, string> = {
    attack: 'Atacar',
    summon: 'Invocar',
    ritual: 'Ritual',
    play: 'Jugar',
    activate: 'Activar efecto',
  };
  protected readonly actionIcons: Record<LegalAction, IconName> = { attack: 'sword', summon: 'plus', ritual: 'layers', play: 'play', activate: 'sparkles' };
  /** Slow effects of this card that can be activated now. */
  protected readonly myEffects = computed(() => this.game.rules().activatable.filter((e) => e.instanceId === this.slot().instanceId));
  /** Can be played, summoned or summoned by Ritual now: blue glow. */
  protected readonly canPlay = computed(() => this.actions().some((a) => a === 'summon' || a === 'ritual' || a === 'play'));
  /** Has an effect to activate now: gold glow. */
  protected readonly canActivate = computed(() => this.actions().includes('activate'));
  /** The toolbar opens above the card, or below when there is no room. */
  protected readonly toolbarPositions: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
  /** The card has several effects to activate: the toolbar lists them. */
  protected readonly effectsOpen = signal(false);

  protected readonly hidden = computed(() => isHidden(this.slot(), this.zone(), this.opponent()));
  private readonly effectsHelper = inject(BoardEffects);
  /** Your card has effect text (its own or inherited from its materials). */
  protected readonly hasEffects = computed(() => !this.opponent() && this.effectsHelper.effects(this.slot(), this.zone()).length > 0);
  protected readonly strength = computed(() => (this.zone() === 'field' && !this.hidden() && this.slot().cardType === 'creature' ? displayStrength(this.slot()) : null));
  protected readonly selected = computed(() => this.game.selectedId() === this.slot().instanceId);
  /** What this card can do now by the rules (the right-click menu keeps the manual actions). */
  /** A choice is lowered to look at the table: the card can be looked at, nothing else. */
  protected readonly lookOnly = inject(SheetState).lowered;
  protected readonly actions = computed<LegalAction[]>(() =>
    this.opponent() || this.lookOnly() ? [] : legalActions(this.game.rules(), this.slot(), this.zone()),
  );
  protected readonly targetPlayer = computed(() => (this.opponent() ? (this.game.opponentState()?.userId ?? null) : null));
  protected readonly label = computed(() => {
    const s = this.slot();
    const name = this.hidden() ? 'Carta boca abajo' : s.cardName || 'Carta';
    return `${name}${s.tapped ? ', agotada' : ''}${this.opponent() ? ', del rival' : ''}`;
  });

  constructor() {
    effect(() => {
      if (!this.selected()) this.effectsOpen.set(false);
    });
  }

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
      case 'ritual':
        // The server asks for the creatures that meet the Requerimiento
        this.game.ritualSummon(s.instanceId);
        return;
      case 'activate': {
        const effects = this.myEffects();
        if (effects.length === 1) {
          this.game.activateEffect(s.instanceId, effects[0].scriptId);
        } else {
          this.game.selectedId.set(s.instanceId);
          this.effectsOpen.set(true);
        }
        return;
      }
    }
  }

  protected activate(scriptId: string, event: Event): void {
    event.stopPropagation();
    this.game.selectedId.set(null);
    this.game.activateEffect(this.slot().instanceId, scriptId);
  }

  protected onDragStart(event: DragEvent): void {
    if (this.opponent() || this.lookOnly()) {
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
