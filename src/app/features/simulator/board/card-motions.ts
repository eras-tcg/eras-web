import { BoardAnimations } from './board-animations';
import { quake, quakesWithTable } from './board-quake';
import { Seen, TableMeasure } from './card-seen';
import { TablePlane, tablePlane } from './table-plane';
import { LAYER, TIMING } from './timing';
import { cardFaceStyle } from '@ui/domain/card-face/card-face-style';
import { CARD_H, CARD_W, Point, seeded, shatterShape } from './shatter-shape';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * The cards' own motions on the table: a destroyed card breaking where it lies (a copy, over the table) and the burst
 * of light where a summoned card lands. A field card going to its new line or summoned flies as a copy (CardFlyer).
 */
export class CardMotions {
  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
    private readonly measure: TableMeasure,
    /** Runs an animation now, or once what plays ends. */
    private readonly run: (fn: () => void) => void,
  ) {}

  /** Broken cards still on show, by instance id: each one's removal (it gives way to its flight to its zone). */
  private readonly broken = new Map<string, () => void>();

  /**
   * A destroyed card breaks where it lies, and stays there: struck at a point, a white flash holds a moment, the table
   * jolts and a shock wave bursts from it; the card splits into pieces along glowing cracks, pushed apart over a red-hot glow; sparks and splinters of
   * it fly off and fall; then the pieces close back up, the cracks and the burn die down, and the card waits, whole, for
   * its flight to its zone, which takes over from it (release). It never vanishes first. `id`: the card's instance id
   * (the same card always breaks the same way).
   */
  shatter(from: Seen, id: string): void {
    this.release(id);
    const lying = this.onPlane(from);
    const at = lying?.at ?? from;
    const layer = lying?.layer ?? this.document.body;
    const shape = shatterShape(id);
    const d = TIMING.shatter;
    const w = from.width;
    const h = from.height;
    const turnDeg = (from.tapped ? 90 : 0) + (from.rival ? 180 : 0);
    const turn = turnDeg ? `rotate(${turnDeg}deg)` : '';
    const face = cardFaceStyle(from.imageUrl);
    const pct = (p: Point) => `${((p.x / CARD_W) * 100).toFixed(2)}% ${((p.y / CARD_H) * 100).toFixed(2)}%`;
    const place = (el: HTMLElement, x: number, y: number, ew: number, eh: number) => {
      Object.assign(el.style, {
        position: lying ? 'absolute' : 'fixed',
        left: `${x - ew / 2}px`,
        top: `${y - eh / 2}px`,
        width: `${ew}px`,
        height: `${eh}px`,
        zIndex: LAYER.shatter,
        pointerEvents: 'none',
      });
      // Flat on the screen, it jolts with the table (on the leaning table, its layer does)
      if (!lying) quakesWithTable(el);
    };
    // The point struck, on the screen (the card may lie turned)
    const r = (turnDeg * Math.PI) / 180;
    const ox = (shape.impact.x / CARD_W - 0.5) * w;
    const oy = (shape.impact.y / CARD_H - 0.5) * h;
    const hit = { x: at.x + ox * Math.cos(r) - oy * Math.sin(r), y: at.y + ox * Math.sin(r) + oy * Math.cos(r) };
    const made: HTMLElement[] = [];

    // The card: its pieces over a red-hot glow, cracks and a burn over them
    const box = this.document.createElement('div');
    place(box, at.x, at.y, w, h);
    Object.assign(box.style, { transform: turn, borderRadius: face.borderRadius ?? '', overflow: 'hidden' });
    const glow = this.document.createElement('div');
    Object.assign(glow.style, {
      position: 'absolute',
      inset: '0',
      background: `radial-gradient(circle at ${pct(shape.impact)}, #fff6d0 0%, #ff9a3c 18%, #e0242f 45%, #2a0306 100%)`,
      opacity: '0',
    });
    box.append(glow);
    const pieces = shape.pieces.map((piece) => {
      const el = this.document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        inset: '0',
        background: face.background ?? '',
        clipPath: `polygon(${piece.outline.map(pct).join(', ')})`,
        willChange: 'transform',
      });
      box.append(el);
      return { el, piece };
    });
    const burn = this.document.createElement('div');
    Object.assign(burn.style, {
      position: 'absolute',
      inset: '0',
      background: `radial-gradient(circle at ${pct(shape.impact)}, rgb(255 240 200 / 90%) 0%, rgb(255 80 40 / 55%) 22%, rgb(60 0 0 / 0%) 60%)`,
      mixBlendMode: 'screen',
      opacity: '0',
    });
    box.append(burn);
    const cracks = this.document.createElementNS(SVG, 'svg');
    cracks.setAttribute('viewBox', `0 0 ${CARD_W} ${CARD_H}`);
    Object.assign(cracks.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' });
    const line = (pts: Point[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ');
    cracks.innerHTML = shape.cracks
      .map(
        (c, i) =>
          `<g data-i="${i}"><path pathLength="1" d="${line(c)}" stroke="#ff3b2f" stroke-width="${i % 2 ? 1.6 : 2.6}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1" opacity="0.85" style="filter: blur(0.8px)"/>` +
          `<path pathLength="1" d="${line(c)}" stroke="#fff8e8" stroke-width="${i % 2 ? 0.5 : 0.9}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/></g>`,
      )
      .join('');
    box.append(cracks);
    layer.append(box);
    made.push(box);
    this.animations.hold(d);

    // The blow: a blinding flash that holds a moment, a hard jolt with the table, the card glowing red; then it settles
    quake(this.document, this.animations, 1, d * 0.04);
    box.animate(
      [
        { transform: `${turn} scale(1)`, filter: 'none' },
        { transform: `${turn} scale(1.1)`, filter: 'brightness(3) saturate(0.5)', offset: 0.05 },
        { transform: `${turn} scale(1.09)`, filter: 'brightness(2.6) saturate(0.6)', offset: 0.12 },
        { transform: `${turn} translate(-5px, 2px) scale(1.02)`, filter: 'brightness(1.5) drop-shadow(0 0 22px #e0242f)', offset: 0.22 },
        { transform: `${turn} translate(4px, -2px)`, filter: 'brightness(1.25) drop-shadow(0 0 26px #e0242f)', offset: 0.34 },
        { transform: `${turn} translate(-2px, 1px)`, filter: 'brightness(1.05) drop-shadow(0 0 18px #e0242f)', offset: 0.5 },
        { transform: turn || 'none', filter: 'drop-shadow(0 0 6px #e0242f)', offset: 0.8 },
        { transform: turn || 'none', filter: 'none' },
      ],
      { duration: d, easing: 'ease-out', fill: 'forwards' },
    );
    glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], { duration: d, fill: 'forwards' });
    burn.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.35, offset: 0.45 }, { opacity: 0 }], { duration: d, fill: 'forwards' });
    // The pieces pushed apart along the cracks (a little turned), then closing back up
    for (const { el, piece } of pieces) {
      const push = 3 + (Math.abs(piece.push.x) + Math.abs(piece.push.y)) * 1.1;
      const tx = (piece.push.x * push * w) / CARD_W;
      const ty = (piece.push.y * push * h) / CARD_H;
      const rot = (piece.push.x * piece.push.y > 0 ? 1 : -1) * 1.6;
      el.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: 'translate(0, 0) rotate(0deg)', offset: 0.1, easing: 'cubic-bezier(0.1, 0.9, 0.3, 1)' },
          { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`, offset: 0.26, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
          { transform: `translate(${tx * 0.8}px, ${ty * 0.8}px) rotate(${rot * 0.8}deg)`, offset: 0.5, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
          { transform: 'translate(0, 0) rotate(0deg)' },
        ],
        { duration: d, fill: 'forwards' },
      );
    }
    // The cracks run out from the impact one after another, glow, and die down to nothing
    cracks.querySelectorAll('g').forEach((g, i) => {
      const delay = d * 0.05 + (i % 2 ? d * 0.12 : 0) + (Math.floor(i / 2) % 3) * d * 0.02;
      g.querySelectorAll('path').forEach((path) =>
        path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d * 0.25, delay, easing: 'ease-out', fill: 'forwards' }),
      );
    });
    cracks.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: d * 1.05, easing: 'ease-in', fill: 'forwards' });

    // A shock wave from the point struck
    const ringSize = Math.max(w, h) * 1.5;
    const ring = this.document.createElement('div');
    place(ring, hit.x, hit.y, ringSize, ringSize);
    Object.assign(ring.style, {
      borderRadius: '50%',
      border: '2px solid rgb(255 220 180 / 90%)',
      boxShadow: '0 0 18px 4px #e0242f, inset 0 0 18px 2px #ff9a3c',
      opacity: '0',
    });
    layer.append(ring);
    made.push(ring);
    ring.animate(
      [
        { opacity: 1, transform: 'scale(0.08)', borderWidth: '6px' },
        { opacity: 0, transform: 'scale(1)', borderWidth: '1px' },
      ],
      { duration: d * 0.55, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'forwards' },
    );

    // Sparks: glowing points thrown out from the impact, falling as they fade
    const rnd = seeded(id + ':sparks');
    for (let i = 0; i < 30; i++) {
      const spark = this.document.createElement('div');
      const size = 2 + rnd() * 3;
      place(spark, hit.x, hit.y, size, size);
      const hue = rnd();
      Object.assign(spark.style, {
        borderRadius: '50%',
        background: hue < 0.35 ? '#fff6d0' : hue < 0.7 ? '#ffb347' : '#ff4b2b',
        boxShadow: `0 0 ${4 + size}px ${hue < 0.35 ? '#ffd27a' : '#ff4b2b'}`,
        opacity: '0',
      });
      layer.append(spark);
      made.push(spark);
      const a = rnd() * Math.PI * 2;
      const v = w * (0.6 + rnd() * 1.1);
      const fall = h * (0.25 + rnd() * 0.35);
      const pt = (t: number) => `translate(${(Math.cos(a) * v * t).toFixed(1)}px, ${(Math.sin(a) * v * t + fall * t * t).toFixed(1)}px)`;
      spark.animate(
        [
          { opacity: 1, transform: pt(0) },
          { opacity: 1, transform: pt(0.35), offset: 0.3 },
          { opacity: 0.8, transform: pt(0.7), offset: 0.65 },
          { opacity: 0, transform: `${pt(1)} scale(0.3)` },
        ],
        { duration: d * (0.7 + rnd() * 0.5), delay: d * 0.06 + rnd() * d * 0.1, easing: 'linear', fill: 'forwards' },
      );
    }
    // Splinters of the card itself (its picture), spinning off and falling
    for (let i = 0; i < 9; i++) {
      const size = w * (0.09 + rnd() * 0.08);
      const bit = this.document.createElement('div');
      place(bit, hit.x, hit.y, size, size * 1.2);
      Object.assign(bit.style, {
        background: face.background ?? '',
        backgroundSize: `${w}px ${h}px`,
        backgroundPosition: `${-(shape.impact.x / CARD_W) * w + size / 2}px ${-(shape.impact.y / CARD_H) * h + size * 0.6}px`,
        clipPath: rnd() < 0.5 ? 'polygon(50% 0, 100% 70%, 20% 100%)' : 'polygon(0 10%, 100% 0, 70% 100%)',
        filter: 'drop-shadow(0 0 3px #e0242f)',
        opacity: '0',
      });
      layer.append(bit);
      made.push(bit);
      const a = rnd() * Math.PI * 2;
      const v = w * (0.5 + rnd() * 0.7);
      const fall = h * (0.4 + rnd() * 0.4);
      const spin = (rnd() < 0.5 ? -1 : 1) * (180 + rnd() * 360);
      bit.animate(
        [
          { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
          { opacity: 1, transform: `translate(${Math.cos(a) * v * 0.5}px, ${Math.sin(a) * v * 0.5 + fall * 0.15}px) rotate(${spin * 0.5}deg) scale(0.9)`, offset: 0.45 },
          { opacity: 0, transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v + fall}px) rotate(${spin}deg) scale(0.6)` },
        ],
        { duration: d * (0.9 + rnd() * 0.4), delay: d * 0.08, easing: 'cubic-bezier(0.25, 0.6, 0.5, 1)', fill: 'forwards' },
      );
    }

    const gone = () => {
      clearTimeout(timer);
      this.broken.delete(id);
      made.forEach((el) => el.remove());
      if (lying && !lying.layer.childElementCount) lying.layer.remove();
    };
    // Should no flight come for it (the update brought something else), it goes after a while
    const timer = setTimeout(gone, d + TIMING.beforeSettle + 2000);
    this.broken.set(id, gone);
  }

  /** The broken card gives way to its flight (or to the table as it is now): removed. */
  release(id: string): void {
    this.broken.get(id)?.();
  }

  /** Every broken card on show goes (a jump through time). */
  releaseAll(): void {
    [...this.broken.values()].forEach((gone) => gone());
  }

  /**
   * A summoned card lands: it presses into the table, which jolts; frames of light its shape open from it, sparks, chips and dust thrown out from its edges, and the cards around it hop and a glow fades on it
   * (blue yours, red the rival's).
   * `landing`: where the card lies once landed (not where it travels from).
   */
  burst(card: HTMLElement, landing: DOMRect, mine: boolean, delay: number): void {
    if (this.animations.still()) return;
    this.run(() => this.burstNow(card, landing, mine, delay));
  }

  private burstNow(card: HTMLElement, rect: DOMRect, mine: boolean, delay: number): void {
    const color = mine ? 'var(--color-sim-link-mine)' : 'var(--color-sim-link-rival)';
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // On the leaning table the frame lies on it, around the card at its own size
    const lying = this.onPlane({ ...center, width: 0, height: 0, tapped: false, imageUrl: null, plane: this.measure.onTable(card) });
    const w = lying ? card.offsetWidth : rect.width;
    const h = lying ? card.offsetHeight : rect.height;
    const at = lying?.at ?? center;
    // A frame of light the card's shape, opening out from its edges
    const ring = this.document.createElement('div');
    Object.assign(ring.style, {
      position: lying ? 'absolute' : 'fixed',
      left: `${at.x - w / 2}px`,
      top: `${at.y - h / 2}px`,
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: cardFaceStyle(null).borderRadius ?? '6px',
      border: `3px solid ${color}`,
      boxShadow: `0 0 24px 6px ${color}, inset 0 0 18px 3px ${color}`,
      zIndex: LAYER.flight,
      pointerEvents: 'none',
      opacity: '0',
    });
    if (!lying) quakesWithTable(ring);
    // A white frame, quicker and closer, over the colored one
    const flash = ring.cloneNode() as HTMLElement;
    Object.assign(flash.style, { border: '4px solid #fff', boxShadow: `0 0 18px 4px #fff, 0 0 30px 8px ${color}` });
    const host = lying?.layer ?? this.document.body;
    host.append(ring, flash);
    this.animations.hold(delay + TIMING.burst);
    const animation = ring.animate(
      [
        { opacity: 1, transform: 'scale(1)', borderWidth: '7px' },
        { opacity: 0, transform: 'scale(1.45)', borderWidth: '1px' },
      ],
      { duration: TIMING.burst, delay, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' },
    );
    flash.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(1.18)' },
      ],
      { duration: TIMING.burst * 0.45, delay, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
    );
    const gone = () => {
      flash.remove();
      (lying?.layer ?? ring).remove();
    };
    animation.onfinish = gone;
    animation.oncancel = gone;
    // It lands with its weight: pressed into the table a moment and back, glowing; the table jolts
    card.animate(
      [
        { scale: '1.04', boxShadow: `0 0 0 3px #fff, 0 0 48px 18px ${color}` },
        { scale: '0.96', offset: 0.12 },
        { scale: '1.01', offset: 0.3 },
        { scale: '1', boxShadow: '0 0 0 0 transparent, 0 0 0 0 transparent' },
      ],
      { duration: TIMING.burst, delay, easing: 'ease-out' },
    );
    quake(this.document, this.animations, 0.6, delay);
    this.debris(host, at, w, h, color, delay, !lying);
    this.hop(card, center, Math.max(rect.width, rect.height), delay);
  }

  /**
   * The table struck by a card landing (`card`, its center on the screen `at`, `size` its length there): the field cards
   * around it hop off the table and drop back, the nearest first and highest, as the blow spreads.
   */
  private hop(card: HTMLElement, at: { x: number; y: number }, size: number, delay: number): void {
    const reach = size * 3.2;
    for (const other of this.document.querySelectorAll<HTMLElement>('[data-instance-id] > eras-sim-card eras-game-card')) {
      if (other === card) continue;
      const r = other.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - at.x, r.top + r.height / 2 - at.y);
      const up = 12 * (1 - d / reach);
      if (up < 1.5) continue;
      other.animate(
        [
          { translate: '0 0', scale: '1', easing: 'cubic-bezier(0.15, 0.8, 0.4, 1)' },
          { translate: `0 ${-up}px`, scale: `${1 + up * 0.004}`, offset: 0.35, easing: 'cubic-bezier(0.6, 0, 1, 0.6)' },
          { translate: `0 ${up * 0.12}px`, scale: '1', offset: 0.72 },
          { translate: '0 0', scale: '1' },
        ],
        // It reaches them as it spreads: a little later the farther they are
        { duration: TIMING.hop, delay: delay + d * 0.25 },
      );
    }
  }

  /**
   * The impact of a card landing (centered at `at`, `w`×`h`, in `host`'s pixels): sparks and chips thrown out from its
   * edges along the table, and dust puffing out low around it; each one removes itself.
   */
  private debris(host: HTMLElement, at: { x: number; y: number }, w: number, h: number, color: string, delay: number, flat: boolean): void {
    const life = TIMING.burst * 0.85;
    const add = (style: Partial<CSSStyleDeclaration>, size: number, frames: Keyframe[], duration: number, wait: number) => {
      const el = this.document.createElement('div');
      Object.assign(el.style, {
        position: flat ? 'fixed' : 'absolute',
        left: `${at.x - size / 2}px`,
        top: `${at.y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: LAYER.flight,
        pointerEvents: 'none',
        opacity: '0',
        ...style,
      });
      if (flat) quakesWithTable(el);
      host.append(el);
      const a = el.animate(frames, { duration, delay: delay + wait, easing: 'cubic-bezier(0.15, 0.7, 0.35, 1)' });
      a.onfinish = () => el.remove();
      a.oncancel = () => el.remove();
    };
    // A point on the card's edge and the way out from it
    const edge = () => {
      const side = Math.random() * 2 * (w + h);
      if (side < w) return { x: side - w / 2, y: -h / 2, nx: 0, ny: -1 };
      if (side < w + h) return { x: w / 2, y: side - w - h / 2, nx: 1, ny: 0 };
      if (side < 2 * w + h) return { x: side - w - h - w / 2, y: h / 2, nx: 0, ny: 1 };
      return { x: -w / 2, y: side - 2 * w - h - h / 2, nx: -1, ny: 0 };
    };
    // Sparks: bright points shot out from the edges, fast, slowing as they fade
    for (let i = 0; i < 26; i++) {
      const e = edge();
      const size = 2 + Math.random() * 3.5;
      const spread = (Math.random() - 0.5) * 1.1;
      const dist = Math.max(w, h) * (0.25 + Math.random() * 0.55);
      const vx = (e.nx + spread * (e.ny ? 1 : 0)) * dist;
      const vy = (e.ny + spread * (e.nx ? 1 : 0)) * dist;
      const white = Math.random() < 0.45;
      add(
        { borderRadius: '50%', background: white ? '#fff' : color, boxShadow: `0 0 ${4 + size}px ${white ? '#fff' : color}` },
        size,
        [
          { opacity: 1, transform: `translate(${e.x}px, ${e.y}px) scale(1)` },
          { opacity: 0.9, transform: `translate(${e.x + vx * 0.7}px, ${e.y + vy * 0.7}px) scale(0.8)`, offset: 0.55 },
          { opacity: 0, transform: `translate(${e.x + vx}px, ${e.y + vy}px) scale(0.3)` },
        ],
        life * (0.55 + Math.random() * 0.45),
        Math.random() * 40,
      );
    }
    // Chips: small shards spinning out
    for (let i = 0; i < 10; i++) {
      const e = edge();
      const size = 3 + Math.random() * 4;
      const dist = Math.max(w, h) * (0.2 + Math.random() * 0.35);
      const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360);
      add(
        { background: 'rgb(255 255 255 / 85%)', clipPath: 'polygon(50% 0, 100% 80%, 0 100%)', filter: `drop-shadow(0 0 3px ${color})` },
        size,
        [
          { opacity: 1, transform: `translate(${e.x}px, ${e.y}px) rotate(0deg)` },
          { opacity: 0, transform: `translate(${e.x + e.nx * dist}px, ${e.y + e.ny * dist}px) rotate(${spin}deg)` },
        ],
        life * (0.6 + Math.random() * 0.4),
        0,
      );
    }
    // Dust: soft puffs rolling out low from the bottom and sides, growing as they thin
    for (let i = 0; i < 8; i++) {
      const e = edge();
      const size = Math.min(w, h) * (0.25 + Math.random() * 0.2);
      const dist = Math.min(w, h) * (0.3 + Math.random() * 0.3);
      add(
        { borderRadius: '50%', background: 'radial-gradient(circle, rgb(220 225 240 / 45%), rgb(220 225 240 / 0%) 70%)' },
        size,
        [
          { opacity: 0.9, transform: `translate(${e.x}px, ${e.y}px) scale(0.4)` },
          { opacity: 0, transform: `translate(${e.x + e.nx * dist}px, ${e.y + e.ny * dist}px) scale(1.6)` },
        ],
        life,
        20,
      );
    }
  }

  /**
   * A layer over the table for an animation at `from`: leaning as the table when it lies on it, with the point in the
   * layer's own pixels; else none (the screen, flat). Remove the layer when done.
   */
  private onPlane(from: Seen): { plane: TablePlane; layer: HTMLElement; at: { x: number; y: number } } | null {
    const plane = from.plane ? tablePlane(this.document) : null;
    if (!plane) return null;
    return { plane, layer: plane.layer(LAYER.flight), at: plane.toLocal(from.x, from.y) };
  }
}
