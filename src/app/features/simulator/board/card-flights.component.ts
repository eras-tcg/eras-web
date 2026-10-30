import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterRenderEffect, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { CardSlot, GameState, ZoneName } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';

/** Where a field card was drawn last time, to fly it from there when it leaves the field. */
interface Seen {
  x: number;
  y: number;
  width: number;
  height: number;
  tapped: boolean;
  imageUrl: string | null;
}

const PILES: ZoneName[] = ['hand', 'deck', 'lifeStack', 'tributeZone', 'discardPile'];
const DURATION = 650;
/** A draw: each card leaves the deck a little after the one before. */
const DRAW_DURATION = 550;
const DRAW_STAGGER = 120;

/**
 * Animates the cards that leave the field: a copy flies from where the card was to the zone it went to,
 * straightening if it was exhausted and turning over if it ends face down (deck, lives, the rival's hand).
 * Draws too: a card that goes from the deck to the hand flies there face down and turns face up if it is yours.
 */
@Component({
  selector: 'eras-card-flights',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFlightsComponent {
  private readonly game = inject(GameStore);
  private readonly document = inject(DOCUMENT);
  private readonly animations = inject(BoardAnimations);
  private seen = new Map<string, Seen>();
  /** The cards in each deck last time; null until the first state (joining a game does not draw). */
  private deckIds: Set<string> | null = null;

  constructor() {
    afterRenderEffect({
      read: () => {
        const state = this.game.state();
        if (!state) return;
        const onField = new Set(Object.values(state.players ?? {}).flatMap((p) => p.field.map((c) => c.instanceId)));
        for (const [id, from] of this.seen) {
          if (onField.has(id)) continue;
          const to = this.destination(state, id);
          if (to) this.fly(from, to.element, to.faceDown);
        }
        this.seen = this.measure(state);
        this.draws(state);
      },
    });
  }

  /** Cards that were in a deck and are now in a hand fly from that deck to their place in the hand. */
  private draws(state: GameState): void {
    const before = this.deckIds;
    const players = Object.values(state.players ?? {});
    this.deckIds = new Set(players.flatMap((p) => p.deck.map((c) => c.instanceId)));
    if (!before) return;
    const me = this.game.myState()?.userId;
    for (const p of players) {
      const deck = this.document.querySelector<HTMLElement>(`[data-pile="${p.userId}:deck"]`);
      if (!deck) continue;
      const drawn = p.hand.filter((c) => before.has(c.instanceId));
      drawn.forEach((c, i) => {
        const card = this.document.querySelector<HTMLElement>(`[data-hand-id="${c.instanceId}"] eras-game-card`);
        const target = card ?? this.document.querySelector(`[data-pile="${p.userId}:hand"]`);
        if (!target) return;
        const rect = deck.getBoundingClientRect();
        const width = card?.offsetWidth ?? rect.width;
        const from: Seen = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width, height: (width * 88) / 63, tapped: false, imageUrl: c.imageUrl };
        const faceUp = p.userId === me && !c.faceDown;
        this.fly(from, target, !faceUp, { fromBack: true, delay: i * DRAW_STAGGER, duration: DRAW_DURATION, hide: card });
      });
    }
  }

  /** The zone a card went to, and whether it shows its back there. */
  private destination(state: GameState, id: string): { element: Element; faceDown: boolean } | null {
    const me = this.game.myState()?.userId;
    for (const p of Object.values(state.players ?? {})) {
      for (const zone of PILES) {
        const card = (p[zone] as CardSlot[]).find((c) => c.instanceId === id);
        if (!card) continue;
        const element = this.document.querySelector(`[data-pile="${p.userId}:${zone}"]`);
        if (!element) return null;
        const hiddenHand = zone === 'hand' && p.userId !== me;
        return { element, faceDown: card.faceDown || hiddenHand || zone === 'deck' };
      }
    }
    return null;
  }

  private measure(state: GameState): Map<string, Seen> {
    const seen = new Map<string, Seen>();
    for (const p of Object.values(state.players ?? {})) {
      for (const c of p.field) {
        const card = this.document.querySelector<HTMLElement>(`[data-instance-id="${c.instanceId}"] eras-game-card`);
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        // The layout size, not the rotated box of an exhausted card
        seen.set(c.instanceId, {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: card.offsetWidth,
          height: card.offsetHeight,
          tapped: c.tapped,
          imageUrl: c.imageUrl,
        });
      }
    }
    return seen;
  }

  /**
   * A copy of the card flies from `from` to `target`. `fromBack`: it starts face down (a card leaving the deck);
   * `hide`: the real card waits hidden until the copy lands.
   */
  private fly(from: Seen, target: Element, faceDown: boolean, options: { fromBack?: boolean; delay?: number; duration?: number; hide?: HTMLElement | null } = {}): void {
    const to = target.getBoundingClientRect();
    const toCard = target.querySelector<HTMLElement>('eras-game-card');
    const scale = toCard ? toCard.offsetWidth / from.width : 0.75;
    const dx = to.left + to.width / 2 - from.x;
    const dy = to.top + to.height / 2 - from.y;

    const flight = this.document.createElement('div');
    Object.assign(flight.style, {
      position: 'fixed',
      left: `${from.x - from.width / 2}px`,
      top: `${from.y - from.height / 2}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: '40',
      pointerEvents: 'none',
      perspective: '800px',
    });
    const inner = this.document.createElement('div');
    Object.assign(inner.style, { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' });
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
        boxShadow: '0 8px 24px rgb(0 0 0 / 45%)',
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

    const start = `translate(0px, 0px) rotate(${from.tapped ? 90 : 0}deg) rotateY(${options.fromBack ? 180 : 0}deg) scale(1)`;
    const end = `translate(${dx}px, ${dy}px) rotate(0deg) rotateY(${faceDown ? 180 : 0}deg) scale(${scale})`;
    const reduced = this.animations.off() || this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduced ? 0 : (options.delay ?? 0);
    const duration = reduced ? 1 : (options.duration ?? DURATION);
    this.animations.hold(delay + duration);
    if (options.hide) options.hide.style.visibility = 'hidden';
    const animation = inner.animate([{ transform: start }, { transform: end }], {
      duration,
      delay,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'both',
    });
    const done = () => {
      flight.remove();
      if (options.hide) options.hide.style.visibility = '';
    };
    animation.onfinish = done;
    animation.oncancel = done;
  }
}
