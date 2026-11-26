import { BoardAnimations } from './board-animations';
import { centerOf } from './board-dom';
import { flatTurn } from './card-pose';
import { SVG } from './fx-draw';
import { runeCircle } from './ritual-circle';
import { Overlay, overlayFor } from './table-plane';
import { LAYER, TIMING } from './timing';

/** The special summons with an animation of their own (the engine's summonType). */
export type SpecialSummonKind = 'ritual' | 'promotion' | 'materialization' | 'evolution';

export function isSpecialSummonKind(kind: unknown): kind is SpecialSummonKind {
  return kind === 'ritual' || kind === 'promotion' || kind === 'materialization' || kind === 'evolution';
}

/** How long before the card lands each one starts (a materialization gathers its matter first). */
export function specialSummonLead(kind: SpecialSummonKind): number {
  return { ritual: TIMING.ritualLead, promotion: TIMING.promotionLead, materialization: TIMING.materializationLead, evolution: TIMING.evolutionLead }[kind];
}

/** The animation of a special summon on `card` (where it lands); done when it has gone. */
export function specialSummonFx(kind: SpecialSummonKind, document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  switch (kind) {
    case 'ritual':
      return runeCircle(document, animations, card);
    case 'promotion':
      return promotion(document, animations, card);
    case 'materialization':
      return materialization(document, animations, card);
    case 'evolution':
      return evolution(document, animations, card);
  }
}

const GOLD = '#f6c945';
const GOLD_LIGHT = '#fff1b8';
const MATTER = '#5eead4';
const LIFE = '#4ade80';
const LIFE_LIGHT = '#d9ffe6';

/** A card where it lands: its center on the screen and in `over`, its own size, and whether it lies turned a quarter. */
function measure(card: HTMLElement, over: Overlay) {
  const screen = centerOf(card);
  const r = card.getBoundingClientRect();
  const turned = Math.round(flatTurn(card, card.closest('.plane')).turn / 90) % 2 !== 0;
  const w = card.offsetWidth || r.width;
  const h = card.offsetHeight || r.height;
  return { screen, at: over.at(screen.x, screen.y), w: turned ? h : w, h: turned ? w : h, rect: r };
}

/** Adds an element to `host` (absolute, or fixed on the screen), animates it and collects when it ends. */
function adder(document: Document, host: HTMLElement, position: string, runs: Promise<unknown>[]) {
  return (style: Partial<CSSStyleDeclaration>, frames: Keyframe[], timing: KeyframeAnimationOptions, tag = 'div') => {
    const el = tag === 'svg' ? (document.createElementNS(SVG, 'svg') as unknown as HTMLElement) : document.createElement(tag);
    Object.assign(el.style, { position, pointerEvents: 'none', opacity: '0', ...style });
    host.append(el);
    runs.push(el.animate(frames, { fill: 'backwards', ...timing }).finished.catch(() => undefined));
    return el;
  };
}

/**
 * Ascenso, a promotion in rank: a laurel wreath of gold grows round the card as it lies, two branches rising leaf by
 * leaf from its foot to meet over its head; then the wreath flashes, a golden ring of honor opens from it across the
 * table and embers of gold rise. Lying on the table as the card does.
 */
function promotion(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.promotion;
  const over = overlayFor(document, card, LAYER.fx);
  const { at, w, h } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const add = adder(document, over.host, over.position, runs);
  const keep = (el: HTMLElement) => (made.push(el), el);
  animations.hold(d);
  // The wreath: an oval round the card, each branch a stem along one side with leaves set along it, outward and inward
  const rx = w * 0.78;
  const ry = h * 0.66;
  const pad = 24;
  const vw = rx * 2 + pad * 2;
  const vh = ry * 2 + pad * 2;
  const wreath = keep(
    add(
      { left: `${at.x - vw / 2}px`, top: `${at.y - vh / 2}px`, width: `${vw}px`, height: `${vh}px`, zIndex: LAYER.fx, overflow: 'visible', filter: `drop-shadow(0 0 4px ${GOLD}) drop-shadow(0 1px 2px rgb(0 0 0 / 70%))` },
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.62 },
        { opacity: 1, transform: 'scale(1.04)', filter: `brightness(1.8) drop-shadow(0 0 10px ${GOLD})`, offset: 0.7 },
        { opacity: 0, transform: 'scale(1.1)' },
      ],
      { duration: d, easing: 'ease-out' },
      'svg',
    ),
  );
  wreath.setAttribute('viewBox', `${-vw / 2} ${-vh / 2} ${vw} ${vh}`);
  // From the foot (angle 90°, down) up each side to the head (−90°), leaving a gap at both ends
  const leaves = 9;
  const point = (deg: number, k = 1) => ({ x: Math.cos((deg * Math.PI) / 180) * rx * k, y: Math.sin((deg * Math.PI) / 180) * ry * k });
  const branch = (side: 1 | -1) => {
    const from = 90 + side * 18;
    const to = 90 + side * 162;
    const steps = 24;
    const stem = Array.from({ length: steps + 1 }, (_, i) => {
      const q = point(from + ((to - from) * i) / steps);
      return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    }).join(' ');
    const leafs = Array.from({ length: leaves }, (_, i) => {
      const deg = from + ((to - from) * (i + 0.6)) / (leaves + 0.2);
      const q = point(deg);
      // Along the stem, pointing on towards its tip, alternately out and in
      const tangent = deg + side * 90;
      const lean = (i % 2 ? -1 : 1) * 32 * side;
      const len = Math.min(rx, ry) * 0.2;
      return `<ellipse data-leaf="${i}" cx="0" cy="0" rx="${(len * 0.5).toFixed(1)}" ry="${(len * 0.2).toFixed(1)}" transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${(tangent + lean).toFixed(1)}) translate(${(len * 0.45).toFixed(1)} 0)" opacity="0"/>`;
    }).join('');
    return `<g><path d="${stem}" pathLength="1" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/><g fill="${GOLD}" stroke="${GOLD_LIGHT}" stroke-width="0.8">${leafs}</g></g>`;
  };
  wreath.innerHTML = branch(1) + branch(-1);
  wreath.style.opacity = '1';
  const grow = d * 0.45;
  wreath.querySelectorAll<SVGPathElement>('path').forEach((stem) =>
    runs.push(stem.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: grow, easing: 'cubic-bezier(0.3, 0, 0.3, 1)', fill: 'forwards' }).finished.catch(() => undefined)),
  );
  wreath.querySelectorAll<SVGEllipseElement>('ellipse').forEach((leaf) => {
    const i = Number(leaf.dataset['leaf']);
    leaf.style.transformBox = 'fill-box';
    leaf.style.transformOrigin = 'center';
    runs.push(
      leaf
        .animate(
          [
            { opacity: 0, scale: '0.2' },
            { opacity: 1, scale: '1.25', offset: 0.6 },
            { opacity: 1, scale: '1' },
          ],
          { duration: grow * 0.35, delay: grow * (0.1 + (i / leaves) * 0.75), easing: 'ease-out', fill: 'forwards' },
        )
        .finished.catch(() => undefined),
    );
  });
  // The ring of honor: opens from the wreath across the table as it flashes
  const ring = Math.max(rx, ry) * 2;
  keep(
    add(
      {
        left: `${at.x - ring / 2}px`,
        top: `${at.y - ring / 2}px`,
        width: `${ring}px`,
        height: `${ring}px`,
        zIndex: LAYER.fx,
        borderRadius: '50%',
        border: `3px solid ${GOLD_LIGHT}`,
        boxShadow: `0 0 18px 4px ${GOLD}, inset 0 0 14px 2px ${GOLD}`,
      },
      [
        { opacity: 0.9, transform: 'scale(0.75)', borderWidth: '5px' },
        { opacity: 0, transform: 'scale(1.6)', borderWidth: '1px' },
      ],
      { duration: d * 0.4, delay: d * 0.6, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' },
    ),
  );
  // Embers of gold rising off the wreath
  for (let i = 0; i < 18; i++) {
    const s = 2 + Math.random() * 3;
    const q = point(Math.random() * 360);
    const rise = h * (0.4 + Math.random() * 0.5);
    keep(
      add(
        {
          left: `${at.x + q.x - s / 2}px`,
          top: `${at.y + q.y - s / 2}px`,
          width: `${s}px`,
          height: `${s}px`,
          zIndex: LAYER.fx,
          borderRadius: '50%',
          background: Math.random() < 0.4 ? '#fff' : GOLD,
          boxShadow: `0 0 ${4 + s * 1.5}px ${GOLD}`,
        },
        [
          { opacity: 0, transform: 'translateY(0)' },
          { opacity: 1, transform: `translateY(${-rise * 0.3}px)`, offset: 0.3 },
          { opacity: 0, transform: `translateY(${-rise}px)` },
        ],
        { duration: d * (0.35 + Math.random() * 0.25), delay: d * (0.6 + Math.random() * 0.1), easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
      ),
    );
  }
  return Promise.all(runs).then(() => {
    made.forEach((el) => el.remove());
    over.remove();
  });
}

/**
 * Materialización, matter composed into a creature: specks of matter are drawn in from all around to where the card
 * will be, faster as they near it; the card's outline traces itself and fills with matter, glowing, from its foot up as
 * they come in, and it flashes as the card lands into it. Lying on the table as the card does.
 */
function materialization(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.materialization;
  const over = overlayFor(document, card, LAYER.fx);
  const { at, w, h } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const add = adder(document, over.host, over.position, runs);
  const keep = (el: HTMLElement) => (made.push(el), el);
  animations.hold(d);
  // When the card lands, as a share of it (it starts this long before)
  const land = TIMING.materializationLead / d;
  // Specks of matter, from a wide ring around it in to points of the card, faster and faster
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2;
    const far = Math.max(w, h) * (0.9 + Math.random() * 0.8);
    const tx = (Math.random() - 0.5) * w * 0.9;
    const ty = (Math.random() - 0.5) * h * 0.9;
    const sx = Math.cos(a) * far;
    const sy = Math.sin(a) * far;
    const s = 2 + Math.random() * 4;
    const square = Math.random() < 0.6;
    const go = land * (0.55 + Math.random() * 0.4);
    keep(
      add(
        {
          left: `${at.x - s / 2}px`,
          top: `${at.y - s / 2}px`,
          width: `${s}px`,
          height: `${s}px`,
          zIndex: LAYER.fx,
          borderRadius: square ? '1px' : '50%',
          background: Math.random() < 0.35 ? '#fff' : MATTER,
          boxShadow: `0 0 ${3 + s}px ${MATTER}`,
        },
        [
          { opacity: 0, transform: `translate(${sx}px, ${sy}px) rotate(0deg)` },
          { opacity: 1, transform: `translate(${sx * 0.8 + tx * 0.2}px, ${sy * 0.8 + ty * 0.2}px) rotate(90deg)`, offset: 0.25 },
          { opacity: 1, transform: `translate(${tx}px, ${ty}px) rotate(270deg)`, offset: 0.92 },
          { opacity: 0, transform: `translate(${tx}px, ${ty}px) rotate(300deg) scale(0.3)` },
        ],
        { duration: d * go, delay: d * (land - go) * Math.random(), easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
      ),
    );
  }
  // The outline tracing itself and filling with matter from its foot up, as the specks come in
  const frame = keep(
    add(
      { left: `${at.x - w / 2}px`, top: `${at.y - h / 2}px`, width: `${w}px`, height: `${h}px`, zIndex: LAYER.fx, overflow: 'visible' },
      [{ opacity: 1 }, { opacity: 1, offset: Math.min(0.95, land + 0.1) }, { opacity: 0 }],
      { duration: d },
      'svg',
    ),
  );
  frame.setAttribute('viewBox', `0 0 ${w} ${h}`);
  frame.innerHTML = `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(w * 0.04).toFixed(1)}" pathLength="1" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1" stroke-dashoffset="1" style="filter: drop-shadow(0 0 3px ${MATTER}) drop-shadow(0 0 6px ${MATTER})"/>`;
  const outline = frame.firstElementChild as SVGElement;
  runs.push(outline.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d * land * 0.8, delay: d * land * 0.1, easing: 'ease-in-out', fill: 'forwards' }).finished);
  // The matter gathering in it: a glow rising from its foot, brightest at its rising edge
  keep(
    add(
      {
        left: `${at.x - w / 2}px`,
        top: `${at.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: LAYER.fx,
        borderRadius: 'var(--radius-card)',
        background: `linear-gradient(to top, color-mix(in srgb, ${MATTER} 35%, transparent), color-mix(in srgb, ${MATTER} 55%, transparent) 85%, #fff 98%, transparent)`,
        mixBlendMode: 'screen',
      },
      [
        { opacity: 0.9, clipPath: 'inset(100% 0 0 0)' },
        { opacity: 0.9, clipPath: 'inset(0 0 0 0)', offset: 0.85 },
        { opacity: 0, clipPath: 'inset(0 0 0 0)' },
      ],
      { duration: d * land, delay: d * land * 0.25, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
    ),
  );
  // The flash as it lands
  keep(
    add(
      {
        left: `${at.x - w / 2}px`,
        top: `${at.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: LAYER.fx,
        borderRadius: 'var(--radius-card)',
        background: `radial-gradient(ellipse at center, #fff, color-mix(in srgb, ${MATTER} 60%, transparent) 60%, transparent)`,
        mixBlendMode: 'screen',
      },
      [
        { opacity: 0, transform: 'scale(0.9)' },
        { opacity: 1, transform: 'scale(1.02)', offset: 0.2 },
        { opacity: 0, transform: 'scale(1.2)' },
      ],
      { duration: d * 0.35, delay: d * land, easing: 'ease-out' },
    ),
  );
  return Promise.all(runs)
    .catch(() => undefined)
    .then(() => {
      made.forEach((el) => el.remove());
      over.remove();
    });
}

/**
 * Evolución, a creature evolving: two strands of green life coil round the card in a circle, rising off the table as
 * they turn, like a helix, while rings of growth the card's shape pulse out from it, one after another, each bigger
 * than the last. On the leaning table the helix rises from it in depth; on a flat one it climbs the screen.
 */
function evolution(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.evolution;
  const over = overlayFor(document, card, LAYER.fx);
  const { at, w, h } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const keep = (el: HTMLElement) => (made.push(el), el);
  const lying = adder(document, over.host, over.position, runs);
  animations.hold(d);
  // Rings of growth: the card's shape, pulsing out one after another
  for (let i = 0; i < 3; i++) {
    keep(
      lying(
        {
          left: `${at.x - w / 2}px`,
          top: `${at.y - h / 2}px`,
          width: `${w}px`,
          height: `${h}px`,
          zIndex: LAYER.fx,
          borderRadius: 'var(--radius-card)',
          border: `2px solid ${LIFE}`,
          boxShadow: `0 0 10px 2px ${LIFE}, inset 0 0 8px 1px ${LIFE}`,
        },
        [
          { opacity: 0, transform: 'scale(1)' },
          { opacity: 0.9, transform: `scale(${1.05 + i * 0.05})`, offset: 0.2 },
          { opacity: 0, transform: `scale(${1.3 + i * 0.15})` },
        ],
        { duration: d * 0.45, delay: d * (0.15 + i * 0.18), easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      ),
    );
  }
  // The helix: beads on two strands, half a turn apart, going round the card in a circle as they rise
  const radius = Math.max(w, h) * 0.62;
  const climb = Math.max(w, h) * 1.1;
  const deep = over.position === 'absolute';
  const beads = 16;
  for (const strand of [0, Math.PI]) {
    for (let i = 0; i < beads; i++) {
      const s = 3 + Math.random() * 2;
      const turns = 1.5;
      const steps = 12;
      const frames: Keyframe[] = Array.from({ length: steps + 1 }, (_, k) => {
        const t = k / steps;
        const a = strand + t * turns * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius;
        // Leaning table: round it on the table, rising off it (its layer is 3D); flat: an ellipse climbing the screen
        const move = deep ? `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${(t * climb).toFixed(1)}px)` : `translate(${x.toFixed(1)}px, ${(y * 0.45 - t * climb).toFixed(1)}px)`;
        return { offset: t, opacity: t === 0 || t === 1 ? 0 : 1, transform: move };
      });
      keep(
        lying(
          {
            left: `${at.x - s / 2}px`,
            top: `${at.y - s / 2}px`,
            width: `${s}px`,
            height: `${s}px`,
            zIndex: LAYER.fx,
            borderRadius: '50%',
            background: i % 3 ? LIFE : LIFE_LIGHT,
            boxShadow: `0 0 ${5 + s}px ${LIFE}`,
          },
          frames,
          { duration: d * 0.6, delay: (i / beads) * d * 0.35, easing: 'linear' },
        ),
      );
    }
  }
  return Promise.all(runs).then(() => {
    made.forEach((el) => el.remove());
    over.remove();
  });
}
