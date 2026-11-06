import { PILES } from '@data/simulator/game-rules';
import { fieldRows } from '@data/simulator/legal-actions';
import { CardSlot, GameState } from '@data/simulator/simulator.model';
import { fieldCard, handCard, lifeCard, pile, pileByKey } from './board-dom';
import { CardPose, poseOf } from './card-pose';
import { tablePlane } from './table-plane';

/** How a card was drawn (on the field, in a hand, on top of a pile): a flight or a break starts from here. */
export interface Seen {
  x: number;
  y: number;
  width: number;
  height: number;
  tapped: boolean;
  imageUrl: string | null;
  /** On the Línea frontal (a field card). */
  front?: boolean;
  /** It lies on the table, which may lean ("Mesa en perspectiva"): not your hand, which stands up facing you. */
  plane?: boolean;
  /** On the rival's side: its cards face you upside down. */
  rival?: boolean;
  /** Where, how big and turned on each axis it is drawn (a flight leaves from this pose). */
  pose?: CardPose;
}

/** Where the cards are drawn on the board now: the field, the hands, the piles, and where a card goes. */
export class TableMeasure {
  constructor(private readonly document: Document) {}

  /** How `element` is drawn now (`size`: its own size when the element is an empty pile, not a card). */
  seenOf(element: HTMLElement, card: { imageUrl: string | null; tapped?: boolean; front?: boolean }, size?: { width: number; height: number }): Seen {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      // The layout size, not the rotated box of an exhausted card
      width: size?.width ?? element.offsetWidth,
      height: size?.height ?? element.offsetHeight,
      tapped: !!card.tapped,
      imageUrl: card.imageUrl,
      front: card.front,
      plane: this.onTable(element),
      rival: this.rivalSide(element),
      pose: poseOf(element, size),
    };
  }

  /** Each field card as drawn now. */
  field(state: GameState): Map<string, Seen> {
    const seen = new Map<string, Seen>();
    for (const p of Object.values(state.players ?? {})) {
      const front = new Set(fieldRows(p.field).front.map((c) => c.instanceId));
      for (const c of p.field) {
        const card = fieldCard(this.document, c.instanceId);
        if (card) seen.set(c.instanceId, this.seenOf(card, { imageUrl: c.imageUrl, tapped: c.tapped, front: front.has(c.instanceId) }));
      }
    }
    return seen;
  }

  /** Each card of the hands as drawn now. */
  hands(state: GameState): Map<string, Seen> {
    const seen = new Map<string, Seen>();
    for (const p of Object.values(state.players ?? {})) {
      for (const c of p.hand) {
        const card = handCard(this.document, c.instanceId);
        if (card) seen.set(c.instanceId, this.seenOf(card, { imageUrl: c.imageUrl }));
      }
    }
    return seen;
  }

  /** The card shown on a pile ("<owner>:<zone>"), or the empty pile at a card's size, as a starting point. */
  pile(key: string | undefined): Seen | null {
    const element = key ? pileByKey(this.document, key) : null;
    return element ? this.pileTop(element) : null;
  }

  /** The card shown on a pile element (or the empty pile at a card's size). */
  pileTop(element: HTMLElement, imageUrl: string | null = null): Seen {
    const top = element.querySelector<HTMLElement>('eras-game-card');
    if (top) return this.seenOf(top, { imageUrl });
    const rect = element.getBoundingClientRect();
    const width = Math.min(rect.width, (rect.height * 63) / 88);
    return this.seenOf(element, { imageUrl }, { width, height: (width * 88) / 63 });
  }

  /** The zone a card is in now (a life: its own place in the lives), and whether it shows its back there to me. */
  destination(state: GameState, id: string, me: string | undefined): { element: Element; faceDown: boolean } | null {
    for (const p of Object.values(state.players ?? {})) {
      for (const zone of PILES) {
        const card = (p[zone] as CardSlot[]).find((c) => c.instanceId === id);
        if (!card) continue;
        const element = (zone === 'lifeStack' ? lifeCard(this.document, p.userId, id) : null) ?? pile(this.document, p.userId, zone);
        if (!element) return null;
        const hiddenHand = zone === 'hand' && p.userId !== me;
        return { element, faceDown: card.faceDown || hiddenHand || zone === 'deck' };
      }
    }
    return null;
  }

  /** On the rival's half of the table: the cards there face you upside down. */
  rivalSide(element: Element): boolean {
    return !!element.closest('eras-player-half.opponent');
  }

  /** The element lies on the leaning table (else the table is flat, or it stands up: your hand). */
  onTable(element: Element): boolean {
    return !!tablePlane(this.document)?.holds(element);
  }
}
