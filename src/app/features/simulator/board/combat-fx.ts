import { pileOf } from '@data/simulator/game-rules';
import { GameState } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { centerOf, fieldCard, fieldPlace, pile, tableCard } from './board-dom';
import { FxDraw } from './fx-draw';
import { overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';

/** A field card as drawn: its center, its own size (not the box of an exhausted, turned card) and whether it is turned. */
interface Drawn {
  x: number;
  y: number;
  width: number;
  height: number;
  tapped: boolean;
  imageUrl: string | null;
  /** On the rival's side: its cards face you upside down. */
  rival: boolean;
}

const RIVAL = 'var(--color-sim-rival)';

/** The signs over a card: a block's white shield; an attack's sword (the clash's "VS" icon: steel blade, golden hilt). */
const SHIELD =
  '<path d="M12 2 L20 5 V11 C20 16.5 16.6 20.4 12 22 C7.4 20.4 4 16.5 4 11 V5 Z" fill="rgb(255 255 255 / 88%)" stroke="#fff" stroke-width="1"/>' +
  '<path d="M12 5.2 L17.4 7.2 V11 C17.4 14.9 15.2 17.8 12 19.2 Z" fill="rgb(148 163 184 / 45%)"/>';
const SWORD_BLADE = 'M14.5 17.5 3 6V3h3l11.5 11.5';
const SWORD_HILT = 'M13 19l6-6M16 16l4 4M19 21l2-2';
const SWORD =
  `<path d="${SWORD_BLADE} ${SWORD_HILT}" fill="none" stroke="#1e293b" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${SWORD_BLADE}" fill="rgb(226 232 240 / 55%)" stroke="#f1f5f9" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M5 4.6 15.6 15.2" stroke="#94a3b8" stroke-width="0.9" stroke-linecap="round"/>` +
  `<path d="${SWORD_HILT}" fill="none" stroke="#e9b949" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
/** The sword's glow: a soft rose. */
const SWORD_GLOW = 'color-mix(in srgb, var(--color-sim-rival) 60%, #fff)';

/**
 * The combat and the effects as they happen, on the table as it still is (steps of BoardChoreography): an attack
 * declared, a block, the attacker's blow, an effect activated. Each step is done when its animation is over.
 */
export class CombatFx {
  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
    private readonly draw: FxDraw,
  ) {}

  /**
   * The attacker charges: a copy of it leaves its place, strikes what it hits (`targetId`, or the lives of
   * `attackerOwner`'s rival) and comes back; the real card waits hidden. The target shakes with a red flash at the blow.
   */
  charge(attackerId: string, targetId: string | null, attackerOwner: string | null, state: GameState): Promise<void> {
    const rects = this.measure(state);
    const seen = rects.get(attackerId);
    if (!seen) return Promise.resolve();
    const defender = Object.keys(state.players ?? {}).find((id) => id !== attackerOwner);
    const target = targetId ? fieldCard(this.document, targetId) : defender ? pile(this.document, defender, 'lifeStack') : null;
    const to = target ? centerOf(target) : targetId ? rects.get(targetId) : undefined;
    if (!to) return Promise.resolve();
    // "Mesa en perspectiva": it charges on the leaning table, in the plane's own pixels
    const real = fieldPlace(this.document, attackerId);
    const over = overlayFor(this.document, real, LAYER.charge, !real);
    const from = over.at(seen.x, seen.y);
    const hit = over.at(to.x, to.y);
    // It stops a little short of the target's center, as it hits
    const dx = (hit.x - from.x) * 0.82;
    const dy = (hit.y - from.y) * 0.82;
    // An exhausted card charges turned, and the rival's upside down, as they are on the table
    const degrees = (seen.tapped ? 90 : 0) + (seen.rival ? 180 : 0);
    const turn = degrees ? ` rotate(${degrees}deg)` : '';
    const copy = this.document.createElement('div');
    Object.assign(copy.style, {
      position: over.position,
      left: `${from.x - seen.width / 2}px`,
      top: `${from.y - seen.height / 2}px`,
      width: `${seen.width}px`,
      height: `${seen.height}px`,
      zIndex: LAYER.charge,
      pointerEvents: 'none',
      borderRadius: '6px',
      background: seen.imageUrl ? `center / cover url("${seen.imageUrl}")` : 'var(--color-card-back)',
      boxShadow: '0 8px 24px rgb(0 0 0 / 45%)',
    });
    over.host.append(copy);
    if (real) real.style.visibility = 'hidden';
    this.animations.hold(TIMING.charge);
    const animation = copy.animate(
      [
        { transform: `translate(0, 0) scale(1)${turn}`, filter: 'none' },
        { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.05)${turn}`, filter: `drop-shadow(0 0 10px ${RIVAL})`, offset: 0.18 },
        { transform: `translate(${dx}px, ${dy}px) scale(1.18)${turn}`, filter: `drop-shadow(0 0 18px ${RIVAL})`, offset: 0.42 },
        { transform: `translate(${dx * 0.92}px, ${dy * 0.92}px) scale(1.12)${turn}`, filter: `drop-shadow(0 0 14px ${RIVAL})`, offset: 0.55 },
        { transform: `translate(0, 0) scale(1)${turn}`, filter: 'none' },
      ],
      { duration: TIMING.charge, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
    );
    // The blow lands on the target: it shakes as it is drawn (an exhausted blocker stays turned)
    const own = target ? this.document.defaultView?.getComputedStyle(target).transform : null;
    const base = own && own !== 'none' ? `${own} ` : '';
    target?.animate(
      [
        { transform: `${base}translateX(0)`, filter: 'none' },
        { transform: `${base}translateX(-7px)`, filter: `brightness(1.6) drop-shadow(0 0 16px ${RIVAL})` },
        { transform: `${base}translateX(6px)`, filter: `brightness(1.4) drop-shadow(0 0 12px ${RIVAL})` },
        { transform: `${base}translateX(-3px)`, filter: `drop-shadow(0 0 6px ${RIVAL})` },
        { transform: `${base}translateX(0)`, filter: 'none' },
      ],
      { duration: TIMING.charge * 0.475, delay: TIMING.charge * 0.42, easing: 'ease-out' },
    );
    return new Promise((landed) => {
      const done = () => {
        copy.remove();
        over.remove();
        if (real) real.style.visibility = '';
        landed();
      };
      animation.onfinish = done;
      animation.oncancel = done;
    });
  }

  /**
   * An attack declared: a sword rises over the attacker (which turns sideways when it is exhausted to attack, `tap`)
   * and a red arrow points at what it attacks (the creature, else the defender's lives), which flashes red; done when
   * the sword and the arrow have gone.
   */
  declare(attackerId: string, targetId: string | null, defenderId: string | null, tap: boolean): Promise<void> {
    const attacker = fieldCard(this.document, attackerId);
    const target = targetId ? fieldCard(this.document, targetId) : defenderId ? pile(this.document, defenderId, 'lifeStack') : null;
    if (!attacker) return Promise.resolve();
    if (tap) this.exhaust(attacker);
    const sign = this.draw.badge(attacker, SWORD, SWORD_GLOW);
    if (!target) return sign;
    // Once it has turned, the arrow leaves from where it is
    const turned = tap ? TIMING.tap : 0;
    setTimeout(() => {
      this.draw.arrow(centerOf(attacker), centerOf(target), RIVAL, 5);
      target.animate(
        [
          { filter: 'none' },
          { filter: `brightness(1.3) drop-shadow(0 0 14px ${RIVAL})`, offset: 0.3 },
          { filter: `brightness(1.1) drop-shadow(0 0 8px ${RIVAL})`, offset: 0.7 },
          { filter: 'none' },
        ],
        { duration: TIMING.arrow, delay: TIMING.arrow * 0.35 },
      );
    }, turned);
    const arrowGone = new Promise<void>((done) => setTimeout(done, turned + TIMING.arrow));
    return Promise.all([sign, arrowGone]).then(() => undefined);
  }

  /** A block declared: a white shield rises over the blocker, which turns sideways when it is exhausted to block (`tap`). */
  block(blockerId: string, tap: boolean): Promise<void> {
    const card = fieldCard(this.document, blockerId);
    if (!card) return Promise.resolve();
    if (tap) this.exhaust(card);
    return this.draw.badge(card, SHIELD, '#fff');
  }

  /**
   * An effect activated: its card (on the table, in a hand or on its pile) glows white and a white aura spreads from
   * it, twice; done when it has gone.
   */
  activation(sourceId: string, state: GameState | null): Promise<void> {
    const where = pileOf(state, sourceId);
    const card = tableCard(this.document, sourceId) ?? (where ? pile(this.document, where.ownerId, where.zone) : null);
    if (!card) return Promise.resolve();
    card.animate(
      [
        { filter: 'none' },
        { filter: 'brightness(1.35) drop-shadow(0 0 16px #fff) drop-shadow(0 0 6px #fff)', offset: 0.3 },
        { filter: 'brightness(1.15) drop-shadow(0 0 12px #fff)', offset: 0.7 },
        { filter: 'none' },
      ],
      { duration: TIMING.badge, easing: 'ease-out' },
    );
    return this.draw.aura(card);
  }

  /**
   * A field card exhausted before its update says so: its place widens (its neighbors make room), then it turns into
   * it (sim-card's own classes, which the update then keeps).
   */
  private exhaust(card: HTMLElement): void {
    card.closest('eras-sim-card')?.classList.add('tapped-field');
    card.classList.add('tapped');
  }

  /** Where each field card is drawn now. */
  private measure(state: GameState): Map<string, Drawn> {
    const rects = new Map<string, Drawn>();
    for (const c of Object.values(state.players ?? {}).flatMap((p) => p.field)) {
      const card = fieldCard(this.document, c.instanceId);
      if (!card) continue;
      rects.set(c.instanceId, {
        ...centerOf(card),
        width: card.offsetWidth,
        height: card.offsetHeight,
        // As drawn: a card exhausted with its declaration is turned before its update says so
        tapped: c.tapped || card.classList.contains('tapped'),
        imageUrl: c.imageUrl,
        rival: !!card.closest('eras-player-half.opponent'),
      });
    }
    return rects;
  }
}
