import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, booleanAttribute, computed, inject, input, signal, viewChild } from '@angular/core';
import { knownToOwner, zoneTargetId } from '@data/simulator/game-rules';
import { fieldRows, legalActions, attackableCreatures } from '@data/simulator/legal-actions';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, PlayerState, ZoneName } from '@data/simulator/simulator.model';
import { ResourcePipsComponent } from '@ui/domain/game-counters/resource-pips.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { GameZoneComponent } from '@ui/domain/game-zone/game-zone.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardDialogs } from './board-dialogs';
import { BoardDrag } from './board-drag';
import { PlayerPlateComponent } from './player-plate.component';
import { SimCardComponent } from './sim-card.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChainMarksComponent, chainLinksOf } from './chain-marks.component';

/** How far from the middle (in cards) a card of the fan still shows well; the ones beyond it sink below the edge. */
const HAND_UPRIGHT_FAN = 2.9;

type Pile = 'deck' | 'tributeZone' | 'discardPile' | 'lifeStack';

/**
 * One player's side of the table. Own side: drop cards anywhere (field position, hand, piles),
 * deck and lives have their action menus. Opponent side (drawn upside down): drops become targets.
 */
@Component({
  selector: 'eras-player-half',
  imports: [SimCardComponent, GameZoneComponent, GameCardComponent, ResourcePipsComponent, CdkContextMenuTrigger, MenuComponent, MenuItemDirective, IconButtonComponent, IconComponent, PlayerPlateComponent, ChainMarksComponent],
  templateUrl: './player-half.component.html',
  styleUrl: './player-half.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.opponent]': 'opponent()', '[class.mirrored]': 'mirrored()' },
})
export class PlayerHalfComponent {
  readonly player = input.required<PlayerState>();
  readonly opponent = input(false, { transform: booleanAttribute });
  /** "Zonas espejadas": the rival's lives and gem marker swap places with their piles. */
  readonly mirrored = input(false, { transform: booleanAttribute });
  /** "Mano recta": the hand in a row instead of a fan. */
  readonly straightHand = input(false, { transform: booleanAttribute });
  /** A choice is lowered to look at the table: cards and zones can be looked at, nothing else. */
  private readonly lookOnly = inject(SheetState).lowered;

  protected readonly game = inject(GameStore);
  protected readonly drag = inject(BoardDrag);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly modal = inject(ModalService);
  private readonly fieldEl = viewChild<ElementRef<HTMLElement>>('field');

  protected readonly over = signal<string | null>(null);
  /** One of your creatures is dragged to attack: the rival's lives and hand take it as a direct attack. */
  protected readonly attackDrag = computed(() => this.opponent() && !!this.drag.dragging()?.attack);
  /** Creature the dragged card would interact with if dropped now. */
  protected readonly nearby = signal<CardSlot | null>(null);
  /** Own creature summoned from hand/piles: ask whether it was by effect (draws a card). */
  /**
   * How far the hand's fan is turned, in cards. Only a hand wider than its place turns, and only until the cards at
   * its ends are inside it (handTurnMax, measured on the page).
   */
  private readonly handTurnWanted = signal(0);
  protected readonly handTurnMax = signal(0);
  private readonly handCards = viewChild<ElementRef<HTMLElement>>('handCards');

  constructor() {
    // What sticks out on each side, in cards: past its place (plus half a card for the lean and the arrow), or the end
    // cards dropping below the edge (the fan drops fan² × 0.18rem: from about 3 cards out they sink too far)
    const measure = () => {
      const row = this.handCards()?.nativeElement;
      const place = row?.offsetParent as HTMLElement | null;
      const card = row?.firstElementChild as HTMLElement | null;
      const n = this.player().hand.length;
      if (!row || !place || !card || !n) return this.handTurnMax.set(0);
      const step = card.offsetWidth * 0.84;
      const outside = (n * step - place.clientWidth) / 2;
      const sideways = outside > 0 ? (outside + card.offsetWidth * 0.5) / step : 0;
      const sinking = this.straightHand() ? 0 : Math.max(0, (n - 1) / 2 - HAND_UPRIGHT_FAN);
      this.handTurnMax.set(Math.min((n - 1) / 2, Math.max(sideways, sinking)));
    };
    // Measured again when the hand or the straight-hand preference changes (it reads both)
    afterRenderEffect(() => measure());
    const resize = new ResizeObserver(() => measure());
    afterRenderEffect(() => {
      const row = this.handCards()?.nativeElement;
      if (row) resize.observe(row);
    });
    inject(DestroyRef).onDestroy(() => resize.disconnect());
  }
  protected readonly handTurn = computed(() => Math.max(-this.handTurnMax(), Math.min(this.handTurnMax(), this.handTurnWanted())));

  protected turnHandBy(step: number): void {
    this.handTurnWanted.set(Math.max(-this.handTurnMax(), Math.min(this.handTurnMax(), this.handTurn() + step)));
  }

  /** The wheel over the hand turns it (down or right: towards the right end). */
  protected turnHand(e: WheelEvent): void {
    if (!this.handTurnMax()) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta) return;
    e.preventDefault();
    this.turnHandBy(Math.sign(delta) * 0.5);
  }

  protected readonly targeting = computed(() => this.game.pendingTargetSource() !== null);
  /** "Información" shows while the button is held: the pointer is captured so letting go anywhere hides it. */
  protected holdInfo(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.game.showInfo.set(true);
  }

  /** How many creatures, structures and utilities a line holds (only the types it has). */
  protected typeCounts(cards: readonly CardSlot[]): { type: 'creature' | 'structure' | 'utility'; label: string; count: number }[] {
    const types = [
      { type: 'creature' as const, label: 'criaturas' },
      { type: 'structure' as const, label: 'estructuras' },
      { type: 'utility' as const, label: 'utilidades' },
    ];
    return types.map((t) => ({ ...t, count: cards.filter((c) => c.cardType === t.type && !c.faceDown).length })).filter((t) => t.count > 0);
  }

  /** A face-down card on top of a pile is shown anyway: "Mostrar cartas ocultas", or mine in the Tributos or the Descarte. */
  protected pileShown(card: CardSlot, zone: ZoneName): boolean {
    return this.game.seeAll() || knownToOwner(card, zone, this.opponent());
  }

  /** The chain links activated from each pile, shown over it (on a ring when there are several). */
  protected readonly pileLinks = computed(() => {
    const chain = this.game.state()?.chain;
    const p = this.player();
    return {
      deck: chainLinksOf(chain, p.deck),
      lifeStack: chainLinksOf(chain, p.lifeStack),
      tributeZone: chainLinksOf(chain, p.tributeZone),
      discardPile: chainLinksOf(chain, p.discardPile),
    };
  });
  protected readonly topTribute = computed(() => this.last(this.player().tributeZone));
  /** Something in my Tributos can be done now (a special summon from there, an effect): the pile glows like a card would. */
  protected readonly tributeActions = computed(() => {
    const actions = this.opponent() || this.lookOnly() ? [] : this.player().tributeZone.flatMap((c) => legalActions(this.game.rules(), c, 'tributeZone'));
    return { play: actions.includes('ritual'), activate: actions.includes('activate') };
  });
  protected readonly topDiscard = computed(() => this.last(this.player().discardPile));
  protected readonly rows = computed(() => fieldRows(this.player().field));
  /** Own side: the Línea frontal on top (towards the rival); the rival's side is mirrored. */
  protected get lines(): readonly ('front' | 'back')[] {
    return this.opponent() ? ['back', 'front'] : ['front', 'back'];
  }

  private last(list: CardSlot[]): CardSlot | null {
    return list.length ? list[list.length - 1] : null;
  }

  protected zoneId(zone: ZoneName): string {
    return zoneTargetId(zone, this.opponent());
  }

  protected isTargeted(zone: ZoneName): boolean {
    return this.game.targetedId() === this.zoneId(zone);
  }

  // ── Drag over / drop ──────────────────────────────────────────────────

  protected dragOver(event: DragEvent, zone: string): void {
    if (!this.drag.accepts(event)) return;
    event.preventDefault();
    this.over.set(zone);
    if (zone === 'field') {
      // The creature under the pointer, to interact with it (summon on top, attach)
      const dragging = this.drag.dragging();
      const id = (event.target as HTMLElement | null)?.closest('[data-instance-id]')?.getAttribute('data-instance-id');
      const under = this.player().field.find((s) => s.instanceId === id && s.cardType === 'creature') ?? null;
      this.nearby.set(under && (this.opponent() || under.instanceId !== dragging?.instanceId) ? under : null);
    }
  }

  protected dragLeave(): void {
    this.over.set(null);
    this.nearby.set(null);
  }

  protected async drop(event: DragEvent, to: ZoneName | 'deckBottom', half?: 'top' | 'bottom'): Promise<void> {
    if (!this.drag.accepts(event) || this.lookOnly()) return;
    event.preventDefault();
    const el = this.fieldEl()?.nativeElement;
    const pos = to === 'field' && el ? this.drag.position(event, el, this.opponent()) : null;
    const nearby = this.nearby();
    this.dragLeave();
    const card = this.drag.read(event);
    if (!card) return;

    // Your creature dropped to attack: on an enemy creature it can attack, or on the rival's lives or hand (direct)
    if (card.attack && this.opponent()) {
      const attacker = this.game.myState()?.field.find((c) => c.instanceId === card.instanceId);
      if (!attacker) return;
      if (to === 'field') {
        if (nearby && attackableCreatures(attacker, [nearby]).length) this.game.attack(attacker.instanceId, nearby.instanceId);
      } else if (to === 'lifeStack' || to === 'hand') {
        this.game.attack(attacker.instanceId, null);
      }
      return;
    }

    // Outside editor mode only the rules' drops: a card of the hand onto the field (or onto a creature for its special summon)
    if (!this.game.editorMode() && (this.opponent() || card.fromZone !== 'hand' || to !== 'field')) return;

    if (this.opponent()) {
      // Dropping on the rival's side points your card at their creature or zone
      const target = to === 'field' ? nearby?.instanceId : to === 'deckBottom' ? null : this.zoneId(to);
      if (target) this.game.target(target, card.instanceId);
      return;
    }

    if (to === 'field' && pos) {
      const me = this.game.myState();
      const dragged = me?.[card.fromZone].find((c) => c.instanceId === card.instanceId);
      // A creature with a special summon dropped onto one of your creatures: done by the rules, that one is the summoner
      const ritual = dragged?.cardType === 'creature'
        && ['ritual', 'evolution', 'promotion', 'materialization'].includes(dragged.specialSummonKind?.toLowerCase() ?? '');
      if (nearby && dragged && ritual && card.fromZone === 'hand' && nearby.cardType === 'creature' && this.game.status() === 'IN_PROGRESS') {
        this.game.ritualSummon(dragged.instanceId, nearby.instanceId);
        return;
      }
      if (nearby && dragged && this.game.editorMode()) {
        this.dialogs.creatureInteraction(dragged, nearby, card.fromZone);
        return;
      }
      // A creature from the hand without an effect: normal summon by the rules (the server pays and triggers).
      // In editor mode dragging is a manual move (hand, Retaguardia and Línea frontal freely); the rules' summon is in the card's actions
      const rules = !this.game.editorMode();
      if (rules && this.game.status() === 'IN_PROGRESS' && card.fromZone === 'hand' && dragged?.cardType === 'creature') {
        this.game.normalSummon(card.instanceId, pos.x, pos.y);
        return;
      }
      // Utilities and structures from the hand are played: the server pays them and fires "En Juego"
      if (rules && this.game.status() === 'IN_PROGRESS' && card.fromZone === 'hand' && (dragged?.cardType === 'utility' || dragged?.cardType === 'structure')) {
        this.game.playCard(card.instanceId, pos.x, pos.y);
        return;
      }
      if (!this.game.editorMode()) return;
      // Manual move: the card is placed where it was dropped, nothing else (only creatures go to the Línea frontal).
      // Summons by the rules are in the card's actions.
      const front = pos.y < 50 && dragged?.cardType === 'creature';
      this.game.moveCard(card.instanceId, card.fromZone, 'field', { x: pos.x, y: front ? 25 : 75 });
      return;
    }
    if (to === 'deckBottom') {
      const ok = await this.modal.confirm({ title: 'Fondo del mazo', message: '¿Enviar esta carta al fondo del mazo?', confirmLabel: 'Enviar' });
      if (ok) this.game.moveCard(card.instanceId, card.fromZone, 'deck', { toPosition: 'bottom' });
      return;
    }
    if (to === card.fromZone && to !== 'lifeStack') return;
    this.game.moveCard(card.instanceId, card.fromZone, to, {
      toPosition: to === 'deck' ? 'top' : to === 'lifeStack' ? (half ?? 'top') : undefined,
    });
  }

  protected lifeHalf(event: DragEvent): 'top' | 'bottom' {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? 'top' : 'bottom';
  }

  /** Drags a life card out: the top or bottom one, depending on where the stack is grabbed. */
  protected lifeDragStart(event: DragEvent): void {
    const lives = this.player().lifeStack;
    if (this.opponent() || !lives.length || !this.game.editorMode()) {
      event.preventDefault();
      return;
    }
    const card = this.lifeHalf(event) === 'top' ? lives[0] : lives[lives.length - 1];
    this.drag.start(event, { instanceId: card.instanceId, fromZone: 'lifeStack' });
  }

  // ── Clicks on piles ───────────────────────────────────────────────────

  protected pileClick(zone: Pile): void {
    if (this.targeting()) {
      this.game.target(this.zoneId(zone));
      return;
    }
    // My deck has its menu (right click); the rival's is looked at only in a test room or with the hidden cards shown
    if (zone === 'deck' && (!this.opponent() || !this.game.editorMode() || (!this.game.editorRoom() && !this.game.seeAll()))) return;
    if (this.player()[zone].length) this.dialogs.zone(zone, this.opponent());
  }

  protected deckDoubleClick(): void {
    if (this.lookOnly() || !this.game.editorMode()) return;
    if (!this.opponent() && this.player().deck.length) this.game.drawCard();
  }

  // ── Deck and life actions ─────────────────────────────────────────────

  protected async confirmThen(message: string, action: () => void): Promise<void> {
    if (await this.modal.confirm({ title: 'Confirmar', message, confirmLabel: 'Aceptar' })) action();
  }

  protected viewLives(): void {
    this.game.viewLifeStack();
    this.dialogs.zone('lifeStack', false);
  }
}
