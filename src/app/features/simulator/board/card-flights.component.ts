import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, afterRenderEffect, inject } from '@angular/core';
import { PILES, findSlot } from '@data/simulator/game-rules';
import { GameStore } from '@data/simulator/game.store';
import { fieldRows } from '@data/simulator/legal-actions';
import { CardSlot, GameEvent, GameState, ZoneName } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { BoardChoreography } from './board-choreography';
import { fieldCard, fieldPlace, handCard, handPlace, pile } from './board-dom';
import { CardFlyer } from './card-flyer';
import { CardMotions } from './card-motions';
import { poseOf } from './card-pose';
import { Seen, TableMeasure } from './card-seen';
import { LifeFlights } from './life-flights';
import { TimelineCursor } from './timeline-cursor';
import { TIMING } from './timing';

/** A move of a card from pile to pile in this update, from the timeline, with the turn it plays in. */
interface Hop {
  from: ZoneName;
  to: ZoneName;
  /** Moves of one update play in turns, in the order they happened ("coloca 1 carta al tope. Luego: tributa 2"). */
  delay: number;
}

/**
 * Animates where each update moved the cards, comparing it with how the board was drawn before:
 * - a card leaving the field flies to the zone it went to (a destroyed one has already broken where it lay);
 * - a draw flies from the deck to its place in the hand, face up if it is yours;
 * - cards leaving a hand (the mulligan, a tribute, a discard) or going from pile to pile fly there, in the turns they
 *   happened;
 * - a card that joins a creature as a Material or Recurso flies under it;
 * - on the field, a card that changes line glides there in an arc, and a summoned one comes from its hand or pile and
 *   lands with a burst of light;
 * - the life lost by direct damage turns face up on its pile (and waits there while its owner decides to Reforzar).
 * The opening hand is not dealt: the cards kept in the mulligan are already the hand, only the ones drawn to replace
 * those sent to the bottom fly.
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
  private readonly choreography = inject(BoardChoreography);
  private readonly measure = new TableMeasure(this.document);
  private readonly flyer = new CardFlyer(this.document, this.animations, this.measure, {
    now: () => this.game.state(),
    before: () => this.previous,
    deferring: () => this.deferring,
  });
  private readonly motions = new CardMotions(this.document, this.animations, this.measure, (fn) => this.run(fn), () => this.deferring);
  private readonly lives = new LifeFlights(this.document, this.measure, this.flyer);
  private readonly timeline = new TimelineCursor();

  /** Where each field card was drawn last time: it flies from there when it leaves the field. */
  private seen = new Map<string, Seen>();
  /** Where each card of a hand was drawn last time: a summon leaves from there. */
  private handSeen = new Map<string, Seen>();
  /** The pile each card was in last time ("<owner>:<zone>"): a card summoned from it leaves from that pile. */
  private pileOf = new Map<string, string>();
  /** The state shown before this update: what each pile showed on top until now. */
  private previous: GameState | null = null;
  /** The cards in each deck last time; null until the first state (joining a game does not draw). */
  private deckIds: Set<string> | null = null;
  /** The Materiales and Recursos of each field card last time, to fly the new ones under it. */
  private attached = new Set<string>();
  /**
   * Something started playing with this update (a chain link shown, a resolution): what the update did waits for it,
   * the cards held where they were until then.
   */
  private deferring = false;
  /** The pile-to-pile moves of this update, by card, in order. */
  private hops = new Map<string, Hop[]>();
  /** Each player still choosing their mulligan: the five cards shown to them (the top of their deck). */
  private mulliganTop = new Map<string, Set<string>>();
  /** Cards that do not fly in this update: what a mulligan settled (the hand kept, the starter, the lives). */
  private settled = new Set<string>();

  /** Runs an animation now, or once what plays ends. */
  private run(fn: () => void): void {
    if (this.deferring) this.animations.whenIdle(fn);
    else fn();
  }

  private me(): string | undefined {
    return this.game.myState()?.userId;
  }

  constructor() {
    // Before an update is shown, on the table as it still is: a destroyed card breaks where it lies, the life lost
    // turns face up on its pile
    this.choreography.register({
      shatter: (id) => this.shatterNow(id),
      showLife: (owner, lifeId, next) => this.lives.show(owner, lifeId, next, this.game.state()),
    });
    afterRenderEffect({
      read: () => {
        const state = this.game.state();
        if (!state) return;
        this.lives.park(state);
        // A jump through time: nothing flies, the cards are just where they are now
        if (this.game.jumped()) {
          this.seen = this.measure.field(state);
          this.handSeen = this.measure.hands(state);
          this.deckIds = new Set(Object.values(state.players ?? {}).flatMap((p) => p.deck.map((c) => c.instanceId)));
          this.timeline.skip(state);
          return;
        }
        this.deferring = !this.animations.idle();
        this.settled = this.mulliganSettled(state);
        const onField = new Set(Object.values(state.players ?? {}).flatMap((p) => p.field.map((c) => c.instanceId)));
        this.hops = this.hopsNow(state);
        this.fieldLeaves(state, onField);
        this.lives.unpark(state, this.me());
        this.handLeaves(state, onField);
        this.pileMoves(state);
        this.attachments(state);
        // A card drawn with a summon (an effect's) is drawn once the summon has landed
        if (this.fieldMoves(state)) this.deferring = true;
        this.seen = this.measure.field(state);
        this.handSeen = this.measure.hands(state);
        this.pileOf = new Map(
          Object.values(state.players ?? {}).flatMap((p) => PILES.flatMap((z) => (p[z] as CardSlot[]).map((c) => [c.instanceId, `${p.userId}:${z}`] as const))),
        );
        this.draws(state);
        this.mulliganTop = new Map(
          Object.values(state.players ?? {})
            .filter((p) => state.status === 'MULLIGAN' && !p.hand.length)
            .map((p) => [p.userId, new Set(p.deck.slice(0, 5).map((c) => c.instanceId))]),
        );
        this.previous = state;
      },
    });
  }

  /** Cards that left the field fly to their zone (a destroyed one has already broken where it lay: BoardChoreography). */
  private fieldLeaves(state: GameState, onField: Set<string>): void {
    for (const [id, from] of this.seen) {
      if (onField.has(id) || this.settled.has(id)) continue;
      const to = this.measure.destination(state, id, this.me());
      if (to) this.flyer.fly(from, to.element, to.faceDown);
    }
  }

  /**
   * A player who confirmed their mulligan in this update: the cards they kept, their starter joining the hand and
   * their lives just appear. Only the cards drawn to replace those sent to the bottom are drawn from the deck.
   */
  private mulliganSettled(state: GameState): Set<string> {
    const settled = new Set<string>();
    for (const p of Object.values(state.players ?? {})) {
      const top = this.mulliganTop.get(p.userId);
      if (!top || !p.hand.length) continue;
      const replaced = (c: CardSlot) => !top.has(c.instanceId) && !!this.deckIds?.has(c.instanceId);
      p.hand.filter((c) => !replaced(c)).forEach((c) => settled.add(c.instanceId));
      p.lifeStack.forEach((c) => settled.add(c.instanceId));
    }
    return settled;
  }

  /**
   * Cards drawn fly from the deck to their place in the hand: those that were in the deck last time, and those of
   * a new DRAW event (an effect that looked at the top cards took them out of the deck before drawing).
   */
  private draws(state: GameState): void {
    const before = this.deckIds;
    const players = Object.values(state.players ?? {});
    this.deckIds = new Set(players.flatMap((p) => p.deck.map((c) => c.instanceId)));
    const events = this.timeline.fresh(state);
    if (!before) return;
    const drawnByEvent = new Set(events.filter((e) => e.type === 'DRAW' && e.cardInstanceId).map((e) => e.cardInstanceId));
    const me = this.me();
    for (const p of players) {
      const deck = pile(this.document, p.userId, 'deck');
      if (!deck) continue;
      const drawn = p.hand.filter((c) => (before.has(c.instanceId) || drawnByEvent.has(c.instanceId)) && !this.settled.has(c.instanceId));
      drawn.forEach((c, i) => {
        const card = handCard(this.document, c.instanceId);
        const target = card ?? pile(this.document, p.userId, 'hand');
        if (!target) return;
        // It leaves from the deck's top card, at its size (the empty pile when it was the last one)
        const from = this.measure.pileTop(deck, c.imageUrl);
        const faceUp = p.userId === me && !c.faceDown;
        this.flyer.fly(from, target, !faceUp, { fromBack: true, delay: i * TIMING.drawStagger, duration: TIMING.draw, hide: card });
      });
    }
  }

  /**
   * The moves from pile to pile of this update (its new timeline events), by card. They play in turns, in the order they
   * happened: a run of moves alike (the same kind, from and to the same zones, as the 2 cards of "tributa 2") is one turn.
   */
  private hopsNow(state: GameState): Map<string, Hop[]> {
    const piles = new Set<string>(PILES);
    const events = this.timeline
      .peek(state)
      .filter((e): e is GameEvent & { cardInstanceId: string; fromZone: ZoneName; toZone: ZoneName } =>
        !!e.cardInstanceId && piles.has(e.fromZone ?? '') && piles.has(e.toZone ?? '') && e.fromZone !== e.toZone)
      .sort((a, b) => a.seq - b.seq);
    const hops = new Map<string, Hop[]>();
    let turn = -1;
    let last = '';
    for (const e of events) {
      const key = `${e.type}|${e.playerId}|${e.fromZone}|${e.toZone}`;
      if (key !== last) turn++;
      last = key;
      hops.set(e.cardInstanceId, [...(hops.get(e.cardInstanceId) ?? []), { from: e.fromZone, to: e.toZone, delay: turn * TIMING.flight }]);
    }
    return hops;
  }

  /**
   * Cards that left a hand for a pile (the mulligan, a tribute, a discard) fly from where they were in it. One that went
   * through another pile first ("colócala al tope de tu mazo", then tributed from there) stops there on its way.
   */
  private handLeaves(state: GameState, onField: Set<string>): void {
    if (!this.handSeen.size) return;
    const players = Object.values(state.players ?? {});
    const inHand = new Set(players.flatMap((p) => p.hand.map((c) => c.instanceId)));
    for (const [id, from] of this.handSeen) {
      if (inHand.has(id) || onField.has(id) || this.lives.flown.has(id) || this.lives.isParked(id)) continue;
      const to = this.measure.destination(state, id, this.me());
      if (!to) continue;
      const hops = this.hops.get(id) ?? [];
      const owner = players.find((p) => PILES.some((z) => (p[z] as CardSlot[]).some((c) => c.instanceId === id)))?.userId;
      if (hops.length < 2 || hops[0].from !== 'hand' || !owner) {
        this.flyer.fly(from, to.element, to.faceDown, { delay: hops.at(-1)?.delay ?? 0 });
        continue;
      }
      let at: Seen = from;
      hops.forEach((hop, i) => {
        const last = i === hops.length - 1;
        const target = last ? to.element : pile(this.document, owner, hop.to);
        if (!target) return;
        const downThere = last ? to.faceDown : hop.to === 'deck' || hop.to === 'lifeStack';
        this.flyer.fly(at, target, downThere, { delay: hop.delay, fromBack: i > 0 && (hop.from === 'deck' || hop.from === 'lifeStack') });
        at = { ...(this.measure.pile(`${owner}:${hop.to}`) ?? at), imageUrl: at.imageUrl };
      });
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
          if (!was || was === now || was.endsWith(':hand') || this.settled.has(c.instanceId) || this.lives.isParked(c.instanceId)) continue;
          if (zone === 'hand' && was.endsWith(':deck')) continue;
          const from = this.measure.pile(was);
          const to = this.measure.destination(state, c.instanceId, this.me());
          const delay = this.hops.get(c.instanceId)?.at(-1)?.delay ?? 0;
          // A life shown face up on its pile (direct damage) leaves face up
          const revealed = this.choreography.revealedLives.delete(c.instanceId);
          const fromBack = was.endsWith(':deck') || (was.endsWith(':lifeStack') && !revealed);
          if (from && to) this.flyer.fly({ ...from, imageUrl: c.imageUrl }, to.element, to.faceDown, { fromBack, delay });
        }
      }
    }
  }

  /** A card that joins a creature as a Material or Recurso flies under it, from wherever it was. */
  private attachments(state: GameState): void {
    const now = new Set<string>();
    for (const p of Object.values(state.players ?? {})) {
      for (const host of p.field) {
        const target = fieldCard(this.document, host.instanceId);
        for (const a of [...host.materials, ...host.resources]) {
          now.add(a.instanceId);
          if (this.attached.has(a.instanceId) || !target || (!this.seen.size && !this.handSeen.size)) continue;
          const from = this.handSeen.get(a.instanceId) ?? this.seen.get(a.instanceId) ?? this.measure.pile(this.pileOf.get(a.instanceId));
          if (from) this.flyer.fly({ ...from, imageUrl: a.imageUrl }, target, !!a.faceDown, { duration: TIMING.flight, under: true });
        }
      }
    }
    this.attached = now;
  }

  /**
   * Field cards that changed line glide there in an arc; those new on the field (summoned) come from the hand or
   * the pile they were in, and light up as they land. Only once there is a previous drawing to compare with. True
   * when a card was summoned.
   */
  private fieldMoves(state: GameState): boolean {
    if (!this.seen.size && !this.handSeen.size) return false;
    let summoned = false;
    const me = this.me();
    for (const p of Object.values(state.players ?? {})) {
      const front = new Set(fieldRows(p.field).front.map((c) => c.instanceId));
      for (const c of p.field) {
        const box = fieldPlace(this.document, c.instanceId);
        const card = box?.querySelector<HTMLElement>('eras-game-card');
        if (!box || !card) continue;
        const was = this.seen.get(c.instanceId);
        if (was) {
          if (was.front !== front.has(c.instanceId)) this.motions.glide(box, card, was, TIMING.move, true);
          continue;
        }
        // New on the field: from its place in the hand, else from the pile it was in. Where it lands is measured
        // before it starts to travel (once it moves, its box is where it comes from)
        const landing = card.getBoundingClientRect();
        const from = this.handSeen.get(c.instanceId) ?? this.measure.pile(this.pileOf.get(c.instanceId));
        if (from) this.motions.glide(box, card, from, TIMING.summon, false);
        this.motions.burst(card, landing, p.userId === me, from ? TIMING.summon : 0);
        summoned = true;
      }
    }
    return summoned;
  }

  /**
   * A card destroyed, before its update is shown: it breaks where it lies (the field, a hand or the top of its pile)
   * and stays hidden until the update moves it; done when it is gone.
   */
  private shatterNow(id: string): Promise<void> {
    const from = this.seen.get(id) ?? this.handSeen.get(id) ?? (this.pileOf.has(id) ? this.measure.pile(this.pileOf.get(id)) : null);
    if (!from || this.animations.still()) return Promise.resolve();
    const real = fieldPlace(this.document, id) ?? handPlace(this.document, id);
    // As drawn now: a blocker exhausted with its block breaks turned
    const tapped = from.tapped || !!real?.querySelector('eras-game-card.tapped');
    this.motions.shatter({ ...from, tapped, imageUrl: from.imageUrl ?? findSlot(this.game.state(), id)?.imageUrl ?? null });
    // It flies to its zone from how it lies now (turned, if exhausted with its block)
    const drawn = real?.querySelector<HTMLElement>('eras-game-card');
    if (drawn && this.seen.has(id)) this.seen.set(id, { ...from, tapped, pose: poseOf(drawn) });
    if (real) real.style.visibility = 'hidden';
    return new Promise((done) => setTimeout(done, TIMING.shatter));
  }
}
