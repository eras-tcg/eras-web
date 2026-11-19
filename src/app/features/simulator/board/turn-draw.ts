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
/** A card's corner radius, of its width. */
const CARD_RADIUS = 0.045;
/** How far apart the cards of its volume are drawn, in pixels (at its big size). */
const LAYER_STEP = 2;
/** The card drawn shown face up (as big as the deck's cards), standing a little above the deck's middle: of its height. */
const REVEAL_RISE = 0.08;
/** How long the card drawn takes to rise off the deck and turn over, and how long it stays shown. */
const REVEAL_MS = 650;
const REVEAL_HOLD_MS = 350;

/**
 * Your draw at the start of your turn, played by you: your deck rises from its zone to the middle of the screen, big,
 * with the volume it has there, and glows until you click it; then the card drawn rises off it and turns over, and
 * once it is shown it flies to your hand while the deck goes back to its zone. The server has drawn already: only the
 * drawing waits (the card stays hidden in the hand, the engine's next choices wait for it as for any animation).
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
    const zone = poseOf(top);
    const scale = (view.innerHeight * BIG_DECK) / zone.height;
    // Drawn at its big size (sharp), shrunk to the zone's size where it starts
    const width = zone.width * scale;
    const height = zone.height * scale;
    const from: CardPose = { ...zone, width, height, scale: zone.scale / scale };
    const middle: CardPose = {
      x: view.innerWidth / 2 - stage.originX,
      y: view.innerHeight / 2 - stage.originY,
      z: 0,
      width,
      height,
      scale: 1,
      lean: BIG_DECK_LEAN,
      turn: 0,
    };
    // Only the pose (animating a filter, even 'none', flattens the deck and its volume), and scaled in depth too: its
    // thickness shrinks and grows with it
    const frames = poseFrames(stage, from, middle, { fromBack: false, toBack: false }).map(
      (frame) => ({
        transform: String(frame['transform']).replace(/scale\(([^)]+)\)/, 'scale3d($1, $1, $1)'),
        ...(frame.offset != null ? { offset: frame.offset } : {}),
      }),
    );

    // The whole screen, seen as the table (its perspective and eye), as the cards that fly. It takes every click (one
    // anywhere draws) and keeps the board under it out of reach until the deck is back; on the board's own layers, under
    // its sidebar and game menu, which stay usable
    const screen = this.document.createElement('div');
    Object.assign(screen.style, {
      position: 'fixed',
      inset: '0',
      perspective: `${stage.distance}px`,
      perspectiveOrigin: `${stage.originX}px ${stage.originY}px`,
      zIndex: LAYER.turnDraw,
      cursor: 'pointer',
    });
    // The deck at its own size, clicked (or Enter / Space) to draw. Not a <button>: it clips what goes past its box
    const big = this.document.createElement('div');
    big.setAttribute('role', 'button');
    big.setAttribute('aria-label', 'Robar');
    big.tabIndex = 0;
    Object.assign(big.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: `${width}px`,
      height: `${height}px`,
      // Its glow shows it is the one to click: no focus ring over the deck
      outline: 'none',
      transformOrigin: '50% 50%',
      transformStyle: 'preserve-3d',
    });
    // Rounded as a card is at this size (the zone's card may be tiny, its corners at their smallest)
    const radius = `${width * CARD_RADIUS}px`;
    const copy = top.cloneNode(true) as HTMLElement;
    copy.removeAttribute('hidden');
    copy.querySelectorAll<HTMLElement>('*').forEach((e) => (e.style.borderRadius = radius));
    Object.assign(copy.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      boxShadow: 'none',
      borderRadius: radius,
    });
    // Its volume: the cards under the top one, stacked behind it (all as wide as it, with its rounded corners), as thick
    // for its size as the pile's edge on its zone (black as the back's frame, a faint line every few cards)
    const edge = parseFloat(top.style.getPropertyValue('--edge')) || 0;
    const thickness = (edge / zone.height) * height;
    const layers = Math.round(thickness / LAYER_STEP);
    const under = Array.from({ length: layers }, (_, i) => {
      const card = this.document.createElement('span');
      Object.assign(card.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: radius,
        background: i % 3 === 2 ? '#1c2530' : '#0b0f14',
        transform: `translateZ(${-(i + 1) * (thickness / layers)}px)`,
        pointerEvents: 'none',
      });
      return card;
    });
    // The glow, around the whole deck: its top card and its bottom one
    const glows = [copy, under.at(-1) ?? copy].map((card) => {
      const glow = this.document.createElement('span');
      Object.assign(glow.style, {
        position: 'absolute',
        inset: '0',
        borderRadius: radius,
        boxShadow: '0 0 3rem 0.75rem var(--color-primary), 0 0 0.9rem 0.25rem var(--color-primary)',
        opacity: '0',
        pointerEvents: 'none',
        transform: card.style.transform,
      });
      return glow;
    });
    big.append(...[...under].reverse(), copy, ...glows);
    screen.append(big);
    (deck.closest('eras-board-page') ?? this.document.body).append(screen);
    // The real deck stays where it is; the one rising is its copy
    top.style.visibility = 'hidden';

    const settle = {
      duration: TIMING.flight,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'forwards' as const,
    };
    big.animate(frames, settle);
    let pulses: Animation[] = [];
    // Clicked before the deck is up: it draws as soon as it is
    let ready = false;
    let asked = false;
    setTimeout(() => {
      ready = true;
      if (asked) {
        take();
        return;
      }
      pulses = glows.map((g) =>
        g.animate([{ opacity: 0.35 }, { opacity: 1 }], {
          duration: 900,
          direction: 'alternate',
          iterations: Infinity,
          easing: 'ease-in-out',
        }),
      );
      big.focus({ preventScroll: true });
    }, TIMING.flight);

    let taken = false;
    const take = () => {
      if (taken) return;
      if (!ready) {
        asked = true;
        return;
      }
      taken = true;
      pulses.forEach((p) => p.cancel());
      screen.style.cursor = '';
      // The card drawn rises off the deck's top, face down, and turns over above it, standing up to you
      const deckTop = { ...this.measure.seenOf(copy, { imageUrl: null }), pose: middle };
      const shownCards = cards.map((c, i) => {
        const place = this.revealPlace(view, cards.length, i, c.imageUrl, width, height);
        this.flyer.fly({ ...deckTop, imageUrl: c.imageUrl }, place, false, {
          fromBack: true,
          duration: REVEAL_MS,
          hide: place,
          now: true,
        });
        return { card: c, place };
      });
      // Once shown: it flies to your hand while the deck goes back to its zone
      setTimeout(() => {
        shownCards.forEach(({ card, place }, i) => {
          const seen = this.measure.seenOf(place, { imageUrl: card.imageUrl });
          this.flyer.fly(seen, card.element, false, {
            delay: i * TIMING.drawStagger,
            duration: TIMING.draw,
            hide: card.element,
            now: true,
          });
          place.remove();
        });
        big
          .animate([...frames].reverse(), settle)
          .finished.catch(() => undefined)
          .then(() => {
            top.style.visibility = '';
            screen.remove();
            done();
          });
      }, REVEAL_MS + REVEAL_HOLD_MS);
    };
    // A click anywhere (the screen takes them all), or Enter / Space on the deck
    screen.addEventListener('click', (e) => {
      e.stopPropagation();
      take();
    });
    screen.addEventListener('contextmenu', (e) => e.preventDefault());
    big.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      take();
    });
  }

  /** Where the `i`-th of `count` cards drawn is shown face up: standing over the deck, as big as its cards, side by side. */
  private revealPlace(
    view: Window,
    count: number,
    i: number,
    imageUrl: string | null,
    width: number,
    height: number,
  ): HTMLElement {
    const gap = width * 0.1;
    const left = view.innerWidth / 2 - (count * width + (count - 1) * gap) / 2 + i * (width + gap);
    const place = this.document.createElement('img');
    place.alt = '';
    if (imageUrl) place.src = imageUrl;
    Object.assign(place.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${view.innerHeight / 2 - height / 2 - height * REVEAL_RISE}px`,
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: `${width * CARD_RADIUS}px`,
      objectFit: 'cover',
      zIndex: LAYER.flight,
      pointerEvents: 'none',
    });
    this.document.body.append(place);
    return place;
  }
}
