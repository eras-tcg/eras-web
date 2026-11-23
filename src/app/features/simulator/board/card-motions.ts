import { BoardAnimations } from './board-animations';
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
   * A destroyed card breaks where it lies, and stays there: struck at a point, a white flash and a shock wave burst
   * from it; the card splits into pieces along glowing cracks, pushed apart over a red-hot glow; sparks and splinters of
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
    const place = (el: HTMLElement, x: number, y: number, ew: number, eh: number) =>
      Object.assign(el.style, {
        position: lying ? 'absolute' : 'fixed',
        left: `${x - ew / 2}px`,
        top: `${y - eh / 2}px`,
        width: `${ew}px`,
        height: `${eh}px`,
        zIndex: LAYER.shatter,
        pointerEvents: 'none',
      });
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

    // The blow: a white flash, a jolt, the card glowing red; then it settles back as it was
    box.animate(
      [
        { transform: `${turn} scale(1)`, filter: 'none' },
        { transform: `${turn} scale(1.06)`, filter: 'brightness(2.6) saturate(0.6)', offset: 0.08 },
        { transform: `${turn} translate(-3px, 1px) scale(1.02)`, filter: 'brightness(1.4) drop-shadow(0 0 18px #e0242f)', offset: 0.2 },
        { transform: `${turn} translate(3px, -1px)`, filter: 'brightness(1.2) drop-shadow(0 0 24px #e0242f)', offset: 0.32 },
        { transform: `${turn} translate(-1px, 0)`, filter: 'brightness(1.05) drop-shadow(0 0 16px #e0242f)', offset: 0.5 },
        { transform: turn || 'none', filter: 'drop-shadow(0 0 6px #e0242f)', offset: 0.8 },
        { transform: turn || 'none', filter: 'none' },
      ],
      { duration: d, easing: 'ease-out', fill: 'forwards' },
    );
    glow.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], { duration: d, fill: 'forwards' });
    burn.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.35, offset: 0.45 }, { opacity: 0 }], { duration: d, fill: 'forwards' });
    // The pieces pushed apart along the cracks (a little turned), then closing back up
    for (const { el, piece } of pieces) {
      const push = 2.2 + (Math.abs(piece.push.x) + Math.abs(piece.push.y)) * 0.8;
      const tx = (piece.push.x * push * w) / CARD_W;
      const ty = (piece.push.y * push * h) / CARD_H;
      const rot = (piece.push.x * piece.push.y > 0 ? 1 : -1) * 1.6;
      el.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`, offset: 0.22, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
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
    for (let i = 0; i < 22; i++) {
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
   * A summoned card lands: a ring of light opens from it and a glow fades on it (blue yours, red the rival's).
   * `landing`: where the card lies once landed (not where it travels from).
   */
  burst(card: HTMLElement, landing: DOMRect, mine: boolean, delay: number): void {
    if (this.animations.still()) return;
    this.run(() => this.burstNow(card, landing, mine, delay));
  }

  private burstNow(card: HTMLElement, rect: DOMRect, mine: boolean, delay: number): void {
    const color = mine ? 'var(--color-sim-link-mine)' : 'var(--color-sim-link-rival)';
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // On the leaning table the ring lies on it, around the card at its own size
    const lying = this.onPlane({ ...center, width: 0, height: 0, tapped: false, imageUrl: null, plane: this.measure.onTable(card) });
    const size = lying ? Math.max(card.offsetWidth, card.offsetHeight) * 1.6 : Math.max(rect.width, rect.height) * 1.6;
    const at = lying?.at ?? center;
    const ring = this.document.createElement('div');
    Object.assign(ring.style, {
      position: lying ? 'absolute' : 'fixed',
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: `3px solid ${color}`,
      boxShadow: `0 0 24px 6px ${color}, inset 0 0 24px 4px ${color}`,
      zIndex: LAYER.flight,
      pointerEvents: 'none',
      opacity: '0',
    });
    (lying?.layer ?? this.document.body).append(ring);
    this.animations.hold(delay + TIMING.burst);
    const animation = ring.animate(
      [
        { opacity: 0.95, transform: 'scale(0.35)' },
        { opacity: 0, transform: 'scale(1.15)' },
      ],
      { duration: TIMING.burst, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    );
    const gone = () => (lying?.layer ?? ring).remove();
    animation.onfinish = gone;
    animation.oncancel = gone;
    card.animate(
      [
        { boxShadow: `0 0 0 3px #fff, 0 0 40px 14px ${color}` },
        { boxShadow: '0 0 0 0 transparent, 0 0 0 0 transparent' },
      ],
      { duration: TIMING.burst, delay, easing: 'ease-out' },
    );
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
