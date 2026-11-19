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
/** How far it leans back there, in degrees (lying down, as on a table seen from in front of it). */
const BIG_DECK_LEAN = 62;

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
      lean: BIG_DECK_LEAN,
      turn: 0,
    };
    // Without the flights' drop shadow: a filter flattens the deck, and its side (3D) would vanish
    const frames = poseFrames(stage, from, middle, { fromBack: false, toBack: false }).map(
      (frame) => ({ ...frame, filter: 'none' }),
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
    // Its volume as on its zone (the edges of the cards under the top one, black as the back's frame with a faint line
    // between cards), stretched as much as lying back shortens it: as thick as on the zone, at its size
    const depth = parseFloat(top.style.getPropertyValue('--edge')) || 0;
    const step = 1 / Math.cos((BIG_DECK_LEAN * Math.PI) / 180);
    const edges = Array.from(
      { length: depth },
      (_, i) => `0 ${(i + 1) * step}px 0 ${i % 2 ? '#2a3441' : '#0b0f14'}`,
    );
    Object.assign(copy.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      boxShadow: [...edges, `0 ${(depth + 2) * step}px ${4 + depth / 2}px rgb(0 0 0 / 45%)`].join(
        ', ',
      ),
    });
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

    const take = () => {
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
