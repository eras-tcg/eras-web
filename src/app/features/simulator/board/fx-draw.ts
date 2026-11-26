import { BoardAnimations } from './board-animations';
import { centerOf } from './board-dom';
import { overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';

export const SVG = 'http://www.w3.org/2000/svg';

/**
 * What the board's effects draw over the table, lying on it when it leans ("Mesa en perspectiva"): curved arrows,
 * signs over a card, an effect awakening on a card, text rising and fading, a pile shaking. Each one removes itself.
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

  /**
   * An effect awakening on a card (lying on the table as the card does, turned as it is): a circle of runes opens
   * around it, turning, and fades; a gleam sweeps across the card; motes of light rise from it and drift off. In the
   * effects' color. Done when it has gone.
   */
  magic(card: HTMLElement): Promise<void> {
    const over = overlayFor(this.document, card, LAYER.fx);
    const c = centerOf(card);
    const at = over.at(c.x, c.y);
    const r = card.getBoundingClientRect();
    const w = card.offsetWidth || r.width;
    const h = card.offsetHeight || r.height;
    const turn = card.classList.contains('tapped') ? ' rotate(90deg)' : '';
    const d = TIMING.activation;
    const color = 'var(--color-sim-effect)';
    const made: Element[] = [];
    const runs: Promise<unknown>[] = [];
    const place = (el: HTMLElement | SVGElement, ew: number, eh: number) => {
      Object.assign(el.style, {
        position: over.position,
        left: `${at.x - ew / 2}px`,
        top: `${at.y - eh / 2}px`,
        width: `${ew}px`,
        height: `${eh}px`,
        zIndex: LAYER.fx,
        pointerEvents: 'none',
        overflow: 'visible',
      });
      over.host.append(el);
      made.push(el);
    };
    this.animations.hold(d);

    // The circle of runes: two rings, the outer one notched with runes, a six-pointed star inside; it opens out turning
    const size = Math.max(w, h) * 1.45;
    const sigil = this.document.createElementNS(SVG, 'svg');
    sigil.setAttribute('viewBox', '-50 -50 100 100');
    const runes = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * 44;
      const y = Math.sin(a) * 44;
      const deg = (a * 180) / Math.PI + 90;
      // A small mark, one of three shapes, standing on the ring
      const mark = ['M-1.4 -1.6 L0 1.6 L1.4 -1.6', 'M-1.4 0 H1.4 M0 -1.7 V1.7', 'M-1.2 -1.6 V1.6 M-1.2 0 L1.3 -1.6'][i % 3];
      return `<path d="${mark}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(1)})"/>`;
    }).join('');
    const star = (k: number) =>
      Array.from({ length: 3 }, (_, i) => {
        const a = (i / 3) * Math.PI * 2 + (k * Math.PI) / 3 - Math.PI / 2;
        return `${(Math.cos(a) * 34).toFixed(2)},${(Math.sin(a) * 34).toFixed(2)}`;
      }).join(' ');
    sigil.innerHTML =
      `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 2px ${color}) drop-shadow(0 0 5px ${color})">` +
      `<circle r="48" stroke-width="0.9"/><circle r="40" stroke-width="0.6" stroke-dasharray="2 1.5"/>` +
      `<g stroke-width="0.7">${runes}</g>` +
      `<polygon points="${star(0)}" stroke-width="0.6"/><polygon points="${star(1)}" stroke-width="0.6"/>` +
      `<circle r="17" stroke-width="0.5"/></g>`;
    place(sigil, size, size);
    sigil.style.opacity = '0';
    runs.push(
      sigil.animate(
        [
          { opacity: 0, transform: `scale(0.55) rotate(-40deg)` },
          { opacity: 1, transform: `scale(1) rotate(0deg)`, offset: 0.3 },
          { opacity: 0.85, transform: `scale(1.04) rotate(25deg)`, offset: 0.75 },
          { opacity: 0, transform: `scale(1.12) rotate(45deg)` },
        ],
        { duration: d, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      ).finished,
    );

    // The gleam: a band of light sweeping across the card's face, corner to corner
    const shine = this.document.createElement('div');
    place(shine, w, h);
    Object.assign(shine.style, { overflow: 'hidden', borderRadius: 'var(--radius-card)', transform: turn.trim() || 'none' });
    const band = this.document.createElement('div');
    Object.assign(band.style, {
      position: 'absolute',
      inset: '-50%',
      background: `linear-gradient(115deg, transparent 40%, rgb(255 255 255 / 0%) 44%, rgb(255 255 255 / 75%) 50%, color-mix(in srgb, ${color} 60%, transparent) 53%, transparent 60%)`,
      mixBlendMode: 'screen',
    });
    shine.append(band);
    runs.push(
      band.animate([{ transform: 'translate(-45%, -30%)' }, { transform: 'translate(45%, 30%)' }], {
        duration: d * 0.45,
        delay: d * 0.18,
        easing: 'cubic-bezier(0.45, 0, 0.25, 1)',
        fill: 'both',
      }).finished,
    );

    // Motes of light rising from the card, drifting and twinkling out
    for (let i = 0; i < 18; i++) {
      const mote = this.document.createElement('div');
      const s = 2 + Math.random() * 3;
      place(mote, s, s);
      const white = Math.random() < 0.4;
      Object.assign(mote.style, { borderRadius: '50%', background: white ? '#fff' : color, boxShadow: `0 0 ${4 + s * 1.5}px ${white ? '#fff' : color}`, opacity: '0' });
      const x0 = (Math.random() - 0.5) * w;
      const y0 = (Math.random() - 0.2) * h * 0.6;
      const rise = h * (0.45 + Math.random() * 0.5);
      const drift = (Math.random() - 0.5) * w * 0.5;
      runs.push(
        mote.animate(
          [
            { opacity: 0, transform: `translate(${x0}px, ${y0}px) scale(0.4)` },
            { opacity: 1, transform: `translate(${x0 + drift * 0.3}px, ${y0 - rise * 0.3}px) scale(1)`, offset: 0.3 },
            { opacity: 0.7, transform: `translate(${x0 + drift * 0.7}px, ${y0 - rise * 0.7}px) scale(0.9)`, offset: 0.7 },
            { opacity: 0, transform: `translate(${x0 + drift}px, ${y0 - rise}px) scale(0.3)` },
          ],
          { duration: d * (0.55 + Math.random() * 0.35), delay: d * (0.1 + Math.random() * 0.3), easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)', fill: 'backwards' },
        ).finished,
      );
    }

    return Promise.all(runs)
      .catch(() => undefined)
      .then(() => {
        made.forEach((el) => el.remove());
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
