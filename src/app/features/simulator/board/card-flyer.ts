import { CardSlot, GameState, ZoneName } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { CardPose, Stage, poseFrames, poseOf, stageOf } from './card-pose';
import { Seen, TableMeasure } from './card-seen';
import { LAYER, TIMING } from './timing';

/** How a card flies (all optional). */
export interface FlightOptions {
  /** It leaves face down (a card leaving the deck or the lives). */
  fromBack?: boolean;
  delay?: number;
  duration?: number;
  /** The real card waits hidden until the copy lands. */
  hide?: HTMLElement | null;
  /** It lands under a creature (a Material or a Recurso). */
  under?: boolean;
}

/** What the flyer reads from the board: the state shown now and before, and whether flights wait for what plays. */
export interface FlyerContext {
  now(): GameState | null;
  before(): GameState | null;
  /** Something started playing with this update: flights wait for it, held where they start. */
  deferring(): boolean;
}

/**
 * Copies of cards flying between places, seen by the table's camera: from one pose to the other, turning on every axis
 * at once (leaning as the table or standing up as your hand, exhausted or not, the rival's upside down) and turning
 * over when they leave or land face down. A pile they land on keeps showing its old top card until they land.
 */
export class CardFlyer {
  /**
   * Piles waiting for cards flying to them: the card now on top stays hidden (the one that was on top shown in its
   * place) until the last of them lands.
   */
  private readonly pileHolds = new Map<string, { count: number; top: HTMLElement; under: HTMLElement | null }>();

  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
    private readonly measure: TableMeasure,
    private readonly context: FlyerContext,
  ) {}

  /** A copy of the card flies from where it was (`from`'s pose) to `target` (the card there, or the pile). */
  fly(from: Seen, target: Element, faceDown: boolean, options: FlightOptions = {}): void {
    // It lands at the pose of the card there: the target itself, or the card shown on that pile (else the pile, at the
    // flying card's size)
    const toCard = target instanceof HTMLElement && target.matches('eras-game-card') ? target : target.querySelector<HTMLElement>('eras-game-card');
    // The table's camera: every flight is seen from the same eye as the table
    const stage = stageOf(this.document);
    const start = this.poseOf(from, stage);
    // An empty pile: a card as big as fits in it
    const slot = target as HTMLElement;
    const slotWidth = Math.min(slot.offsetWidth, (slot.offsetHeight * 63) / 88) || start.width;
    const end = toCard ? poseOf(toCard) : poseOf(slot, { width: slotWidth, height: (slotWidth * 88) / 63 });
    const frames = poseFrames(stage, start, end, { fromBack: !!options.fromBack, toBack: faceDown }, options.under);

    const { flight, inner } = this.copyOf(from, stage, start);
    const landed = options.hide || options.under ? null : this.holdPile(target, toCard, stage);

    const still = this.animations.still();
    const delay = still ? 0 : (options.delay ?? 0);
    const duration = still ? 1 : (options.duration ?? TIMING.flight);
    if (options.hide) options.hide.style.visibility = 'hidden';
    // Where it starts, until it goes
    inner.style.transform = String(frames[0]['transform']);
    const launch = () => {
      this.animations.hold(delay + duration);
      this.launch(inner, flight, frames, delay, duration, options.hide, landed);
    };
    if (this.context.deferring()) {
      flight.style.visibility = 'hidden';
      this.animations.whenIdle(() => {
        flight.style.visibility = '';
        launch();
      });
      return;
    }
    launch();
  }

  /** A still copy of a card where it was drawn (`seen`), until removed: a life waiting face up on its pile. */
  still(seen: Seen, faceDown = false): { element: HTMLElement; inner: HTMLElement } {
    const stage = stageOf(this.document);
    const pose = this.poseOf(seen, stage);
    const { flight, inner } = this.copyOf(seen, stage, pose);
    inner.style.transform = String(poseFrames(stage, pose, pose, { fromBack: false, toBack: faceDown })[0]['transform']);
    return { element: flight, inner };
  }

  /** The pose a card was drawn in (a flat card at its center when its pose was not measured). */
  private poseOf(from: Seen, stage: Stage): CardPose {
    return (
      from.pose ?? { x: from.x - stage.originX, y: from.y - stage.originY, z: 0, width: from.width, height: from.height, scale: 1, lean: 0, turn: from.tapped ? 90 : 0 }
    );
  }

  /**
   * A card flies to a pile (its Tributos, Descarte, or a place in its lives): the card now shown there waits hidden
   * until it lands, the one shown before in its place. Not the deck (all its cards look alike) nor a hand (its own
   * flights hide the card). The release, called as it lands; null when nothing waits.
   */
  private holdPile(target: Element, toCard: HTMLElement | null, stage: Stage): (() => void) | null {
    const pileElement = target.closest<HTMLElement>('[data-pile]');
    const key = pileElement?.dataset['pile'];
    if (!pileElement || !key || !toCard || key.endsWith(':hand') || key.endsWith(':deck')) return null;
    const [owner, zone] = key.split(':') as [string, ZoneName];
    const life = zone === 'lifeStack' ? toCard.closest<HTMLElement>('[data-life-id]')?.dataset['lifeId'] : undefined;
    // A life: only the one landing (its own place in the lives)
    if (zone === 'lifeStack' && !life) return null;
    const top = (s: GameState | null) => (s?.players?.[owner]?.[zone] as CardSlot[] | undefined)?.at(-1) ?? null;
    // A pile showing its top card: only when this update put a new one there
    if (zone !== 'lifeStack' && top(this.context.now())?.instanceId === top(this.context.before())?.instanceId) return null;
    const holdKey = life ? `${key}:${life}` : key;
    let hold = this.pileHolds.get(holdKey);
    if (!hold) {
      const was = zone === 'lifeStack' ? null : top(this.context.before());
      hold = { count: 0, top: toCard, under: was ? this.lying(toCard, was, stage) : null };
      this.pileHolds.set(holdKey, hold);
      toCard.style.visibility = 'hidden';
    }
    hold.count++;
    return () => {
      const h = this.pileHolds.get(holdKey);
      if (!h || --h.count > 0) return;
      this.pileHolds.delete(holdKey);
      h.top.style.visibility = '';
      h.under?.remove();
    };
  }

  /** A still copy of `slot` lying where `card` is (the card shown before on a pile, until the new one lands). */
  private lying(card: HTMLElement, slot: CardSlot, stage: Stage): HTMLElement {
    const seen = this.measure.seenOf(card, { imageUrl: slot.faceDown ? null : slot.imageUrl });
    const pose = seen.pose!;
    const { flight, inner } = this.copyOf(seen, stage, pose);
    inner.style.transform = String(poseFrames(stage, pose, pose, { fromBack: false, toBack: !!slot.faceDown })[0]['transform']);
    // Under the cards flying there
    flight.style.zIndex = LAYER.pileUnder;
    return flight;
  }

  /** A copy of the card (face and back) over the screen, seen by the table's camera; placed by its inner transform. */
  private copyOf(from: Seen, stage: Stage, start: CardPose): { flight: HTMLElement; inner: HTMLElement } {
    // The whole screen, seen as the table: its perspective and its eye
    const flight = this.document.createElement('div');
    Object.assign(flight.style, {
      position: 'fixed',
      inset: '0',
      perspective: `${stage.distance}px`,
      perspectiveOrigin: `${stage.originX}px ${stage.originY}px`,
      // Over the engine's dialogs (overlay layer): a card drawn by an effect flies while one is open or closing
      zIndex: LAYER.flight,
      pointerEvents: 'none',
      overflow: 'visible',
    });
    const inner = this.document.createElement('div');
    Object.assign(inner.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${start.width}px`,
      height: `${start.height}px`,
      transformStyle: 'preserve-3d',
      transformOrigin: '50% 50%',
    });
    const face = (back: boolean) => {
      const el = this.document.createElement(back || !from.imageUrl ? 'div' : 'img');
      Object.assign(el.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        borderRadius: '6px',
        objectFit: 'cover',
        backfaceVisibility: 'hidden',
      });
      if (back || !from.imageUrl) {
        el.style.background = 'var(--color-card-back)';
        if (back) el.style.transform = 'rotateY(180deg)';
      } else {
        (el as HTMLImageElement).src = from.imageUrl;
      }
      return el;
    };
    inner.append(face(false), face(true));
    flight.append(inner);
    this.document.body.append(flight);
    return { flight, inner };
  }

  private launch(inner: HTMLElement, flight: HTMLElement, frames: Keyframe[], delay: number, duration: number, hide?: HTMLElement | null, landed?: (() => void) | null): void {
    const animation = inner.animate(frames, { duration, delay, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' });
    const done = () => {
      flight.remove();
      if (hide) hide.style.visibility = '';
      landed?.();
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }
}
