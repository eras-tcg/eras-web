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

/**
 * A card where it lands: its center on the screen and in `over`, its own size, and whether it lies turned a quarter.
 * Its center is where its own middle is drawn (a point in it), not the middle of the box round it: on the leaning
 * table the far half of a card looks smaller, so the two differ.
 */
function measure(card: HTMLElement, over: Overlay) {
  const r = card.getBoundingClientRect();
  const screen = middleOf(card) ?? centerOf(card);
  const turned = Math.round(flatTurn(card, card.closest('.plane')).turn / 90) % 2 !== 0;
  const w = card.offsetWidth || r.width;
  const h = card.offsetHeight || r.height;
  return { screen, at: over.at(screen.x, screen.y), w: turned ? h : w, h: turned ? w : h, rect: r };
}

/** Where an element's own middle is drawn on the screen (a point placed there inside it); null if it cannot hold one. */
function middleOf(el: HTMLElement): { x: number; y: number } | null {
  if (el.ownerDocument.defaultView?.getComputedStyle(el).position === 'static') return null;
  const probe = el.ownerDocument.createElement('span');
  Object.assign(probe.style, { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', pointerEvents: 'none' });
  el.append(probe);
  const p = probe.getBoundingClientRect();
  probe.remove();
  return { x: p.left, y: p.top };
}

/** Adds an element to `host` (absolute, or fixed on the screen), animates it and collects when it ends. */
function adder(document: Document, host: HTMLElement, position: string, runs: Promise<unknown>[]) {
  return (style: Partial<CSSStyleDeclaration>, frames: Keyframe[], timing: KeyframeAnimationOptions, tag = 'div') => {
    const el = tag === 'svg' ? (document.createElementNS(SVG, 'svg') as unknown as HTMLElement) : document.createElement(tag);
    // Its border inside its size, so it lines up with the card's edge
    Object.assign(el.style, { position, boxSizing: 'border-box', pointerEvents: 'none', opacity: '0', ...style });
    host.append(el);
    runs.push(el.animate(frames, { fill: 'backwards', ...timing }).finished.catch(() => undefined));
    return el;
  };
}

/**
 * The card completed (`at`, `w`×`h`, in its host's pixels): when `filled`, the card's shape lit full in `color` with a
 * line of light round it, fading; and a flash of white and `color` that swells off it. After `delay`; `d` scales them;
 * `strength` (0 to 1) how bright they get.
 */
function completed(
  add: ReturnType<typeof adder>,
  at: { x: number; y: number },
  w: number,
  h: number,
  color: string,
  delay: number,
  d: number,
  filled: boolean,
  strength = 1,
): HTMLElement[] {
  const box = { left: `${at.x - w / 2}px`, top: `${at.y - h / 2}px`, width: `${w}px`, height: `${h}px`, zIndex: LAYER.fx, borderRadius: 'var(--radius-card)', mixBlendMode: 'screen' };
  const made: HTMLElement[] = [];
  if (filled) {
    made.push(
      add(
        {
          ...box,
          border: `1.5px solid rgb(255 255 255 / ${Math.round(strength * 100)}%)`,
          background: `radial-gradient(ellipse at center, #fff, color-mix(in srgb, ${color} 70%, transparent) 35%, color-mix(in srgb, ${color} 30%, transparent) 80%)`,
          boxShadow: `0 0 8px 2px ${color}, inset 0 0 10px 2px ${color}`,
        },
        [
          { opacity: 0, transform: 'scale(0.94)' },
          { opacity: strength, transform: 'scale(1)', offset: 0.2 },
          { opacity: 0, transform: 'scale(1)' },
        ],
        { duration: d * 0.3, delay, easing: 'ease-out' },
      ),
    );
  }
  made.push(
    add(
      { ...box, background: `radial-gradient(ellipse at center, #fff, color-mix(in srgb, ${color} 60%, transparent) 60%, transparent)` },
      [
        { opacity: 0, transform: 'scale(0.9)' },
        { opacity: strength, transform: 'scale(1.02)', offset: 0.2 },
        { opacity: 0, transform: 'scale(1.2)' },
      ],
      { duration: d * 0.35, delay: delay + (filled ? d * 0.04 : 0), easing: 'ease-out' },
    ),
  );
  return made;
}

/**
 * Ascenso, a promotion in rank: the card's edge lights up gold on the table, and the light rises from it as a wall all
 * round the card, its top a bright line going up, lighting the card from every side; then the wall fades as it goes on
 * up, the card glows gold faintly and embers rise. On the leaning table the wall stands up from it in depth; on a flat
 * one a curtain of light rises up the screen from the card's foot.
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
  const deep = over.position === 'absolute';
  const tall = Math.max(w, h) * 0.85;
  const rim = `2px solid ${GOLD_LIGHT}`;
  const glow = (to: string) => `linear-gradient(to ${to}, color-mix(in srgb, ${GOLD} 75%, transparent), color-mix(in srgb, ${GOLD} 25%, transparent) 55%, transparent)`;
  // The edge lit on the table, where the wall rises from
  keep(
    add(
      {
        left: `${at.x - w / 2}px`,
        top: `${at.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: LAYER.fx,
        borderRadius: 'var(--radius-card)',
        border: rim,
        boxShadow: `0 0 12px 3px ${GOLD}, inset 0 0 10px 2px color-mix(in srgb, ${GOLD} 60%, transparent)`,
      },
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0.9, offset: 0.6 },
        { opacity: 0 },
      ],
      { duration: d, easing: 'linear' },
    ),
  );
  // The wall: rising (its height grows from the edge, its top a bright line), holding, then fading as it goes on up
  const rise = (stand: string, grow: 'scaleX' | 'scaleY') =>
    [
      { opacity: 0, transform: `${stand} ${grow}(0)` },
      { opacity: 1, transform: `${stand} ${grow}(0.05)`, offset: 0.08, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      { opacity: 1, transform: `${stand} ${grow}(1)`, offset: 0.5 },
      { opacity: 0.85, transform: `${stand} ${grow}(1.05)`, offset: 0.7, easing: 'ease-in' },
      { opacity: 0, transform: `${stand} ${grow}(1.3)` },
    ] as Keyframe[];
  const wall = (style: Partial<CSSStyleDeclaration>, frames: Keyframe[]) =>
    keep(add({ zIndex: LAYER.fx, ...style }, frames, { duration: d, easing: 'linear' }));
  if (deep) {
    // Four sides standing up from the card's edges (each laid on the table out from its edge, then turned up on it)
    const x0 = at.x - w / 2;
    const y0 = at.y - h / 2;
    // Along the foot and the head: turned up on their lower edge
    for (const y of [y0 + h, y0]) {
      wall(
        { left: `${x0}px`, top: `${y - tall}px`, width: `${w}px`, height: `${tall}px`, transformOrigin: '50% 100%', background: glow('top'), borderTop: rim },
        rise('rotateX(-90deg)', 'scaleY'),
      );
    }
    // Along the sides: the left one turned up on its left edge, the right one on its right edge
    wall(
      { left: `${x0}px`, top: `${y0}px`, width: `${tall}px`, height: `${h}px`, transformOrigin: '0 50%', background: glow('right'), borderRight: rim },
      rise('rotateY(-90deg)', 'scaleX'),
    );
    wall(
      { left: `${x0 + w - tall}px`, top: `${y0}px`, width: `${tall}px`, height: `${h}px`, transformOrigin: '100% 50%', background: glow('left'), borderLeft: rim },
      rise('rotateY(90deg)', 'scaleX'),
    );
  } else {
    // Flat: a curtain of light rising up the screen from the card's foot, as wide as the card
    wall(
      { left: `${at.x - w / 2}px`, top: `${at.y + h / 2 - tall * 1.4}px`, width: `${w}px`, height: `${tall * 1.4}px`, transformOrigin: '50% 100%', background: glow('top'), borderTop: rim },
      rise('', 'scaleY'),
    );
  }
  // The card glowing gold, faintly, as the wall stands round it: in a layer of its own (its blending would flatten the
  // wall's layer, which stands up in depth)
  const top = overlayFor(document, card, LAYER.fx);
  const { screen } = measure(card, top);
  completed(adder(document, top.host, top.position, runs), top.at(screen.x, screen.y), w, h, GOLD, d * 0.3, d, true, 0.35).forEach(keep);
  const point = () => ({ x: (Math.random() - 0.5) * w, y: (Math.random() - 0.5) * h });
  // Embers of gold rising off the card
  for (let i = 0; i < 18; i++) {
    const s = 2 + Math.random() * 3;
    const q = point();
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
    top.remove();
  });
}

/**
 * Materialización, matter composed into a creature: specks of matter are drawn in from all around to where the card
 * will be, faster as they near it, feeding a bright core there that grows, pulsing and fainter, into the card's shape;
 * it flashes faintly as the card lands into it. Lying on the table as the card does.
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
    // Into the core as it is when they arrive: the later, the farther from its middle
    const grown = 0.15 + Math.random() * 0.75;
    const tx = (Math.random() - 0.5) * w * grown;
    const ty = (Math.random() - 0.5) * h * grown;
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
  // The card charging up: a bright core where its middle will be, growing into the card's shape as the matter comes
  // in, pulsing as it fills, its edge a line of light
  const charge = keep(
    add(
      {
        left: `${at.x - w / 2}px`,
        top: `${at.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: LAYER.fx,
        borderRadius: 'var(--radius-card)',
        border: '1.5px solid #fff',
        background: `radial-gradient(ellipse at center, #fff, color-mix(in srgb, ${MATTER} 70%, transparent) 35%, color-mix(in srgb, ${MATTER} 30%, transparent) 80%)`,
        boxShadow: `0 0 8px 2px ${MATTER}, inset 0 0 10px 2px ${MATTER}`,
        mixBlendMode: 'screen',
      },
      [
        { opacity: 0, transform: 'scale(0.04)', borderRadius: '50%' },
        { opacity: 1, transform: 'scale(0.12)', borderRadius: '50%', offset: 0.12 },
        { opacity: 0.85, transform: 'scale(0.42)', borderRadius: '30%', offset: 0.45, easing: 'ease-in-out' },
        { opacity: 0.7, transform: 'scale(0.38)', borderRadius: '24%', offset: 0.55 },
        { opacity: 0.6, transform: 'scale(0.78)', offset: 0.82, easing: 'ease-in-out' },
        { opacity: 0.5, transform: 'scale(0.74)', offset: 0.88 },
        // Faint once it is the card's size, as Evolución's glow
        { opacity: 0.4, transform: 'scale(1)', borderColor: 'rgb(255 255 255 / 40%)' },
      ],
      { duration: d * land, easing: 'linear', fill: 'both' },
    ),
  );
  runs.push(charge.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: d * 0.25, delay: d * land, fill: 'forwards' }).finished);
  // The flash as it lands (its core is the card filled)
  completed(add, at, w, h, MATTER, d * land, d, false, 0.4).forEach(keep);
  return Promise.all(runs)
    .catch(() => undefined)
    .then(() => {
      made.forEach((el) => el.remove());
      over.remove();
    });
}

/**
 * Evolución, a creature evolving: four strands of green life coil round the card in a circle, rising off the table as
 * they turn, like a helix, motes of it rising up the middle with them, as the card is lit faintly in green and
 * flashes. On the leaning table the helix rises from it in depth; on a flat one it climbs the screen.
 */
function evolution(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.evolution;
  const over = overlayFor(document, card, LAYER.fx);
  const { at, w, h, screen } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const keep = (el: HTMLElement) => (made.push(el), el);
  const lying = adder(document, over.host, over.position, runs);
  animations.hold(d);
  // The helix: beads on four strands, a quarter turn apart, going round the card as they rise. Each bead sits at the end
  // of an arm that turns (rotate, then out along it), so it follows a true circle, not a polygon
  const radius = Math.max(w, h) * 0.55;
  const climb = Math.max(w, h) * 1.8;
  const deep = over.position === 'absolute';
  // Leaning table: round it on the table, rising off it (its layer is 3D); flat: an ellipse climbing the screen
  const place = (t: number, a: number, r: number) =>
    deep
      ? `translateZ(${(t * climb).toFixed(1)}px) rotate(${a.toFixed(1)}deg) translateX(${r.toFixed(1)}px)`
      : `translateY(${(-t * climb).toFixed(1)}px) scaleY(0.45) rotate(${a.toFixed(1)}deg) translateX(${r.toFixed(1)}px)`;
  const bead = (s: number, color: string, frames: Keyframe[], timing: KeyframeAnimationOptions) =>
    keep(
      lying(
        {
          left: `${at.x - s / 2}px`,
          top: `${at.y - s / 2}px`,
          width: `${s}px`,
          height: `${s}px`,
          zIndex: LAYER.fx,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${5 + s}px ${LIFE}`,
        },
        frames,
        timing,
      ),
    );
  // Each strand a line of beads close behind one another, so it reads as a coil rising, not a ring
  const beads = 12;
  const turns = 360;
  for (const strand of [0, 90, 180, 270]) {
    for (let i = 0; i < beads; i++) {
      const at0 = strand;
      bead(
        3 + Math.random() * 2,
        i % 3 ? LIFE : LIFE_LIGHT,
        [0, 0.12, 0.88, 1].map((t) => ({ offset: t, opacity: t === 0 || t === 1 ? 0 : 1, transform: place(t, at0 + t * turns, radius) })),
        { duration: d * 0.6, delay: (i / beads) * d * 0.22, easing: 'linear' },
      );
    }
  }
  // Motes rising up the middle with the strands, turning a little as they go
  for (let i = 0; i < 14; i++) {
    const r = Math.max(w, h) * Math.random() * 0.18;
    const a0 = Math.random() * 360;
    bead(
      2 + Math.random() * 2.5,
      Math.random() < 0.5 ? LIFE_LIGHT : LIFE,
      [0, 0.15, 0.85, 1].map((t) => ({ offset: t, opacity: t === 0 || t === 1 ? 0 : 0.9, transform: place(t * 1.15, a0 + t * 180, r) })),
      { duration: d * (0.45 + Math.random() * 0.2), delay: d * (0.08 + Math.random() * 0.4), easing: 'cubic-bezier(0.3, 0.2, 0.6, 1)' },
    );
  }
  // The card lit, faintly, in green as the strands start: in a layer of its own (its blending would flatten the
  // helix's layer, which rises in depth)
  const top = overlayFor(document, card, LAYER.fx);
  const done = completed(adder(document, top.host, top.position, runs), top.at(screen.x, screen.y), w, h, LIFE, 0, d, true, 0.4);
  done.forEach(keep);
  return Promise.all(runs).then(() => {
    made.forEach((el) => el.remove());
    over.remove();
    top.remove();
  });
}
