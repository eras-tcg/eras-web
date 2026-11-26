import { BoardAnimations } from './board-animations';
import { centerOf } from './board-dom';
import { overlayFor, tablePlane, underTable } from './table-plane';
import { LAYER, TIMING } from './timing';

export const SVG = 'http://www.w3.org/2000/svg';

/** An effect's mist: its blue (its core and its body), its veil, and its motes of light. */
const MIST_CORE = 'rgb(120 175 255 / 70%)';
const MIST_EDGE = 'rgb(50 110 255 / 45%)';
const MIST_VEIL = 'rgb(170 210 255 / 35%)';
const MOTE = '#7cc4ff';

/**
 * What the board's effects draw over the table, lying on it when it leans ("Mesa en perspectiva"): curved arrows,
 * signs over a card, an effect's mist under a card, text rising and fading, a pile shaking. Each one removes itself.
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
   * An effect activated on a card: a pool of blue mist the card's shape, soft-edged, spreads out under it, swirling; a thin veil of it
   * drifts over the card and motes of light rise from it, over the card; then all of it fades. The pool lies under
   * everything on the table when the card lies on it (over it elsewhere: a hand, a plate). Done when it has gone.
   */
  mist(card: HTMLElement): Promise<void> {
    const c = centerOf(card);
    const r = card.getBoundingClientRect();
    const w = card.offsetWidth || r.width;
    const h = card.offsetHeight || r.height;
    const size = Math.max(w, h) * 1.7;
    const d = TIMING.activation;
    const plane = tablePlane(this.document);
    const lying = plane ? plane.holds(card) : !!card.closest('.plane');
    // Over the card: a box of the same size, lying as the card does
    const over = overlayFor(this.document, card, LAYER.fx);
    const at = over.at(c.x, c.y);
    const top = this.document.createElement('div');
    Object.assign(top.style, {
      position: over.position,
      left: `${at.x - size / 2}px`,
      top: `${at.y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      zIndex: LAYER.fx,
      pointerEvents: 'none',
    });
    over.host.append(top);
    const under = lying ? underTable(this.document, c, size, size) : null;
    const pool = under?.el ?? top;
    this.animations.hold(d);
    const runs: Promise<unknown>[] = [];
    const add = (host: HTMLElement, style: Partial<CSSStyleDeclaration>, frames: Keyframe[], timing: KeyframeAnimationOptions) => {
      const el = this.document.createElement('div');
      Object.assign(el.style, { position: 'absolute', opacity: '0', ...style });
      host.append(el);
      runs.push(el.animate(frames, { fill: 'backwards', ...timing }).finished);
    };
    // The pool: the card's shape a little bigger, its edge soft as mist, swirling inside and spreading out as it fades
    const margin = Math.max(w, h) * 0.13;
    const turned = card.classList.contains('tapped') ? ' rotate(90deg)' : '';
    const frame = this.document.createElement('div');
    Object.assign(frame.style, {
      position: 'absolute',
      left: `${(size - w) / 2 - margin}px`,
      top: `${(size - h) / 2 - margin}px`,
      width: `${w + margin * 2}px`,
      height: `${h + margin * 2}px`,
      borderRadius: `${margin * 0.9}px`,
      overflow: 'hidden',
      background: `radial-gradient(ellipse 75% 75% at 50% 50%, ${MIST_CORE}, ${MIST_EDGE})`,
      boxShadow: `0 0 ${margin}px ${margin * 0.4}px ${MIST_EDGE}`,
      filter: `blur(${(margin * 0.35).toFixed(1)}px)`,
      opacity: '0',
    });
    pool.append(frame);
    runs.push(
      frame.animate(
        [
          { opacity: 0, transform: `scale(0.8)${turned}` },
          { opacity: 0.95, transform: `scale(1)${turned}`, offset: 0.28 },
          { opacity: 0.75, transform: `scale(1.1)${turned}`, offset: 0.72 },
          { opacity: 0, transform: `scale(1.22)${turned}` },
        ],
        { duration: d, easing: 'cubic-bezier(0.25, 0.6, 0.4, 1)', fill: 'backwards' },
      ).finished,
    );
    // Inside it, the mist turns slowly: brighter clouds drifting round
    for (let i = 0; i < 2; i++) {
      const spin = (i ? -1 : 1) * (40 + Math.random() * 30);
      add(
        frame,
        {
          inset: '-30%',
          background: `radial-gradient(ellipse 30% 22% at ${35 + i * 30}% ${40 + i * 20}%, ${MIST_VEIL}, transparent 70%)`,
          mixBlendMode: 'screen',
          opacity: '1',
        },
        [{ transform: 'rotate(0deg)' }, { transform: `rotate(${spin}deg)` }],
        { duration: d, easing: 'linear' },
      );
    }
    // A thin veil of it over the card, drifting across
    add(
      top,
      {
        left: `${(size - w * 1.15) / 2}px`,
        top: `${(size - h * 1.1) / 2}px`,
        width: `${w * 1.15}px`,
        height: `${h * 1.1}px`,
        borderRadius: '45%',
        background: `radial-gradient(ellipse 50% 50% at 50% 55%, ${MIST_VEIL}, transparent 70%)`,
        filter: 'blur(6px)',
        mixBlendMode: 'screen',
      },
      [
        { opacity: 0, transform: `translate(${-w * 0.08}px, ${h * 0.04}px)` },
        { opacity: 1, transform: 'translate(0, 0)', offset: 0.35 },
        { opacity: 0.7, transform: `translate(${w * 0.06}px, ${-h * 0.03}px)`, offset: 0.7 },
        { opacity: 0, transform: `translate(${w * 0.1}px, ${-h * 0.06}px)` },
      ],
      { duration: d, delay: d * 0.08, easing: 'ease-in-out' },
    );
    // Motes of light rising from the card, over it, drifting and twinkling out
    for (let i = 0; i < 18; i++) {
      const s = 2 + Math.random() * 3;
      const x0 = size / 2 + (Math.random() - 0.5) * w * 1.1;
      const y0 = size / 2 + (Math.random() - 0.3) * h * 0.8;
      const rise = h * (0.3 + Math.random() * 0.45);
      const drift = (Math.random() - 0.5) * w * 0.4;
      const white = Math.random() < 0.35;
      add(
        top,
        {
          left: `${x0 - s / 2}px`,
          top: `${y0 - s / 2}px`,
          width: `${s}px`,
          height: `${s}px`,
          borderRadius: '50%',
          background: white ? '#fff' : MOTE,
          boxShadow: `0 0 ${4 + s * 1.5}px ${white ? '#fff' : MOTE}`,
        },
        [
          { opacity: 0, transform: 'translate(0, 0) scale(0.4)' },
          { opacity: 1, transform: `translate(${drift * 0.3}px, ${-rise * 0.3}px) scale(1)`, offset: 0.3 },
          { opacity: 0.6, transform: `translate(${drift * 0.7}px, ${-rise * 0.7}px) scale(0.9)`, offset: 0.7 },
          { opacity: 0, transform: `translate(${drift}px, ${-rise}px) scale(0.3)` },
        ],
        { duration: d * (0.5 + Math.random() * 0.35), delay: d * (0.12 + Math.random() * 0.35), easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
      );
    }
    return Promise.all(runs)
      .catch(() => undefined)
      .then(() => {
        under?.remove();
        top.remove();
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
