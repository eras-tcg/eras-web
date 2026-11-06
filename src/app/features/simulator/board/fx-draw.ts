import { BoardAnimations } from './board-animations';
import { centerOf } from './board-dom';
import { overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';

export const SVG = 'http://www.w3.org/2000/svg';

/**
 * What the board's effects draw over the table, lying on it when it leans ("Mesa en perspectiva"): curved arrows,
 * signs over a card, an aura spreading from a card, text rising and fading, a pile shaking. Each one removes itself.
 */
export class FxDraw {
  /** The screen's layer for the arrows of a flat table. */
  private readonly layer: SVGSVGElement;

  constructor(
    private readonly document: Document,
    private readonly animations: BoardAnimations,
  ) {
    this.layer = document.createElementNS(SVG, 'svg');
    Object.assign(this.layer.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: LAYER.fx, pointerEvents: 'none', overflow: 'visible' });
    document.body.append(this.layer);
  }

  /** Removes the screen's layer (the board is gone). */
  destroy(): void {
    this.layer.remove();
  }

  /** A curved arrow that draws itself from `from` to `to` (points of the screen), holds and fades. */
  arrow(fromScreen: { x: number; y: number }, toScreen: { x: number; y: number }, color: string, width: number): void {
    // "Mesa en perspectiva": drawn on the leaning table, between the points of the plane under each end
    const over = overlayFor(this.document, null, LAYER.fx, true);
    let svg: SVGSVGElement = this.layer;
    if (over.position === 'absolute') {
      svg = this.document.createElementNS(SVG, 'svg');
      Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' });
      over.host.append(svg);
    }
    const from = over.at(fromScreen.x, fromScreen.y);
    const to = over.at(toScreen.x, toScreen.y);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    // Bent to one side, as thrown
    const cx = (from.x + to.x) / 2 - dy * 0.18;
    const cy = (from.y + to.y) / 2 + dx * 0.18;
    const group = this.document.createElementNS(SVG, 'g');
    group.style.filter = `drop-shadow(0 0 6px ${color})`;
    const path = this.document.createElementNS(SVG, 'path');
    path.setAttribute('d', `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
    Object.assign(path.style, { fill: 'none', stroke: color, strokeWidth: `${width}`, strokeLinecap: 'round' });
    const pathLength = path.getTotalLength?.() || length;
    path.style.strokeDasharray = `${pathLength}`;
    // The head, along the curve's last stretch
    const angle = Math.atan2(to.y - cy, to.x - cx);
    const size = width * 3.2;
    const head = this.document.createElementNS(SVG, 'polygon');
    const p = (a: number, r: number) => `${to.x + Math.cos(a) * r},${to.y + Math.sin(a) * r}`;
    head.setAttribute('points', `${to.x},${to.y} ${p(angle + Math.PI - 0.45, size)} ${p(angle + Math.PI + 0.45, size)}`);
    head.style.fill = color;
    group.append(path, head);
    svg.append(group);
    this.animations.hold(TIMING.arrow);
    path.animate([{ strokeDashoffset: pathLength }, { strokeDashoffset: 0 }], { duration: TIMING.arrow * 0.4, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' });
    head.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1, offset: 0.45 }, { opacity: 1 }], { duration: TIMING.arrow * 0.6, fill: 'both' });
    const fade = group.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: TIMING.arrow, fill: 'both' });
    const gone = () => {
      group.remove();
      over.remove();
    };
    fade.onfinish = gone;
    fade.oncancel = gone;
  }

  /**
   * A sign (an SVG drawing, 24×24) over a card: it grows, shines a moment and fades, lying on the table as the card
   * does; done when it has gone.
   */
  badge(card: HTMLElement, paths: string, glow: string): Promise<void> {
    const over = overlayFor(this.document, card, LAYER.fx);
    const c = centerOf(card);
    const at = over.at(c.x, c.y);
    const size = Math.min(card.offsetWidth, card.offsetHeight) * 0.8;
    const svg = this.document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    Object.assign(svg.style, {
      position: over.position,
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: LAYER.fx,
      pointerEvents: 'none',
      overflow: 'visible',
      filter: `drop-shadow(0 0 10px ${glow}) drop-shadow(0 2px 6px rgb(0 0 0 / 60%))`,
    });
    svg.innerHTML = paths;
    over.host.append(svg);
    this.animations.hold(TIMING.badge);
    const animation = svg.animate(
      [
        { opacity: 0, transform: 'scale(0.4)' },
        { opacity: 1, transform: 'scale(1.1)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1)', offset: 0.35 },
        { opacity: 1, transform: 'scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'scale(1.25)' },
      ],
      { duration: TIMING.badge, easing: 'ease-out' },
    );
    return new Promise((done) => {
      const gone = () => {
        svg.remove();
        over.remove();
        done();
      };
      animation.onfinish = gone;
      animation.oncancel = gone;
    });
  }

  /** A white aura spreads from a card, twice (turned as the card is); done when it has gone. */
  aura(card: HTMLElement): Promise<void> {
    const over = overlayFor(this.document, card, LAYER.fx);
    const c = centerOf(card);
    const at = over.at(c.x, c.y);
    const r = card.getBoundingClientRect();
    const width = card.offsetWidth || r.width;
    const height = card.offsetHeight || r.height;
    const turn = card.classList.contains('tapped') ? ' rotate(90deg)' : '';
    const drawn: HTMLElement[] = [];
    const rings = [0, 0.3].map((delay) => {
      const ring = this.document.createElement('div');
      Object.assign(ring.style, {
        position: over.position,
        left: `${at.x - width / 2}px`,
        top: `${at.y - height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: LAYER.fx,
        pointerEvents: 'none',
        borderRadius: '8px',
        border: '3px solid rgb(255 255 255 / 90%)',
        boxShadow: '0 0 18px 6px rgb(255 255 255 / 70%), inset 0 0 14px 2px rgb(255 255 255 / 55%)',
        opacity: '0',
      });
      over.host.append(ring);
      drawn.push(ring);
      return ring.animate(
        [
          { opacity: 0, transform: `scale(0.96)${turn}` },
          { opacity: 1, transform: `scale(1.02)${turn}`, offset: 0.25 },
          { opacity: 0, transform: `scale(1.3)${turn}` },
        ],
        { duration: TIMING.badge * 0.7, delay: TIMING.badge * delay, easing: 'ease-out' },
      ).finished;
    });
    this.animations.hold(TIMING.badge);
    return Promise.all(rings)
      .catch(() => undefined)
      .then(() => {
        drawn.forEach((ring) => ring.remove());
        over.remove();
      });
  }

  /** Text that rises from a point of the screen and fades. */
  float(x: number, y: number, text: string, color: string): void {
    const el = this.document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: LAYER.float,
      color,
      font: '700 1.6rem/1 var(--font-family-display)',
      textShadow: '0 0 2px #000, 0 2px 8px rgb(0 0 0 / 80%)',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      whiteSpace: 'nowrap',
    });
    this.document.body.append(el);
    const animation = el.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' },
        { opacity: 1, transform: 'translate(-50%, -90%) scale(1.15)', offset: 0.2 },
        { opacity: 1, transform: 'translate(-50%, -140%) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -190%) scale(1)' },
      ],
      { duration: TIMING.float, easing: 'ease-out' },
    );
    animation.onfinish = () => el.remove();
    animation.oncancel = () => el.remove();
  }

  /** An element shakes (a deck shuffled). */
  shake(el: HTMLElement | null): void {
    el?.animate(
      [0, -6, 6, -5, 5, -3, 3, 0].map((x, i) => ({ transform: `translateX(${x}px) rotate(${i % 2 ? 2 : -2}deg)` })),
      { duration: TIMING.shuffle, easing: 'ease-in-out' },
    );
  }
}
