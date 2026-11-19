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
const BIG_DECK = 0.5;

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

  /** Plays it for `cards` (drawn from `deck`, the deck pile), once what plays now has ended. */
  play(deck: HTMLElement, cards: TurnDrawCard[]): void {
    cards.forEach((c) => (c.element.style.visibility = 'hidden'));
    const done = this.animations.begin();
    // After what this update started (the turn's pop-up, a card breaking…), with the table as it is then
    queueMicrotask(() => {
      done();
      this.animations.whenIdle(() => this.rise(deck, cards));
    });
  }

  private rise(deck: HTMLElement, cards: TurnDrawCard[]): void {
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
      lean: 0,
      turn: 0,
    };
    const frames = poseFrames(stage, from, middle, { fromBack: false, toBack: false });

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
    // The deck as drawn on its zone (its volume is the card's shadow), at its own size
    const big = this.document.createElement('button');
    big.type = 'button';
    big.setAttribute('aria-label', 'Robar');
    Object.assign(big.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${from.width}px`,
      height: `${from.height}px`,
      padding: '0',
      border: '0',
      background: 'none',
      // Its glow shows it is the one to click: no focus ring over the deck
      outline: 'none',
      transformOrigin: '50% 50%',
      transformStyle: 'preserve-3d',
      cursor: 'pointer',
      pointerEvents: 'auto',
    });
    const copy = top.cloneNode(true) as HTMLElement;
    copy.removeAttribute('hidden');
    Object.assign(copy.style, { display: 'block', width: '100%', height: '100%' });
    // The glow, around the deck and its volume
    const glow = this.document.createElement('span');
    Object.assign(glow.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: getComputedStyle(top).borderRadius,
      boxShadow: '0 0 1.1rem 0.25rem var(--color-primary), 0 0 0.35rem 0.1rem var(--color-primary)',
      opacity: '0',
      pointerEvents: 'none',
    });
    big.append(copy, glow);
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
    let pulse: Animation | null = null;
    const shown = setTimeout(() => {
      pulse = glow.animate([{ opacity: 0.35 }, { opacity: 1 }], {
        duration: 900,
        direction: 'alternate',
        iterations: Infinity,
        easing: 'ease-in-out',
      });
      big.focus({ preventScroll: true });
    }, TIMING.flight);

    big.addEventListener(
      'click',
      () => {
        clearTimeout(shown);
        pulse?.cancel();
        glow.style.opacity = '0';
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
      },
      { once: true },
    );
  }
}
