import { pileOf } from '@data/simulator/game-rules';
import { GameState } from '@data/simulator/simulator.model';
import { BoardAnimations } from './board-animations';
import { centerOf, fieldCard, fieldPlace, fieldSprite, liftPlace, pile, tableCard } from './board-dom';
import { quake, quakesWithTable } from './board-quake';
import { FxDraw } from './fx-draw';
import { Overlay, overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';
import { cardFaceStyle } from '@ui/domain/card-face/card-face-style';

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
/** When the attacker's blow lands, as a share of its charge. */
const IMPACT = 0.46;

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
   * The attacker charges: a copy of it rises off its place (its shadow left on the table) and dives, nose first, onto
   * what it hits (`targetId`, or the lives of
   * `attackerOwner`'s rival) and comes back; the real card's sprite waits hidden (its place, with its share of an Enlace
   * band and its link mark, stays as it is). At the blow it stops dead a moment, a shock wave opens there and the table
   * jolts; the target's sprite is knocked back with a red flash, over its neighbours.
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
    const place = fieldPlace(this.document, attackerId);
    const real = fieldSprite(this.document, attackerId);
    const over = overlayFor(this.document, place, LAYER.charge, !place);
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
      boxShadow: '0 2px 6px rgb(0 0 0 / 40%)',
      ...cardFaceStyle(seen.imageUrl),
    });
    // Its shadow on the table under it: it stays on the table as the card rises, farther and softer the higher it is
    const shade = this.document.createElement('div');
    Object.assign(shade.style, {
      position: over.position,
      left: copy.style.left,
      top: copy.style.top,
      width: copy.style.width,
      height: copy.style.height,
      zIndex: LAYER.charge,
      pointerEvents: 'none',
      borderRadius: copy.style.borderRadius,
      background: 'rgb(0 0 0 / 70%)',
      opacity: '0',
    });
    if (over.position === 'fixed') [shade, copy].forEach(quakesWithTable);
    over.host.append(shade, copy);
    if (real) real.style.visibility = 'hidden';
    this.animations.hold(TIMING.charge);
    // It rises off the table leaning back, hangs a moment, tips over and dives onto what it attacks faster and faster,
    // nose first; it slaps flat on the blow and stops dead, bounces off and goes back down to its place. `along`: how
    // far along its way (over the table), `up`: how high (0 on the table), `pitch`: its leading edge down (degrees)
    const lift = seen.height * 0.5;
    const length = Math.hypot(dx, dy) || 1;
    const axis = `${(-dy / length).toFixed(3)}, ${(dx / length).toFixed(3)}, 0`;
    // It turns on the table to face what it attacks, so it strikes with its edge, not a corner: its front is its top
    // (its side when exhausted, its top turned round for the rival's), never set upright; the shortest way round
    const front = ((degrees - 90) * Math.PI) / 180;
    const yaw = ((((Math.atan2(dy, dx) - front) * 180) / Math.PI + 540) % 360) - 180;
    const frame = (along: number, up: number, pitch: number, scale: number, aim: number, offset: number | null, easing: string | null, filter: string) => {
      const facing = ` rotate(${(yaw * aim).toFixed(1)}deg)`;
      const card: Keyframe = {
        transform: `perspective(900px) translate(${dx * along}px, ${dy * along - up * lift}px) rotate3d(${axis}, ${pitch}deg)${facing} scale(${scale})${turn}`,
        filter,
      };
      const ground: Keyframe = {
        transform: `translate(${dx * along + up * lift * 0.35}px, ${dy * along + up * lift * 0.3}px)${facing} scale(${scale * (1 - up * 0.12)})${turn}`,
        opacity: 0.55 - up * 0.3,
        filter: `blur(${(3 + up * 14).toFixed(1)}px)`,
      };
      for (const k of [card, ground]) {
        if (offset !== null) k.offset = offset;
        if (easing) k.easing = easing;
      }
      return { card, ground };
    };
    const frames = [
      frame(0, 0, 0, 1, 0, null, 'cubic-bezier(0.25, 0.6, 0.35, 1)', 'none'),
      frame(-0.06, 1, -24, 1.3, 1, 0.26, 'ease-in-out', `drop-shadow(0 0 12px ${RIVAL})`),
      frame(0.02, 1.06, 12, 1.32, 1, 0.34, 'cubic-bezier(0.7, 0, 1, 0.5)', `drop-shadow(0 0 16px ${RIVAL})`),
      frame(1, 0, 30, 1.06, 1, IMPACT, null, `brightness(1.6) drop-shadow(0 0 22px ${RIVAL})`),
      frame(0.98, 0, 0, 1.03, 1, IMPACT + 0.07, 'cubic-bezier(0.2, 0.7, 0.4, 1)', `brightness(1.2) drop-shadow(0 0 18px ${RIVAL})`),
      frame(0.8, 0.25, -8, 1.08, 0.5, 0.66, 'cubic-bezier(0.45, 0, 0.25, 1)', `drop-shadow(0 0 10px ${RIVAL})`),
      frame(0, 0, 0, 1, 0, null, null, 'none'),
    ];
    const animation = copy.animate(
      frames.map((f) => f.card),
      { duration: TIMING.charge },
    );
    shade.animate(
      frames.map((f) => f.ground),
      { duration: TIMING.charge },
    );
    const blow = TIMING.charge * IMPACT;
    // The blow: a shock wave where it lands, and the table jolts (harder on the lives)
    this.shock(over, hit, Math.max(seen.width, seen.height) * 1.6, blow);
    quake(this.document, this.animations, targetId ? 1 : 1.4, blow);
    // What it hits is knocked back the way the blow goes, flashing, and settles (an exhausted blocker stays turned)
    const own = target ? this.document.defaultView?.getComputedStyle(target).transform : null;
    const base = own && own !== 'none' ? `${own} ` : '';
    const kx = (dx / length) * 16;
    const ky = (dy / length) * 16;
    // Over its neighbours while it moves (its place does not move)
    const lowered = targetId && target ? liftPlace(fieldPlace(this.document, targetId)) : null;
    const shake = target?.animate(
      [
        { transform: `${base}translate(0, 0)`, filter: 'none' },
        { transform: `${base}translate(${kx}px, ${ky}px) scale(0.94)`, filter: `brightness(2.2) drop-shadow(0 0 20px ${RIVAL})`, offset: 0.12 },
        { transform: `${base}translate(${-kx * 0.35}px, ${-ky * 0.35}px)`, filter: `brightness(1.4) drop-shadow(0 0 14px ${RIVAL})`, offset: 0.4 },
        { transform: `${base}translate(${kx * 0.15}px, ${ky * 0.15}px)`, filter: `drop-shadow(0 0 8px ${RIVAL})`, offset: 0.65 },
        { transform: `${base}translate(0, 0)`, filter: 'none' },
      ],
      { duration: TIMING.charge * 0.5, delay: blow, easing: 'ease-out' },
    );
    if (shake && lowered) {
      shake.onfinish = lowered;
      shake.oncancel = lowered;
    } else lowered?.();
    return new Promise((landed) => {
      const done = () => {
        copy.remove();
        shade.remove();
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

  /**
   * A block declared: a white shield rises over the blocker, which turns sideways when it is exhausted to block (`tap`)
   * and braces, setting itself down hard.
   */
  block(blockerId: string, tap: boolean): Promise<void> {
    const card = fieldCard(this.document, blockerId);
    if (!card) return Promise.resolve();
    if (tap) this.exhaust(card);
    // It braces as the shield goes up: it rises a little and sets itself down hard (once turned), and the table feels it
    const brace = TIMING.badge * 0.4;
    const down = Math.max(tap ? TIMING.tap : 0, brace * 0.7);
    card.animate(
      [
        { scale: '1', filter: 'none' },
        { scale: '1.08', filter: 'brightness(1.25) drop-shadow(0 0 12px #fff)', offset: 0.45, easing: 'cubic-bezier(0.7, 0, 1, 0.6)' },
        { scale: '0.96', filter: 'brightness(1.1) drop-shadow(0 0 8px #fff)', offset: 0.7 },
        { scale: '1', filter: 'none' },
      ],
      { duration: brace, delay: down - brace * 0.7 },
    );
    quake(this.document, this.animations, 0.35, down);
    return this.draw.badge(card, SHIELD, '#fff');
  }

  /**
   * An effect activated: its card (on the table, in a hand or on its pile) glows white and a blue mist with motes of
   * light spreads under it (FxDraw.mist); done when it has gone.
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
      { duration: TIMING.activation, easing: 'ease-out' },
    );
    return this.draw.mist(card);
  }

  /** A shock wave opens from where a blow lands (`at`, in `over`'s pixels) after `delay`, and fades. */
  private shock(over: Overlay, at: { x: number; y: number }, size: number, delay: number): void {
    const ring = this.document.createElement('div');
    Object.assign(ring.style, {
      position: over.position,
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: LAYER.charge,
      pointerEvents: 'none',
      borderRadius: '50%',
      border: '3px solid rgb(255 236 220 / 95%)',
      boxShadow: `0 0 24px 6px ${RIVAL}, inset 0 0 20px 4px ${RIVAL}`,
      opacity: '0',
    });
    if (over.position === 'fixed') quakesWithTable(ring);
    over.host.append(ring);
    const wave = ring.animate(
      [
        { opacity: 1, transform: 'scale(0.1)', borderWidth: '8px' },
        { opacity: 0, transform: 'scale(1)', borderWidth: '1px' },
      ],
      { duration: TIMING.charge * 0.45, delay, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' },
    );
    wave.onfinish = () => ring.remove();
    wave.oncancel = () => ring.remove();
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
