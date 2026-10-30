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

/**
 * Animates the cards that leave the field: a copy flies from where the card was to the zone it went to,
 * straightening if it was exhausted and turning over if it ends face down (deck, lives, the rival's hand).
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
      },
    });
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

  private fly(from: Seen, target: Element, faceDown: boolean): void {
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

    const start = `translate(0px, 0px) rotate(${from.tapped ? 90 : 0}deg) rotateY(0deg) scale(1)`;
    const end = `translate(${dx}px, ${dy}px) rotate(0deg) rotateY(${faceDown ? 180 : 0}deg) scale(${scale})`;
    const reduced = this.animations.off() || this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.animations.hold(reduced ? 1 : DURATION);
    const animation = inner.animate([{ transform: start }, { transform: end }], {
      duration: reduced ? 1 : DURATION,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards',
    });
    animation.onfinish = () => flight.remove();
    animation.oncancel = () => flight.remove();
  }
}
