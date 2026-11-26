import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, booleanAttribute, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { knownToOwner, zoneTargetId } from '@data/simulator/game-rules';
import { fieldRows, legalActions, attackableCreatures } from '@data/simulator/legal-actions';
import { GameStore } from '@data/simulator/game.store';
import { CardBackService, cardBackFill, cardBackOf } from '@core/theme/card-back.service';
import { CardSlot, OptionalMode, PlayerState, ZoneName } from '@data/simulator/simulator.model';
import { drawnFrontRow, formationPlaces, formationRanks, pointsSide } from '@data/simulator/formations';
import { roman } from '@ui/domain/game-card/roman';
import { ResourcePipsComponent } from '@ui/domain/game-counters/resource-pips.component';
import { GameCardComponent } from '@ui/domain/game-card/game-card.component';
import { GameZoneComponent } from '@ui/domain/game-zone/game-zone.component';
import { MenuComponent, MenuItemDirective } from '@ui/surfaces/menu/menu.component';
import { ModalService } from '@ui/surfaces/modal/modal.service';
import { BoardAnimations } from './board-animations';
import { BoardDialogs } from './board-dialogs';
import { LineScrollDirective } from './line-scroll';
import { BoardDrag } from './board-drag';
import { BoardPreferences } from './board-preferences';
import { sortedHand } from './hand-order';
import { PlayerPlateComponent } from './player-plate.component';
import { RowSlide } from './row-slide';
import { SimCardComponent } from './sim-card.component';
import { SheetState } from '@ui/surfaces/sheet/sheet-state';
import { IconButtonComponent } from '@ui/primitives/icon-button/icon-button.component';
import { IconComponent } from '@ui/primitives/icon/icon.component';
import { ChainMarksComponent, chainLinksOf } from './chain-marks.component';
import { isTouchOnly } from './board-touch';
import { DOCUMENT } from '@angular/common';

/** How far from the middle (in cards) a card of the fan still shows well; the ones beyond it sink below the edge. */
const HAND_UPRIGHT_FAN = 3.9;
/** A sideways swipe on the hand turns it half a card every this many pixels. */
const SWIPE_STEP_PX = 28;

type Pile = 'deck' | 'tributeZone' | 'discardPile' | 'lifeStack';

/**
 * One player's side of the table. Own side: drop cards anywhere (field position, hand, piles),
 * deck and lives have their action menus. Opponent side (drawn upside down): drops become targets.
 */
/** How much narrower each edge under a pile's top card is drawn (each side, in pixels) with the table fully leaning. */
const PILE_EDGE_TAPER = 0.15;

@Component({
  selector: 'eras-player-half',
  imports: [SimCardComponent, GameZoneComponent, GameCardComponent, ResourcePipsComponent, CdkContextMenuTrigger, MenuComponent, MenuItemDirective, IconButtonComponent, IconComponent, PlayerPlateComponent, ChainMarksComponent, LineScrollDirective],
  templateUrl: './player-half.component.html',
  styleUrls: [
    './player-half.component.scss',
    './player-half.component.table.scss',
    './player-half.component.phone.scss',
    './player-half.component.arcane.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.opponent]': 'opponent()',
    '[class.mirrored]': 'mirrored()',
    '[class.tilted]': 'tilted()',
    '[class.info]': 'game.showInfo()',
    '[class.has-playmat]': '!!player().playmat',
    '[style.--playmat]': 'playmatImage()',
    '[style.--color-card-back]': 'backFill()',
    '[style.--hand-lift]': 'prefs.handLift()',
    '[class.looking]': 'looking()',
  },
})
export class PlayerHalfComponent {
  readonly player = input.required<PlayerState>();
  readonly opponent = input(false, { transform: booleanAttribute });
  protected readonly prefs = inject(BoardPreferences);
  /** "Zonas espejadas": the rival's lives and gem marker swap places with their piles. */
  protected readonly mirrored = computed(() => this.opponent() && this.prefs.mirrored());
  /** "Mano recta": the hand in a row instead of a fan. */
  protected readonly straightHand = this.prefs.straightHand;
  /** The hand as drawn: yours sorted by kind when "Ordenar la mano" is on; the rival's as it is (its kinds are hidden). */
  protected readonly hand = computed(() => {
    const hand = this.player().hand;
    return this.opponent() || !this.prefs.sortedHand() ? hand : sortedHand(hand);
  });
  /** "Mesa en perspectiva": the table leans back; your hand and both players' plates stand up from it, facing you. */
  protected readonly tilted = this.prefs.tilted;
  /** A choice is lowered to look at the table: cards and zones can be looked at, nothing else. */
  protected readonly lookOnly = inject(SheetState).lowered;
  /** Looking through the panels (left button held): your whole hand rises to be read, the card under the pointer in front. */
  protected readonly looking = inject(SheetState).seeThrough;
  /** A touch screen: no dragging, the hints speak of tapping. */
  protected readonly touchOnly = isTouchOnly(inject(DOCUMENT).defaultView);

  protected readonly game = inject(GameStore);
  /** The optional effects button: its text and what each mode does. */
  protected readonly optionalModeLabel: Record<OptionalMode, string> = { on: 'On', auto: 'Auto', off: 'Off' };
  protected readonly optionalModeTitle: Record<OptionalMode, string> = {
    on: 'Opcionales: On. Se te ofrecen todos los efectos opcionales. Clic para pasar a Auto.',
    auto:
      'Opcionales: Auto. Las cartas que reducen costes se ofrecen solo mientras el coste pueda bajar, y el En Juego de una ' +
      'estructura o utilidad se activa sin preguntar si no hay otros efectos. Clic para pasar a Off.',
    off: 'Opcionales: Off. Los efectos opcionales que se activan solos pierden su momento sin preguntarte (los En Juego sí se ofrecen). Clic para pasar a On.',
  };
  protected readonly drag = inject(BoardDrag);
  protected readonly dialogs = inject(BoardDialogs);
  private readonly modal = inject(ModalService);
  private readonly animations = inject(BoardAnimations, { optional: true });
  private readonly fieldEl = viewChild<ElementRef<HTMLElement>>('field');

  protected readonly over = signal<string | null>(null);
  /** One of your creatures is dragged to attack: the rival's lives and hand take it as a direct attack. */
  /** The player's playmat, for their half's background (none: the table's own texture shows). */
  protected readonly playmatImage = computed(() => {
    const url = this.player().playmat;
    return url ? `url("${url.replace(/"/g, '%22')}")` : null;
  });
  /**
   * The back of this player's face-down cards: the rival's as they chose it (from the server), yours as you have it
   * now (a change in the profile shows at once).
   */
  protected readonly backFill = computed(() =>
    cardBackFill(this.opponent() ? cardBackOf(this.player().cardBack) : this.cardBack.current()),
  );
  private readonly cardBack = inject(CardBackService);
  protected readonly attackDrag = computed(() => this.opponent() && !!this.drag.dragging()?.attack);
  /** A phone in landscape (read once): small piles, so a thinner edge (it must stay inside the pile's zone). */
  private readonly maxPileDepth =
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-height: 30rem)').matches ? 6 : 16;

  /**
   * A pile's thickness (deck, Tributos, Descarte): the edges of the cards under the top one, one pixel every 3 cards (at most 16, 6 on a
   * phone in landscape), black as the back's frame with a faint line between cards, with its shadow on the table. Drawn on the
   * leaning table ("Mesa en perspectiva"), an edge lower down is nearer you and would look wider: each one is a little narrower,
   * as much as the table leans, so all the cards look as wide as the top one.
   */
  protected pileEdge(cards: number): string {
    const depth = this.pileDepth(cards);
    const edges = Array.from({ length: depth }, (_, i) => {
      const narrower = (i + 1) * PILE_EDGE_TAPER * (this.prefs.tilted() ? 1 : 0);
      return `0 ${i + 1 + narrower}px 0 ${-narrower}px ${i % 2 ? '#2a3441' : '#0b0f14'}`;
    });
    return [...edges, `0 ${depth + 2}px ${4 + depth / 2}px rgb(0 0 0 / 45%)`].join(', ');
  }
  /** A pile's edge under its top card, in pixels (one every 3 cards, at most 16 — 6 on a phone in landscape). */
  protected pileDepth(cards: number): number {
    return Math.max(0, Math.min(this.maxPileDepth, Math.ceil((cards - 1) / 3)));
  }
  /** A creature attacks these lives (an attack on the player, not on a creature): marked until the combat ends. */
  protected readonly livesAttacked = computed(() => {
    const c = this.game.state()?.combat;
    if (!c || c.targetId || c.blockerId || c.step === 'END') return false;
    return c.defenderId === this.player().userId;
  });
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
    // The Línea frontal changed its order: where its cards stand is measured before it is drawn again (a component's effect runs
    // before its template), and they slide from there once drawn
    effect(() => {
      this.frontIds();
      untracked(() => this.frontSlide.measure(this.frontCards()));
    });
    afterRenderEffect(() => {
      this.frontIds();
      untracked(() => this.frontSlide.play(this.frontCards()));
    });
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
    inject(DestroyRef).onDestroy(() => {
      resize.disconnect();
      this.listenSwipeEnd(false);
    });
    // A swipe that turned the hand is not a tap: the card under the finger is not raised (captured before the card)
    afterRenderEffect(() => {
      const row = this.handCards()?.nativeElement;
      if (!row || row.dataset['swipeGuard']) return;
      row.dataset['swipeGuard'] = '1';
      row.addEventListener(
        'click',
        (e) => {
          if (!this.swiped) return;
          this.swiped = false;
          e.stopPropagation();
          e.preventDefault();
        },
        true,
      );
      // With the mouse a card of the hand is dragged to the table (upwards); dragging it sideways turns the hand
      // instead, so the card's own drag does not start (captured before the card)
      row.addEventListener(
        'dragstart',
        (e) => {
          if (this.swipeX === null) return;
          // Measured from the last pointer move (Chrome gives dragstart the press's own position)
          const dx = Math.abs(this.swipeLastX - this.swipeStartX);
          const dy = Math.abs(this.swipeLastY - this.swipeStartY);
          // Only a move already clearly sideways (a drag that starts before the mouse moved is the card's)
          if (dx < 4 || dx <= dy) return;
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );
    });
  }
  protected readonly handTurn = computed(() => Math.max(-this.handTurnMax(), Math.min(this.handTurnMax(), this.handTurnWanted())));

  /** A finger or the mouse on the hand: where it was when the hand last turned (null: no swipe under way). */
  private swipeX: number | null = null;
  private swipeY = 0;
  /** Where the swipe began (a sideways drag of a card turns the hand instead of dragging the card). */
  private swipeStartX = 0;
  private swipeStartY = 0;
  /** The pointer's latest position during the swipe. */
  private swipeLastX = 0;
  private swipeLastY = 0;
  /** The last move turned the hand (its click is swallowed). */
  private swiped = false;

  /**
   * Ends the swipe wherever the pointer is let go: outside the hand, over a sheet that opened meanwhile, or when the
   * window loses focus (the hand alone never hears that release, and the swipe went on at the next hover).
   */
  private readonly swipeRelease = (): void => {
    this.swipeEnd();
    // The click that follows a release is the swipe's, not a tap (after it, a real tap must not be swallowed)
    setTimeout(() => (this.swiped = false));
  };
  private readonly swipeHidden = (): void => {
    if (document.visibilityState === 'hidden') this.swipeRelease();
  };
  private swipeListening = false;

  private listenSwipeEnd(on: boolean): void {
    if (on === this.swipeListening) return;
    this.swipeListening = on;
    const method = on ? 'addEventListener' : 'removeEventListener';
    for (const type of ['pointerup', 'pointercancel', 'dragend']) window[method](type, this.swipeRelease, true);
    window[method]('blur', this.swipeRelease);
    document[method]('visibilitychange', this.swipeHidden);
  }

  /** A finger, a pen or the mouse's main button on the hand: a sideways swipe may turn it. */
  protected swipeStart(e: PointerEvent): void {
    if ((e.pointerType === 'mouse' && e.button !== 0) || !this.handTurnMax()) return;
    this.swipeX = this.swipeStartX = this.swipeLastX = e.clientX;
    this.swipeY = this.swipeStartY = this.swipeLastY = e.clientY;
    this.swiped = false;
    this.listenSwipeEnd(true);
  }

  /**
   * Moving sideways turns the hand half a card every 28px (right: the cards on the left come in); a mostly upward
   * move is left alone (with the mouse, that drags the card to the table).
   */
  protected swipeMove(e: PointerEvent): void {
    if (this.swipeX === null) return;
    // The mouse came back without its button pressed: that swipe ended somewhere else
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      this.swipeRelease();
      return;
    }
    this.swipeLastX = e.clientX;
    this.swipeLastY = e.clientY;
    const dx = e.clientX - this.swipeX;
    if (Math.abs(dx) < SWIPE_STEP_PX || Math.abs(dx) < Math.abs(e.clientY - this.swipeY)) return;
    const steps = Math.trunc(dx / SWIPE_STEP_PX);
    this.turnHandBy(-steps * 0.5);
    this.swipeX += steps * SWIPE_STEP_PX;
    this.swiped = true;
  }

  protected swipeEnd(): void {
    this.swipeX = null;
    this.listenSwipeEnd(false);
  }

  /** An animation is playing: the hand's arrows (and the lines' ones) keep still, so a flying card lands where aimed. */
  protected readonly animating = computed(() => !(this.animations?.idle() ?? true));

  protected turnHandBy(step: number): void {
    if (this.animating()) return;
    const turn = Math.max(-this.handTurnMax(), Math.min(this.handTurnMax(), this.handTurn() + step));
    if (turn === this.handTurn()) return;
    this.handTurnWanted.set(turn);
    // A card of this hand chosen before turning it is let go: its buttons would float where it no longer is
    const chosen = this.game.selectedId();
    if (chosen && this.player().hand.some((c) => c.instanceId === chosen)) this.game.selectedId.set(null);
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
  protected readonly topTribute = computed(() => this.shownOnTop(this.player().tributeZone));
  /** Something in my Tributos can be done now (a special summon from there, an effect): the pile glows like a card would. */
  protected readonly tributeActions = computed(() => {
    const actions = this.opponent() || this.lookOnly() ? [] : this.player().tributeZone.flatMap((c) => legalActions(this.game.rules(), c));
    return { play: actions.includes('ritual'), activate: actions.includes('activate') };
  });
  /**
   * The piles holding cards the open choice asks for ("toma 1 [retador] de tus tributos"): they glow, so the player
   * knows to open them (the cards inside glow in the pile's viewer).
   */
  protected readonly promptPiles = computed(() => {
    const valid = new Set(this.game.myPrompt()?.validIds ?? []);
    const has = (cards: readonly { instanceId: string }[]) => valid.size > 0 && cards.some((c) => valid.has(c.instanceId));
    const p = this.player();
    return { lifeStack: has(p.lifeStack), tributeZone: has(p.tributeZone), discardPile: has(p.discardPile) };
  });
  protected readonly topDiscard = computed(() => this.shownOnTop(this.player().discardPile));
  /** The lines' cards by x; in the Línea frontal a creature left between two members of a formation it is not in, drawn at its end. */
  protected readonly rows = computed(() => {
    const rows = fieldRows(this.player().field);
    return { front: drawnFrontRow(this.player(), rows.front), back: rows.back };
  });
  /** The order of the Línea frontal as drawn: when it changes, its cards slide to their new places. */
  private readonly frontIds = computed(() => this.rows().front.map((c) => c.instanceId).join('|'));
  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly frontSlide = new RowSlide(this.animations);
  private frontCards(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('.line.front .placed[data-instance-id]'));
  }
  /** Enlace: the cards of the Línea frontal in a formation, with where each run starts and ends (drawn as one group). */
  protected readonly formation = computed(() => formationPlaces(this.player(), this.rows().front));
  /** Each formation's rank (its highest level), under its middle. */
  protected readonly formationRank = computed(() => formationRanks(this.formation(), this.rows().front));
  protected readonly roman = roman;
  /**
   * Enlace: the arrows of each face-up card of the field that has them, lit when it points to the creature on that side (Línea
   * frontal, active), dim otherwise.
   */
  /**
   * Enlace: between two members of one formation side by side, one mark of who points to whom (by the left one's id): towards
   * the right one, towards the left one, or both. None where nobody points (an exhausted creature points to nothing), and none
   * between creatures of different formations or out of any.
   */
  protected readonly linkMarks = computed(() => {
    const order = this.rows().front.filter((c) => c.cardType === 'creature');
    const formations = this.player().formations ?? [];
    const sameFormation = (a: string, b: string) => formations.some((f) => f.includes(a) && f.includes(b));
    const marks = new Map<string, 'left' | 'right' | 'both'>();
    for (let i = 0; i + 1 < order.length; i++) {
      if (!sameFormation(order[i].instanceId, order[i + 1].instanceId)) continue;
      const toRight = pointsSide(order, order[i], 'right');
      const toLeft = pointsSide(order, order[i + 1], 'left');
      if (toRight || toLeft) marks.set(order[i].instanceId, toRight && toLeft ? 'both' : toRight ? 'right' : 'left');
    }
    return marks;
  });
  /** Own side: the Línea frontal on top (towards the rival); the rival's side is mirrored. */
  protected get lines(): readonly ('front' | 'back')[] {
    return this.opponent() ? ['back', 'front'] : ['front', 'back'];
  }

  /** The card a pile shows: its top one, or the one whose effect is being activated (it comes to the top meanwhile). */
  private shownOnTop(list: CardSlot[]): CardSlot | null {
    const raised = this.animations?.onTop();
    return (raised && list.find((c) => c.instanceId === raised)) || this.last(list);
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
        if (nearby && attackableCreatures(this.game.rules(), attacker, [nearby]).length) this.game.attack(attacker.instanceId, nearby.instanceId);
      } else if (to === 'lifeStack' || to === 'hand') {
        this.game.attack(attacker.instanceId, null);
      }
      return;
    }

    // Enlace, outside editor mode: a creature of my Línea frontal that can link, dropped on my field, opens the link sheet
    if (!this.game.editorMode() && !this.opponent() && to === 'field' && card.fromZone === 'field' && this.game.rules().formationJoins[card.instanceId]) {
      this.game.formationJoin(card.instanceId);
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
