import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterRenderEffect, inject } from '@angular/core';
import { GameStore } from '@data/simulator/game.store';
import { fieldRows } from '@data/simulator/legal-actions';
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
  /** On the Línea frontal (a field card). */
  front?: boolean;
}

const PILES: ZoneName[] = ['hand', 'deck', 'lifeStack', 'tributeZone', 'discardPile'];
const DURATION = 650;
/** A draw: each card leaves the deck a little after the one before. */
const DRAW_DURATION = 550;
const DRAW_STAGGER = 120;
/** A card changing line, and a card entering the field (a summon): it travels, then lights up where it lands. */
const MOVE_DURATION = 520;
const SUMMON_DURATION = 600;
const BURST_DURATION = 750;
/** A destroyed card cracks where it was before it flies to the Descarte. */
const SHATTER_DURATION = 420;

/**
 * Animates the cards that leave the field: a copy flies from where the card was to the zone it went to,
 * straightening if it was exhausted and turning over if it ends face down (deck, lives, the rival's hand).
 * Draws too: a card that goes from the deck to the hand flies there face down and turns face up if it is yours.
 * On the field, a card that changes line (Línea frontal ↔ Retaguardia) travels in an arc from where it was, and a
 * card that enters it (a summon) comes from its hand or its pile and lands with a burst of light. A destroyed card
 * cracks before it leaves. Cards leaving a hand (the mulligan, a tribute, a discard), going from pile to pile (a
 * life healed from the deck) or joining a creature as a Material or Recurso fly there too.
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
  /** The last timeline event already seen. */
  private lastSeq = 0;
  /** Where each card of a hand was drawn last time: a summon leaves from there. */
  private handSeen = new Map<string, Seen>();
  /** The pile each card was in last time (its owner and zone): a card summoned from it leaves from that pile. */
  private pileOf = new Map<string, string>();
  /** The Materiales and Recursos of each field card last time, to fly the new ones under it. */
  private attached = new Set<string>();
  /**
   * Something started playing with this update (a chain link shown, a resolution): what the update did waits for it,
   * the cards held where they were until then.
   */
  private deferring = false;

  /** Runs an animation now, or once what plays ends. */
  private run(fn: () => void): void {
    if (this.deferring) this.animations.whenIdle(fn);
    else fn();
  }

  constructor() {
    afterRenderEffect({
      read: () => {
        const state = this.game.state();
        if (!state) return;
        this.deferring = !this.animations.idle();
        const onField = new Set(Object.values(state.players ?? {}).flatMap((p) => p.field.map((c) => c.instanceId)));
        const destroyed = this.destroyedNow(state);
        for (const [id, from] of this.seen) {
          if (onField.has(id)) continue;
          const to = this.destination(state, id);
          if (!to) continue;
          // Destroyed: it cracks where it was, then flies
          const cracks = destroyed.has(id) && !this.reduced();
          this.run(() => {
            if (cracks) this.shatter(from);
          });
          this.fly(from, to.element, to.faceDown, { delay: cracks ? SHATTER_DURATION : 0 });
        }
        this.handLeaves(state, onField);
        this.pileMoves(state);
        this.attachments(state);
        // A card drawn with a summon (an effect's) is drawn once the summon has landed
        if (this.fieldMoves(state)) this.deferring = true;
        this.seen = this.measure(state);
        this.handSeen = this.measureHands(state);
        this.pileOf = new Map(
          Object.values(state.players ?? {}).flatMap((p) => PILES.flatMap((z) => (p[z] as CardSlot[]).map((c) => [c.instanceId, `${p.userId}:${z}`] as const))),
        );
        this.draws(state);
      },
    });
  }

  /**
   * Cards drawn fly from the deck to their place in the hand: those that were in the deck last time, and those of
   * a new DRAW event (an effect that looked at the top cards took them out of the deck before drawing).
   */
  private draws(state: GameState): void {
    const before = this.deckIds;
    const players = Object.values(state.players ?? {});
    this.deckIds = new Set(players.flatMap((p) => p.deck.map((c) => c.instanceId)));
    const timeline = state.timeline ?? [];
    // A new game starts a new timeline
    if (Math.max(0, ...timeline.map((e) => e.seq)) < this.lastSeq) this.lastSeq = 0;
    const events = timeline.filter((e) => e.seq > this.lastSeq);
    this.lastSeq = Math.max(this.lastSeq, ...events.map((e) => e.seq));
    if (!before) return;
    const drawnByEvent = new Set(events.filter((e) => e.type === 'DRAW' && e.cardInstanceId).map((e) => e.cardInstanceId));
    const me = this.game.myState()?.userId;
    for (const p of players) {
      const deck = this.document.querySelector<HTMLElement>(`[data-pile="${p.userId}:deck"]`);
      if (!deck) continue;
      const drawn = p.hand.filter((c) => before.has(c.instanceId) || drawnByEvent.has(c.instanceId));
      drawn.forEach((c, i) => {
        const card = this.document.querySelector<HTMLElement>(`[data-hand-id="${c.instanceId}"] eras-game-card`);
        const target = card ?? this.document.querySelector(`[data-pile="${p.userId}:hand"]`);
        if (!target) return;
        // It leaves from the deck's top card, at its size (the empty pile when it was the last one)
        const top = deck.querySelector<HTMLElement>('eras-game-card');
        const rect = (top ?? deck).getBoundingClientRect();
        const width = top?.offsetWidth ?? Math.min(rect.width, (rect.height * 63) / 88);
        const from: Seen = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width, height: (width * 88) / 63, tapped: false, imageUrl: c.imageUrl };
        const faceUp = p.userId === me && !c.faceDown;
        this.fly(from, target, !faceUp, { fromBack: true, delay: i * DRAW_STAGGER, duration: DRAW_DURATION, hide: card });
      });
    }
  }

  /** The cards destroyed or sacrificed in this update (its new timeline events; the timeline is not consumed here). */
  private destroyedNow(state: GameState): Set<string> {
    const events = (state.timeline ?? []).filter((e) => e.seq > this.lastSeq && (e.type === 'DESTROY' || e.type === 'SACRIFICE'));
    return new Set(events.map((e) => e.cardInstanceId).filter((id): id is string => !!id));
  }

  /** Cards that left a hand for a pile (the mulligan, a tribute, a discard) fly from where they were in it. */
  private handLeaves(state: GameState, onField: Set<string>): void {
    if (!this.handSeen.size) return;
    const inHand = new Set(Object.values(state.players ?? {}).flatMap((p) => p.hand.map((c) => c.instanceId)));
    for (const [id, from] of this.handSeen) {
      if (inHand.has(id) || onField.has(id)) continue;
      const to = this.destination(state, id);
      if (to) this.fly(from, to.element, to.faceDown);
    }
  }

  /**
   * Cards that went from one pile to another (a life healed from the deck, a card of the Tributos to the hand) fly
   * from pile to pile. A draw (deck to hand) has its own flight.
   */
  private pileMoves(state: GameState): void {
    if (!this.pileOf.size) return;
    for (const p of Object.values(state.players ?? {})) {
      for (const zone of PILES) {
        for (const c of p[zone] as CardSlot[]) {
          const was = this.pileOf.get(c.instanceId);
          const now = `${p.userId}:${zone}`;
          if (!was || was === now || was.endsWith(':hand')) continue;
          if (zone === 'hand' && was.endsWith(':deck')) continue;
          const from = this.pileSeen(was);
          const to = this.destination(state, c.instanceId);
          if (from && to) this.fly({ ...from, imageUrl: c.imageUrl }, to.element, to.faceDown, { fromBack: was.endsWith(':deck') || was.endsWith(':lifeStack') });
        }
      }
    }
  }

  /** A card that joins a creature as a Material or Recurso flies under it, from wherever it was. */
  private attachments(state: GameState): void {
    const now = new Set<string>();
    for (const p of Object.values(state.players ?? {})) {
      for (const host of p.field) {
        const target = this.document.querySelector<HTMLElement>(`[data-instance-id="${host.instanceId}"] eras-game-card`);
        for (const a of [...host.materials, ...host.resources]) {
          now.add(a.instanceId);
          if (this.attached.has(a.instanceId) || !target || (!this.seen.size && !this.handSeen.size)) continue;
          const from = this.handSeen.get(a.instanceId) ?? this.seen.get(a.instanceId) ?? this.pileSeen(this.pileOf.get(a.instanceId));
          if (from) this.fly({ ...from, imageUrl: a.imageUrl }, target, !!a.faceDown, { duration: DURATION, under: true });
        }
      }
    }
    this.attached = now;
  }

  /** A destroyed card cracks where it was: it shakes, a red flash and a burst of shards. */
  private shatter(from: Seen): void {
    const box = this.document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      left: `${from.x - from.width / 2}px`,
      top: `${from.y - from.height / 2}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: '1051',
      pointerEvents: 'none',
      borderRadius: '6px',
      transform: from.tapped ? 'rotate(90deg)' : '',
    });
    if (from.imageUrl) {
      Object.assign(box.style, { backgroundImage: `url("${from.imageUrl}")`, backgroundSize: 'cover' });
    } else {
      box.style.background = 'var(--color-card-back)';
    }
    // Cracks drawn over it
    const cracks = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cracks.setAttribute('viewBox', '0 0 63 88');
    Object.assign(cracks.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    cracks.innerHTML =
      '<path d="M31 40 L20 8 M31 40 L48 14 M31 40 L58 46 M31 40 L44 80 M31 40 L14 70 M31 40 L4 36 M20 8 L12 2 M48 14 L56 6 M44 80 L50 87" ' +
      'stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" style="filter: drop-shadow(0 0 2px #ef4444)"/>';
    box.append(cracks);
    this.document.body.append(box);
    this.animations.hold(SHATTER_DURATION);
    cracks.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'both' });
    const animation = box.animate(
      [
        { transform: `${box.style.transform} translateX(0)`, filter: 'none' },
        { transform: `${box.style.transform} translateX(-4px)`, filter: 'brightness(1.4) drop-shadow(0 0 12px #ef4444)', offset: 0.25 },
        { transform: `${box.style.transform} translateX(4px)`, filter: 'brightness(1.6) drop-shadow(0 0 18px #ef4444)', offset: 0.5 },
        { transform: `${box.style.transform} translateX(-2px) scale(1.04)`, filter: 'brightness(2) drop-shadow(0 0 24px #ef4444)', opacity: 1, offset: 0.8 },
        { transform: `${box.style.transform} scale(1.1)`, filter: 'brightness(2.5) blur(2px)', opacity: 0 },
      ],
      { duration: SHATTER_DURATION, easing: 'ease-in' },
    );
    animation.onfinish = () => box.remove();
    animation.oncancel = () => box.remove();
  }

  /**
   * Field cards that changed line glide there in an arc; those new on the field (summoned) come from the hand or
   * the pile they were in, and light up as they land. Only once there is a previous drawing to compare with. True
   * when a card was summoned.
   */
  private fieldMoves(state: GameState): boolean {
    if (!this.seen.size && !this.handSeen.size) return false;
    let summoned = false;
    const me = this.game.myState()?.userId;
    for (const p of Object.values(state.players ?? {})) {
      const front = new Set(fieldRows(p.field).front.map((c) => c.instanceId));
      for (const c of p.field) {
        const box = this.document.querySelector<HTMLElement>(`[data-instance-id="${c.instanceId}"]`);
        const card = box?.querySelector<HTMLElement>('eras-game-card');
        if (!box || !card) continue;
        const was = this.seen.get(c.instanceId);
        if (was) {
          if (was.front !== front.has(c.instanceId)) this.glide(box, card, was, MOVE_DURATION, true);
          continue;
        }
        // New on the field: from its place in the hand, else from the pile it was in
        const from = this.handSeen.get(c.instanceId) ?? this.pileSeen(this.pileOf.get(c.instanceId));
        if (from) this.glide(box, card, from, SUMMON_DURATION, false);
        this.burst(card, p.userId === me, from ? SUMMON_DURATION : 0);
        summoned = true;
      }
    }
    return summoned;
  }

  /** The card shown on a pile (or the empty pile), as a starting point. */
  private pileSeen(pile: string | undefined): Seen | null {
    if (!pile) return null;
    const element = this.document.querySelector<HTMLElement>(`[data-pile="${pile}"]`);
    if (!element) return null;
    const top = element.querySelector<HTMLElement>('eras-game-card');
    const rect = (top ?? element).getBoundingClientRect();
    const width = top?.offsetWidth ?? Math.min(rect.width, (rect.height * 63) / 88);
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width, height: (width * 88) / 63, tapped: false, imageUrl: null };
  }

  private reduced(): boolean {
    return this.animations.off() || !!this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * The real card travels from where it was to where it is now (it is put back there and let go): straight for a
   * summon, in an arc (rising a little, then down) for a change of line.
   */
  private glide(box: HTMLElement, card: HTMLElement, from: Seen, duration: number, arc: boolean): void {
    if (this.reduced()) return;
    const rect = card.getBoundingClientRect();
    const dx = from.x - (rect.left + rect.width / 2);
    const dy = from.y - (rect.top + rect.height / 2);
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    const scale = card.offsetWidth ? from.width / card.offsetWidth : 1;
    const lift = Math.min(40, Math.hypot(dx, dy) * 0.25);
    const frames: Keyframe[] = arc
      ? [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, filter: 'drop-shadow(0 0 0 transparent)' },
          { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(${scale * 1.08})`, filter: 'drop-shadow(0 14px 18px rgb(0 0 0 / 55%))', offset: 0.5 },
          { transform: 'translate(0, 0) scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
        ]
      : [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: 'translate(0, 0) scale(1.06)', offset: 0.85 },
          { transform: 'translate(0, 0) scale(1)' },
        ];
    // Above its neighbours while it travels; held where it was while something else plays
    box.style.position ||= 'relative';
    box.style.zIndex = '30';
    if (this.deferring) box.style.transform = String(frames[0]['transform']);
    this.run(() => {
      box.style.transform = '';
      this.animations.hold(duration);
      const animation = box.animate(frames, { duration, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
      const done = () => (box.style.zIndex = '');
      animation.onfinish = done;
      animation.oncancel = done;
    });
  }

  /** A summoned card lands: a ring of light opens from it and a glow fades on it (cyan yours, pink the rival's). */
  private burst(card: HTMLElement, mine: boolean, delay: number): void {
    if (this.reduced()) return;
    this.run(() => this.burstNow(card, mine, delay));
  }

  private burstNow(card: HTMLElement, mine: boolean, delay: number): void {
    const color = mine ? '#38bdf8' : '#f472b6';
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ring = this.document.createElement('div');
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${rect.left + rect.width / 2 - size / 2}px`,
      top: `${rect.top + rect.height / 2 - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      boxShadow: `0 0 24px 6px ${color}, inset 0 0 24px 4px ${color}`,
      zIndex: '1050',
      pointerEvents: 'none',
      opacity: '0',
    });
    this.document.body.append(ring);
    this.animations.hold(delay + BURST_DURATION);
    const animation = ring.animate(
      [
        { opacity: 0.95, transform: 'scale(0.35)' },
        { opacity: 0, transform: 'scale(1.15)' },
      ],
      { duration: BURST_DURATION, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    );
    animation.onfinish = () => ring.remove();
    animation.oncancel = () => ring.remove();
    card.animate(
      [
        { boxShadow: `0 0 0 3px #fff, 0 0 40px 14px ${color}` },
        { boxShadow: '0 0 0 0 transparent, 0 0 0 0 transparent' },
      ],
      { duration: BURST_DURATION, delay, easing: 'ease-out' },
    );
  }

  private measureHands(state: GameState): Map<string, Seen> {
    const seen = new Map<string, Seen>();
    for (const p of Object.values(state.players ?? {})) {
      for (const c of p.hand) {
        const card = this.document.querySelector<HTMLElement>(`[data-hand-id="${c.instanceId}"] eras-game-card`);
        if (!card) continue;
        const rect = card.getBoundingClientRect();
        seen.set(c.instanceId, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: card.offsetWidth, height: card.offsetHeight, tapped: false, imageUrl: c.imageUrl });
      }
    }
    return seen;
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
      const front = new Set(fieldRows(p.field).front.map((c) => c.instanceId));
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
          front: front.has(c.instanceId),
        });
      }
    }
    return seen;
  }

  /**
   * A copy of the card flies from `from` to `target`. `fromBack`: it starts face down (a card leaving the deck);
   * `hide`: the real card waits hidden until the copy lands.
   */
  private fly(from: Seen, target: Element, faceDown: boolean, options: { fromBack?: boolean; delay?: number; duration?: number; hide?: HTMLElement | null; under?: boolean } = {}): void {
    const to = target.getBoundingClientRect();
    // It lands at the size of the card there: the target itself, or the card shown on that pile
    const toCard = target instanceof HTMLElement && target.matches('eras-game-card') ? target : target.querySelector<HTMLElement>('eras-game-card');
    // Under a creature (a Material or Recurso): it ends a little smaller, peeking out below it
    const scale = (toCard ? toCard.offsetWidth / from.width : 0.75) * (options.under ? 0.85 : 1);
    const dx = to.left + to.width / 2 - from.x;
    const dy = to.top + to.height / 2 - from.y + (options.under ? to.height * 0.12 : 0);

    const flight = this.document.createElement('div');
    Object.assign(flight.style, {
      position: 'fixed',
      left: `${from.x - from.width / 2}px`,
      top: `${from.y - from.height / 2}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      // Over the engine's dialogs (overlay layer): a card drawn by an effect flies while one is open or closing
      zIndex: '1050',
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
    if (options.hide) options.hide.style.visibility = 'hidden';
    if (this.deferring) {
      flight.style.visibility = 'hidden';
      this.animations.whenIdle(() => {
        flight.style.visibility = '';
        this.animations.hold(delay + duration);
        this.launch(inner, flight, start, end, delay, duration, options.hide);
      });
      return;
    }
    this.animations.hold(delay + duration);
    this.launch(inner, flight, start, end, delay, duration, options.hide);
  }

  private launch(inner: HTMLElement, flight: HTMLElement, start: string, end: string, delay: number, duration: number, hide?: HTMLElement | null): void {
    const options = { hide };
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
