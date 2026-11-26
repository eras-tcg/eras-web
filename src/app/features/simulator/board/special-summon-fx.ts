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
 * The card completed (`at`, `w`×`h`, in its host's pixels): when `filled`, the card's shape lit full in `color` with a
 * line of light round it, fading; and a flash of white and `color` that swells off it. After `delay`; `d` scales them.
 */
function completed(add: ReturnType<typeof adder>, at: { x: number; y: number }, w: number, h: number, color: string, delay: number, d: number, filled: boolean): HTMLElement[] {
  const box = { left: `${at.x - w / 2}px`, top: `${at.y - h / 2}px`, width: `${w}px`, height: `${h}px`, zIndex: LAYER.fx, borderRadius: 'var(--radius-card)', mixBlendMode: 'screen' };
  const made: HTMLElement[] = [];
  if (filled) {
    made.push(
      add(
        {
          ...box,
          border: '1.5px solid #fff',
          background: `radial-gradient(ellipse at center, #fff, color-mix(in srgb, ${color} 70%, transparent) 35%, color-mix(in srgb, ${color} 30%, transparent) 80%)`,
          boxShadow: `0 0 8px 2px ${color}, inset 0 0 10px 2px ${color}`,
        },
        [
          { opacity: 0, transform: 'scale(0.94)' },
          { opacity: 1, transform: 'scale(1)', offset: 0.2 },
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
        { opacity: 1, transform: 'scale(1.02)', offset: 0.2 },
        { opacity: 0, transform: 'scale(1.2)' },
      ],
      { duration: d * 0.35, delay: delay + (filled ? d * 0.04 : 0), easing: 'ease-out' },
    ),
  );
  return made;
}

/**
 * Ascenso, a promotion in rank: tiers of golden light the card's shape stack up from it one over another, each higher
 * and narrower than the last, as rising through the ranks; then they come down into the card all at once, which
 * flashes gold, and embers of gold rise. On the leaning table the tiers rise off it in depth; on a flat one, up the
 * screen.
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
  const step = Math.max(w, h) * 0.22;
  const up = (z: number, scale: number) => (deep ? `translateZ(${z.toFixed(1)}px) scale(${scale})` : `translateY(${(-z * 0.8).toFixed(1)}px) scale(${scale})`);
  const tiers = 4;
  // When they come down into the card, as a share of it
  const down = 0.62;
  for (let i = 0; i < tiers; i++) {
    const z = step * (i + 1);
    const scale = 1.12 - i * 0.12;
    const born = 0.06 + i * 0.12;
    keep(
      add(
        {
          left: `${at.x - w / 2}px`,
          top: `${at.y - h / 2}px`,
          width: `${w}px`,
          height: `${h}px`,
          zIndex: LAYER.fx,
          borderRadius: 'var(--radius-card)',
          border: `2px solid ${GOLD_LIGHT}`,
          background: `linear-gradient(to top, color-mix(in srgb, ${GOLD} 22%, transparent), transparent 70%)`,
          boxShadow: `0 0 14px 3px ${GOLD}, inset 0 0 12px 2px color-mix(in srgb, ${GOLD} 70%, transparent)`,
          mixBlendMode: 'screen',
        },
        [
          { opacity: 0, transform: up(0, scale * 0.9), offset: 0 },
          { opacity: 0, transform: up(0, scale * 0.9), offset: born },
          { opacity: 1, transform: up(z, scale), offset: born + 0.14, easing: 'ease-in-out' },
          { opacity: 0.9, transform: up(z * 1.04, scale), offset: down, easing: 'cubic-bezier(0.7, 0, 1, 0.6)' },
          { opacity: 1, transform: up(0, 1), offset: down + 0.1 },
          { opacity: 0, transform: up(0, 1.06) },
        ],
        { duration: d, easing: 'linear' },
      ),
    );
  }
  // The card flashing gold as the tiers come down into it
  keep(
    add(
      {
        left: `${at.x - w / 2}px`,
        top: `${at.y - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: LAYER.fx,
        borderRadius: 'var(--radius-card)',
        background: `radial-gradient(ellipse at center, ${GOLD_LIGHT}, color-mix(in srgb, ${GOLD} 60%, transparent) 60%, transparent)`,
        mixBlendMode: 'screen',
      },
      [
        { opacity: 0, transform: 'scale(0.95)' },
        { opacity: 1, transform: 'scale(1.03)', offset: 0.25 },
        { opacity: 0, transform: 'scale(1.18)' },
      ],
      { duration: d * 0.35, delay: d * (down + 0.08), easing: 'ease-out' },
    ),
  );
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
  });
}

/**
 * Materialización, matter composed into a creature: specks of matter are drawn in from all around to where the card
 * will be, faster as they near it, feeding a bright core there that grows, pulsing, into the card's shape; it flashes as
 * the card lands into it. Lying on the table as the card does.
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
        { opacity: 1, transform: 'scale(0.42)', borderRadius: '30%', offset: 0.45, easing: 'ease-in-out' },
        { opacity: 0.85, transform: 'scale(0.38)', borderRadius: '24%', offset: 0.55 },
        { opacity: 1, transform: 'scale(0.78)', offset: 0.82, easing: 'ease-in-out' },
        { opacity: 0.9, transform: 'scale(0.74)', offset: 0.88 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: d * land, easing: 'linear', fill: 'both' },
    ),
  );
  runs.push(charge.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.25, delay: d * land, fill: 'forwards' }).finished);
  // The flash as it lands (its core is the card filled)
  completed(add, at, w, h, MATTER, d * land, d, false).forEach(keep);
  return Promise.all(runs)
    .catch(() => undefined)
    .then(() => {
      made.forEach((el) => el.remove());
      over.remove();
    });
}

/**
 * Evolución, a creature evolving: four strands of green life coil round the card in a circle, rising off the table as
 * they turn, like a helix, motes of it rising up the middle with them; then the card is completed: lit full in green,
 * it flashes. On the leaning table the helix rises from it in depth; on a flat one it climbs the screen.
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
  // The helix: beads on four strands, a quarter turn apart, going round the card as they rise. Each bead sits at the end
  // of an arm that turns (rotate, then out along it), so it follows a true circle, not a polygon
  const radius = Math.max(w, h) * 0.62;
  const climb = Math.max(w, h) * 1.1;
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
  const beads = 16;
  const turns = 540;
  for (const strand of [0, 90, 180, 270]) {
    for (let i = 0; i < beads; i++) {
      const at0 = strand;
      bead(
        3 + Math.random() * 2,
        i % 3 ? LIFE : LIFE_LIGHT,
        [0, 0.12, 0.88, 1].map((t) => ({ offset: t, opacity: t === 0 || t === 1 ? 0 : 1, transform: place(t, at0 + t * turns, radius) })),
        { duration: d * 0.6, delay: (i / beads) * d * 0.35, easing: 'linear' },
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
  // The card completed, in green, as the strands have risen
  completed(lying, at, w, h, LIFE, d * 0.6, d, true).forEach(keep);
  return Promise.all(runs).then(() => {
    made.forEach((el) => el.remove());
    over.remove();
  });
}
