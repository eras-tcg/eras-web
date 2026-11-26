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
 * Ascenso, a promotion in rank: a pillar of golden light rises from the card, and a rank's insignia builds up over it,
 * chevron after chevron, crowned by a star, then rises off and fades; golden sparks go up with it. Seen from in front
 * (flat on the screen), as a banner raised over the card.
 */
function promotion(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.promotion;
  const over = overlayFor(document, null, LAYER.fx);
  const { screen, rect } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const add = adder(document, document.body, 'fixed', runs);
  const keep = (el: HTMLElement) => (made.push(el), el);
  animations.hold(d);
  const tall = Math.max(rect.height * 2.6, 220);
  const beamW = rect.width * 0.9;
  // The pillar of light: from the card up, widening at its foot, fading at its top
  keep(
    add(
      {
        left: `${screen.x - beamW / 2}px`,
        top: `${screen.y - tall}px`,
        width: `${beamW}px`,
        height: `${tall}px`,
        zIndex: LAYER.fx,
        background: `linear-gradient(to top, ${GOLD_LIGHT}, color-mix(in srgb, ${GOLD} 70%, transparent) 30%, transparent)`,
        clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 0 100%)',
        filter: 'blur(4px)',
        mixBlendMode: 'screen',
        transformOrigin: '50% 100%',
      },
      [
        { opacity: 0, transform: 'scaleY(0.1)' },
        { opacity: 0.9, transform: 'scaleY(1)', offset: 0.25 },
        { opacity: 0.7, transform: 'scaleY(1)', offset: 0.7 },
        { opacity: 0, transform: 'scaleY(1.05) scaleX(0.6)' },
      ],
      { duration: d, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    ),
  );
  // The insignia: three chevrons stacking up from below, then a star over them; all of it rises and fades
  const size = rect.width * 0.9;
  const insignia = keep(
    add(
      {
        left: `${screen.x - size / 2}px`,
        top: `${screen.y - size * 0.9}px`,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: LAYER.fx,
        overflow: 'visible',
        filter: `drop-shadow(0 0 6px ${GOLD}) drop-shadow(0 2px 4px rgb(0 0 0 / 60%))`,
      },
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.68 },
        { opacity: 0, transform: `translateY(${-size * 0.5}px) scale(1.1)` },
      ],
      { duration: d, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
      'svg',
    ),
  );
  insignia.setAttribute('viewBox', '0 0 100 100');
  const chevron = (y: number) => `<path d="M14 ${y} L50 ${y - 16} L86 ${y} L86 ${y + 11} L50 ${y - 5} L14 ${y + 11} Z"/>`;
  const star = (cx: number, cy: number, r: number) =>
    `<path d="${Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const k = i % 2 ? r * 0.45 : r;
      return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * k).toFixed(1)} ${(cy + Math.sin(a) * k).toFixed(1)}`;
    }).join(' ')} Z"/>`;
  const parts = [chevron(92), chevron(72), chevron(52), star(50, 18, 13)];
  insignia.innerHTML = parts
    .map((p, i) => `<g data-i="${i}" fill="${GOLD}" stroke="${GOLD_LIGHT}" stroke-width="2" stroke-linejoin="round" opacity="0">${p}</g>`)
    .join('');
  insignia.style.opacity = '1';
  insignia.querySelectorAll<SVGGElement>('g').forEach((g, i) =>
    runs.push(
      g
        .animate(
          [
            { opacity: 0, transform: 'translateY(14px)', filter: 'brightness(2.5)' },
            { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1.6)', offset: 0.5 },
            { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1)' },
          ],
          { duration: d * 0.18, delay: d * (0.12 + i * 0.1), easing: 'cubic-bezier(0.2, 0.8, 0.3, 1.2)', fill: 'both' },
        )
        .finished.catch(() => undefined),
    ),
  );
  // Golden sparks rising along the pillar
  for (let i = 0; i < 20; i++) {
    const s = 2 + Math.random() * 3;
    const x = screen.x + (Math.random() - 0.5) * rect.width * 0.8;
    const rise = tall * (0.4 + Math.random() * 0.5);
    keep(
      add(
        {
          left: `${x - s / 2}px`,
          top: `${screen.y - s / 2}px`,
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
        { duration: d * (0.5 + Math.random() * 0.3), delay: d * (0.05 + Math.random() * 0.45), easing: 'cubic-bezier(0.3, 0.5, 0.5, 1)' },
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
 * will be, faster as they near it; the card's outline traces itself, a lattice of light fills it, and it flashes as the
 * card lands into it. Lying on the table as the card does.
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
  // The outline tracing itself and a lattice filling it, as the matter comes in; then a flash as the card lands
  const frame = keep(
    add(
      { left: `${at.x - w / 2}px`, top: `${at.y - h / 2}px`, width: `${w}px`, height: `${h}px`, zIndex: LAYER.fx, overflow: 'visible' },
      [{ opacity: 1 }, { opacity: 1, offset: Math.min(0.95, land + 0.1) }, { opacity: 0 }],
      { duration: d },
      'svg',
    ),
  );
  frame.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const cells = 4;
  const lattice = Array.from({ length: cells - 1 }, (_, i) => {
    const x = ((i + 1) * w) / cells;
    const y = ((i + 1) * h) / cells;
    return `<path d="M${x.toFixed(1)} 0 V${h}"/><path d="M0 ${y.toFixed(1)} H${w}"/>`;
  }).join('');
  frame.innerHTML =
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(w * 0.04).toFixed(1)}" pathLength="1" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="1" stroke-dashoffset="1" style="filter: drop-shadow(0 0 3px ${MATTER}) drop-shadow(0 0 6px ${MATTER})"/>` +
    `<g stroke="${MATTER}" stroke-width="0.8" opacity="0">${lattice}</g>`;
  const [outline, grid] = Array.from(frame.children) as SVGElement[];
  runs.push(
    outline.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: d * land * 0.8, delay: d * land * 0.1, easing: 'ease-in-out', fill: 'forwards' }).finished,
    grid.animate([{ opacity: 0 }, { opacity: 0.7, offset: 0.6 }, { opacity: 0.2 }], { duration: d * land * 0.7, delay: d * land * 0.3, fill: 'forwards' }).finished,
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
 * Evolución, a creature evolving: two strands of green life coil around the card, rising from its foot past its top
 * like a helix, while rings of growth the card's shape pulse out from it, one after another, each bigger than the last.
 * The strands are seen from in front (flat on the screen); the rings lie on the table.
 */
function evolution(document: Document, animations: BoardAnimations, card: HTMLElement): Promise<void> {
  const d = TIMING.evolution;
  const over = overlayFor(document, card, LAYER.fx);
  const { at, w, h, screen, rect } = measure(card, over);
  const runs: Promise<unknown>[] = [];
  const made: HTMLElement[] = [];
  const keep = (el: HTMLElement) => (made.push(el), el);
  const lying = adder(document, over.host, over.position, runs);
  const flat = adder(document, document.body, 'fixed', runs);
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
  // The helix: beads on two strands, half a turn apart, coiling round the card as they rise from its foot past its top
  const radius = rect.width * 0.62;
  const bottom = screen.y + rect.height * 0.45;
  const climb = rect.height * 1.5;
  const beads = 16;
  for (const strand of [0, Math.PI]) {
    for (let i = 0; i < beads; i++) {
      const s = 3 + Math.random() * 2;
      const turns = 1.6;
      const steps = 8;
      const frames: Keyframe[] = Array.from({ length: steps + 1 }, (_, k) => {
        const t = k / steps;
        const a = strand + t * turns * Math.PI * 2;
        // In front of the card on one side of its turn, behind it (dimmer, smaller) on the other
        const front = Math.sin(a);
        return {
          offset: t,
          opacity: t === 0 || t === 1 ? 0 : 0.55 + 0.45 * front,
          transform: `translate(${(Math.cos(a) * radius).toFixed(1)}px, ${(-t * climb).toFixed(1)}px) scale(${(0.7 + 0.3 * front).toFixed(2)})`,
        };
      });
      keep(
        flat(
          {
            left: `${screen.x - s / 2}px`,
            top: `${bottom - s / 2}px`,
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
