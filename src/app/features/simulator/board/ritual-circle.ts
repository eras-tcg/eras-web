import { BoardAnimations } from './board-animations';
import { centerOf } from './board-dom';
import { SVG } from './fx-draw';
import { overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';

/**
 * A summon by ritual (lying on the table as the card does, turned as it is): a circle of runes opens around where the
 * card lands, turning, and fades; a gleam sweeps across the card; motes of light rise from it and drift off. In the
 * effects' color. Done when it has gone.
 */
export function runeCircle(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const over = overlayFor(document, card, LAYER.fx);
  const c = centerOf(card);
  const at = over.at(c.x, c.y);
  const r = card.getBoundingClientRect();
  const w = card.offsetWidth || r.width;
  const h = card.offsetHeight || r.height;
  const turn = card.classList.contains('tapped') ? ' rotate(90deg)' : '';
  const d = TIMING.ritual;
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
  animations.hold(d);

  // The circle of runes: two rings, the outer one notched with runes, a six-pointed star inside; it opens out turning
  const size = Math.max(w, h) * 1.45;
  const sigil = document.createElementNS(SVG, 'svg');
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
  const shine = document.createElement('div');
  place(shine, w, h);
  Object.assign(shine.style, { overflow: 'hidden', borderRadius: 'var(--radius-card)', transform: turn.trim() || 'none' });
  const band = document.createElement('div');
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
    const mote = document.createElement('div');
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
