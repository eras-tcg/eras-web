import { BoardAnimations } from './board-animations';
import { CardFlyer } from './card-flyer';
import { CardPose, poseFrames, poseOf, stageOf } from './card-pose';
import { TableMeasure } from './card-seen';
import { LAYER, TIMING } from './timing';

/** A card the turn's draw put in the hand: its place there (hidden until it lands) and its face. */
export interface TurnDrawCard {
  element: HTMLElement;
  imageUrl: string | null;
}

/** How tall the deck stands at the middle of the screen, of the screen's height. */
const BIG_DECK = 0.6;
/** How far it leans back there, in degrees (lying down, as on a table seen from in front of it). */
const BIG_DECK_LEAN = 45;
/** How thick each card left in the deck is, of a card's height (a deck of 40 is about a sixth as thick as a card is tall). */
const CARD_THICKNESS = 0.004;

/**
 * Your draw at the start of your turn, played by you: your deck rises from its zone to the middle of the screen, big,
 * with the volume it has there, and glows until you click it; then the card drawn flies from it to your hand and the
 * deck goes back to its zone. The server has drawn already: only the drawing waits (the card stays hidden in the hand,
 * the engine's next choices wait for it as for any animation).
 */
export class TurnDraw {
  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
    private readonly measure: TableMeasure,
    private readonly flyer: CardFlyer,
  ) {}

  /** Plays it for `cards` (drawn from `deck`, the deck pile, with `left` cards in it), once what plays now has ended. */
  play(deck: HTMLElement, cards: TurnDrawCard[], left: number): void {
    cards.forEach((c) => (c.element.style.visibility = 'hidden'));
    const done = this.animations.begin();
    // After what this update started (the turn's pop-up, a card breaking…), with the table as it is then
    queueMicrotask(() => {
      done();
      this.animations.whenIdle(() => this.rise(deck, cards, left));
    });
  }

  private rise(deck: HTMLElement, cards: TurnDrawCard[], left: number): void {
    const top = deck.querySelector<HTMLElement>('eras-game-card');
    const view = this.document.defaultView;
    if (!top || !view) {
      cards.forEach((c) => (c.element.style.visibility = ''));
      return;
    }
    const done = this.animations.begin();
    const stage = stageOf(this.document);
    const from = poseOf(top);
    const scale = (view.innerHeight * BIG_DECK) / from.height;
    const middle: CardPose = {
      x: view.innerWidth / 2 - stage.originX,
      y: view.innerHeight / 2 - stage.originY,
      z: 0,
      width: from.width,
      height: from.height,
      scale,
      lean: BIG_DECK_LEAN,
      turn: 0,
    };
    // Only the pose: animating the flights' drop shadow (a filter, even 'none') flattens the deck, and its side (3D)
    // would vanish
    const frames = poseFrames(stage, from, middle, { fromBack: false, toBack: false }).map(
      (frame) => ({
        transform: frame['transform'],
        ...(frame.offset != null ? { offset: frame.offset } : {}),
      }),
    );

    // The whole screen, seen as the table (its perspective and eye), as the cards that fly
    const screen = this.document.createElement('div');
    Object.assign(screen.style, {
      position: 'fixed',
      inset: '0',
      perspective: `${stage.distance}px`,
      perspectiveOrigin: `${stage.originX}px ${stage.originY}px`,
      zIndex: LAYER.pileUnder,
      pointerEvents: 'none',
    });
    // The deck at its own size, clicked (or Enter / Space) to draw. Not a <button>: it clips what goes past its box, the
    // deck's side
    const big = this.document.createElement('div');
    big.setAttribute('role', 'button');
    big.setAttribute('aria-label', 'Robar');
    big.tabIndex = 0;
    Object.assign(big.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${from.width}px`,
      height: `${from.height}px`,
      // Its glow shows it is the one to click: no focus ring over the deck
      outline: 'none',
      transformOrigin: '50% 50%',
      transformStyle: 'preserve-3d',
      cursor: 'pointer',
      pointerEvents: 'auto',
    });
    const copy = top.cloneNode(true) as HTMLElement;
    copy.removeAttribute('hidden');
    // Its volume, a real side: the cards under the top one go down behind it (into the table), all as wide as it, as
    // many as are left (black as the back's frame, a faint line every few cards). A shadow drawn on the card's plane
    // (the pile's edge on its zone) would come towards you and widen as it goes down.
    const radius = getComputedStyle(top).borderRadius;
    Object.assign(copy.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      boxShadow: 'none',
    });
    // Its height is not grown by the pose's scale (that scale is on the card's plane): drawn at the size it will have
    const thickness = left * CARD_THICKNESS * from.height * scale;
    const side = this.document.createElement('span');
    Object.assign(side.style, {
      position: 'absolute',
      left: '0',
      right: '0',
      top: '100%',
      height: `${thickness}px`,
      transformOrigin: '50% 0',
      transform: 'rotateX(-90deg)',
      background: 'repeating-linear-gradient(to bottom, #0b0f14 0 3px, #1c2530 3px 4px)',
      borderRadius: `0 0 ${radius} ${radius}`,
      pointerEvents: 'none',
    });
    // The glow, around the whole deck: the top card and its side
    const glowStyle = {
      position: 'absolute',
      inset: '0',
      borderRadius: 'inherit',
      boxShadow: '0 0 1.1rem 0.25rem var(--color-primary), 0 0 0.35rem 0.1rem var(--color-primary)',
      opacity: '0',
      pointerEvents: 'none',
    };
    const glow = this.document.createElement('span');
    Object.assign(glow.style, glowStyle, { borderRadius: radius });
    const sideGlow = this.document.createElement('span');
    Object.assign(sideGlow.style, glowStyle);
    side.append(sideGlow);
    big.append(side, copy, glow);
    screen.append(big);
    this.document.body.append(screen);
    // The real deck stays where it is; the one rising is its copy
    top.style.visibility = 'hidden';

    const settle = {
      duration: TIMING.flight,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'forwards' as const,
    };
    big.animate(frames, settle);
    let pulses: Animation[] = [];
    const shown = setTimeout(() => {
      pulses = [glow, sideGlow].map((g) =>
        g.animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 900,
          direction: 'alternate',
          iterations: Infinity,
          easing: 'ease-in-out',
        }),
      );
      big.focus({ preventScroll: true });
    }, TIMING.flight);

    const take = () => {
      clearTimeout(shown);
      pulses.forEach((p) => p.cancel());
      big.style.pointerEvents = 'none';
      // The card leaves from the big deck's top, face down, and turns over on its way to your hand
      const seen = { ...this.measure.seenOf(copy, { imageUrl: null }), pose: middle };
      cards.forEach((c, i) =>
        this.flyer.fly({ ...seen, imageUrl: c.imageUrl }, c.element, false, {
          fromBack: true,
          delay: i * TIMING.drawStagger,
          duration: TIMING.draw,
          hide: c.element,
        }),
      );
      // Then the deck goes back to its zone
      const back = big.animate([...frames].reverse(), { ...settle, delay: TIMING.drawStagger });
      back.finished
        .catch(() => undefined)
        .then(() => {
          top.style.visibility = '';
          screen.remove();
          done();
        });
    };
    big.addEventListener('click', take, { once: true });
    big.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      big.removeEventListener('click', take);
      if (big.style.pointerEvents !== 'none') take();
    });
  }
}
