import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, effect, inject, input, signal } from '@angular/core';
import { displayStrength, isHidden, strengthChange } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, ZoneName } from '@data/simulator/simulator.model';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { IconComponent, IconName } from '@ui/primitives/icon/icon.component';
import { LegalAction, challenges, inFrontLine, legalActions, specialKindLabel } from '@data/simulator/legal-actions';
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
  templateUrl: './sim-card.component.html',
  styleUrl: './sim-card.component.scss',
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
  /** The card's special summon: Ritual, Evolución, Ascenso or Materialización. */
  protected readonly specialLabel = computed(() => specialKindLabel(this.slot().specialSummonKind));
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

  /** Hidden from me (in a test room everything can be shown). */
  protected readonly hidden = computed(() => !this.game.seeAll() && isHidden(this.slot(), this.zone(), this.opponent()));
  private readonly effectsHelper = inject(BoardEffects);
  /** Your card has effect text (its own or inherited from its materials). */
  protected readonly hasEffects = computed(() => !this.opponent() && this.effectsHelper.effects(this.slot(), this.zone()).length > 0);
  protected readonly change = computed(() => strengthChange(this.slot()));
  protected readonly strength = computed(() => (this.zone() === 'field' && !this.hidden() && this.slot().cardType === 'creature' ? displayStrength(this.slot()) : null));
  protected readonly selected = computed(() => this.game.selectedId() === this.slot().instanceId);
  /** What this card can do now by the rules (the right-click menu keeps the manual actions). */
  /** Cards of the hand can be dropped to play them by the rules; anything else is moved only in editor mode. */
  protected readonly canDrag = computed(() => !this.opponent() && !this.lookOnly() && (this.zone() === 'hand' || this.game.editorMode()));
  /** Its role in the combat in progress, if any. */
  protected readonly combatRole = computed<'attacker' | 'blocker' | 'target' | null>(() => {
    const c = this.game.state()?.combat;
    const id = this.slot().instanceId;
    if (!c || this.zone() !== 'field') return null;
    if (c.attackerId === id) return 'attacker';
    if (c.blockerId === id) return 'blocker';
    if (c.targetId === id) return 'target';
    return null;
  });
  /** A choice is lowered to look at the table: the card can be looked at, nothing else. */
  protected readonly lookOnly = inject(SheetState).lowered;
  protected readonly actions = computed<LegalAction[]>(() =>
    this.opponent() || this.lookOnly() ? [] : legalActions(this.game.rules(), this.slot(), this.zone()),
  );
  protected readonly targetPlayer = computed(() => (this.opponent() ? (this.game.opponentState()?.userId ?? null) : null));
  protected readonly isFront = computed(() => inFrontLine(this.slot()));

  /** Editor mode: the creature goes to the other line of the field (same place across it). */
  protected toLine(): void {
    const s = this.slot();
    this.game.moveCard(s.instanceId, 'field', 'field', { x: s.x ?? 50, y: this.isFront() ? 75 : 25, targetPlayerId: this.targetPlayer() });
  }
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
        // Enemies of the Línea frontal: exhausted ones, or active ones it can face (Enfrentar)
        const creatures = (opponent?.field ?? []).filter((c) => c.cardType === 'creature' && inFrontLine(c) && (c.tapped || challenges(s, c)));
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
    if (!this.canDrag()) {
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
