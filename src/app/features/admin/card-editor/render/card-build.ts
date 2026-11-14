import { CardEffect, KeywordEffect } from '@data/cards/card.model';
import { ArtPlacement, CardSpec, Gradient, Paint, SpecNode, TextSpec } from './spec.model';

/** The data a card is drawn from: its metadata plus the print-only choices. */
export interface CardDraft {
  cardName?: string | null;
  cardType?: string | null;
  cost?: number | null;
  strength?: number | null;
  level?: number | null;
  starter?: boolean | null;
  cardClasses?: string[] | null;
  edition?: string | null;
  colorIdentity?: string | null;
  cardNumber?: number | null;
  regulation?: string | null;
  rarity?: string | null;
  colors?: string[] | null;
  effects?: CardEffect[] | null;
  inheritEffects?: CardEffect[] | null;
  keywordEffects?: KeywordEffect[] | null;
  inheritKeywordEffects?: KeywordEffect[] | null;
  formationEffects?: CardEffect[] | null;
  formationKeywordEffects?: KeywordEffect[] | null;
  enlace?: boolean | null;
  /** Link arrows printed on the card ("left", "right"). */
  arrows?: string[] | null;
  /** No cost / no strength printed: their hexagon or rings are left out. */
  noCost?: boolean | null;
  noStrength?: boolean | null;
  /** Gold border around the card. */
  goldBorder?: boolean | null;
  /** Inherit (HER) frame even before the card has inherit effects. */
  her?: boolean | null;
  specialCost?: number | null;
  specialSummonKind?: string | null;
  requirement?: string | null;
  /** Printed code (E1-P04); built from edition, colors and number when missing. */
  code?: string | null;
  frameStyle?: FrameStyle;
  art?: ArtPlacement | null;
}

export type FrameStyle = 'standard' | 'semi' | 'full';
export const FRAME_STYLE_LABELS: Record<FrameStyle, string> = {
  standard: 'Estándar',
  semi: 'Semi full art',
  full: 'Full art',
};

/** A built card: its spec plus the effect boxes the effect layout fills. */
export interface BuiltCard extends CardSpec {
  effectSlots: EffectSlot[];
  card: CardDraft;
  colors: string[];
  style: FrameStyle;
}

export interface EffectSlot {
  name: string;
  /** Box in card pixels. */
  box: { x: number; y: number; w: number; h: number };
}

/** Measures text width in pixels with a CSS font. */
export type Measure = (text: string, font: string) => number;

const COLOR_KEYS: Record<string, string> = {
  R: 'RED',
  B: 'BLUE',
  G: 'GREEN',
  P: 'PURPLE',
  W: 'WHITE',
};
const KEY_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_KEYS).map(([k, v]) => [v, k]),
);

type Role = 'primary' | 'special' | 'effectBg' | 'margin' | 'dark' | 'edge';
type Swatch = Record<Role, string>;

/** Colors of each part, taken from the COLOR OBJECTS groups of the prototypes. */
export const PALETTE: Record<string, Swatch> = {
  R: {
    primary: '#990608',
    special: '#b4070c',
    effectBg: '#fea1ce',
    margin: '#d83982',
    dark: '#511117',
    edge: '#74090a',
  },
  B: {
    primary: '#022fff',
    special: '#022fff',
    effectBg: '#afc7f6',
    margin: '#3b67ff',
    dark: '#0a1883',
    edge: '#0012a1',
  },
  G: {
    primary: '#277b09',
    special: '#277b09',
    effectBg: '#affdac',
    margin: '#51ce38',
    dark: '#192c16',
    edge: '#2f8116',
  },
  P: {
    primary: '#441eea',
    special: '#441eea',
    effectBg: '#d0c0fe',
    margin: '#835aff',
    dark: '#26108e',
    edge: '#13038b',
  },
  W: {
    primary: '#ebf3f3',
    special: '#ebf3f3',
    effectBg: '#9bb4b5',
    margin: '#ebf3f3',
    dark: '#364546',
    edge: '#d7e6e6',
  },
};

const KIND_GROUP: Record<string, string> = {
  materialization: 'Materialization',
  promotion: 'Promotion',
  ritual: 'Sacrifice',
  evolution: 'Evolve',
};
/** The special summon box takes the color of its kind, not the card's. */
const KIND_COLOR: Record<string, string> = {
  materialization: 'B',
  promotion: 'R',
  ritual: 'P',
  evolution: 'G',
};
const KIND_LABEL: Record<string, string> = {
  materialization: 'Materialización',
  promotion: 'Ascenso',
  ritual: 'Ritual',
  evolution: 'Evolución',
};
const TYPE_LABEL: Record<string, string> = {
  creature: 'Criatura',
  utility: 'Utilidad',
  structure: 'Estructura',
};
const STYLE_GROUP: Record<FrameStyle, string> = {
  standard: 'NONFULLART',
  semi: 'SEMI-FULLART',
  full: 'FULLART',
};

const has = <T>(a: readonly T[] | null | undefined): a is readonly T[] =>
  Array.isArray(a) && a.length > 0;
const clone = <T>(v: T): T => structuredClone(v);

/** Roman numeral of a level (1 → I); other values as digits. */
export function roman(n: number | null | undefined): string {
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n ?? 0];
  return r ?? String(n ?? '');
}

/** The card's one or two colors (letters R B G P W). */
export function colorsOf(card: CardDraft): string[] {
  const list = has(card.colors) ? [...card.colors] : (card.colorIdentity || 'W').split('');
  return list.filter((c) => PALETTE[c]).slice(0, 2);
}

/** Which prototype draws the card. */
export function templateFor(card: CardDraft): string {
  const type = card.cardType || 'creature';
  const her = card.her ?? (has(card.inheritEffects) || has(card.inheritKeywordEffects));
  const white = colorsOf(card).join('') === 'W';
  if (type === 'creature') {
    if (card.enlace) return 'CRIATURA ENLACE - PROTOTIPO';
    if (her) return 'CRIATURA HER - PROTOTIPO';
    return white ? 'CRIATURA BLANCA - PROTOTIPO' : 'CRIATURA - PROTOTIPO';
  }
  if (type === 'utility') {
    if (her) return 'UTILIDAD HER - PROTOTIPO';
    return white ? 'UTILIDAD BLANCA - PROTOTIPO' : 'UTILIDAD - PROTOTIPO';
  }
  return her ? 'ESTRUCTURA HER - PROTOTIPO' : 'ESTRUCTURA - PROTOTIPO';
}

/** Printed code: E1-P04. */
export function cardCode(card: CardDraft): string {
  if (card.code) return card.code;
  // The color letters come from the card's colors.
  const color = colorsOf(card).join('');
  return `${card.edition || ''}-${color}${String(card.cardNumber ?? 0).padStart(2, '0')}`;
}

/** The role a shape plays in the color scheme, by its layer name. */
export function roleOf(name: string): Role | null {
  if (
    /^(Type Frame|br corner|left curved side|LA|RA|Rect.ngulo 27|Special Summon Frame)$/.test(name)
  )
    return 'primary';
  if (name === 'special cost') return 'special';
  if (/BACK EFFECT/.test(name)) return 'effectBg';
  if (/EFFECT MARGIN|^LINK EFFECT/.test(name)) return 'margin';
  if (/^Rect.ngulo redondeado 4 copia/.test(name)) return 'dark';
  if (name === 'special cost edge') return 'edge';
  return null;
}

const gradient = (a: string, b: string, scale = 100): { gradient: Gradient } => ({
  gradient: {
    type: 'Lnr',
    angle: 0,
    scale,
    reverse: false,
    stops: [
      { at: 0, color: a },
      { at: 1, color: b },
    ],
    alphas: [],
  },
});

/**
 * Paint of a role for one color, or for two a left-to-right blend: first color on the left. `scale` is the blend's
 * width in percent of the shape (the prototypes use 20 for frames and margins, so the colors meet in a short band
 * in the middle; 100 for the effect background).
 */
export function rolePaint(
  role: Role,
  cols: string[],
  scale = role === 'effectBg' ? 100 : 20,
): Paint {
  const [a, b] = cols.map((c) => PALETTE[c]);
  if (!b) return a[role];
  // Each side keeps its one-color palette.
  if (role === 'primary' || role === 'special') return gradient(a.primary, b.primary, scale);
  if (role === 'effectBg') return gradient(a.effectBg, b.effectBg, scale);
  if (role === 'dark') return gradient(a.dark, b.dark, scale);
  if (role === 'margin') return gradient(a.margin, b.margin, scale);
  return null;
}

function walk(
  nodes: SpecNode[],
  fn: (n: SpecNode, path: string[]) => void,
  path: string[] = [],
): void {
  for (const n of nodes) {
    const p = [...path, n.name];
    fn(n, p);
    if (n.children) walk(n.children, fn, p);
  }
}

const isColorGroup = (n: SpecNode) => !!n.children && n.name.split(' ').every((w) => KEY_COLOR[w]);

function repaint(group: SpecNode, cols: string[]): void {
  const two = cols.length === 2;
  walk(group.children ?? [], (n) => {
    if (n.children) return;
    // Link cards: the left and right arrows take one color each.
    if (two && (n.name === 'LA' || n.name === 'RA')) {
      n.fill = PALETTE[cols[n.name === 'LA' ? 0 : 1]].primary;
      return;
    }
    const role = roleOf(n.name);
    if (!role) return;
    const stroke = n.stroke ?? n.fx?.stroke;
    const scaleOf = (p: Paint | undefined | null) =>
      p && typeof p === 'object' ? p.gradient.scale : undefined;
    if (role === 'margin' || role === 'edge' || (stroke && !n.fill)) {
      if (!stroke) return;
      // A stroke on an effect background (inherit box) is drawn in the frame colors.
      const strokeRole: Role = role === 'effectBg' ? 'primary' : role;
      const p = rolePaint(strokeRole, cols, stroke.gradient?.scale ?? 20);
      if (p === null) return;
      if (typeof p === 'string') {
        stroke.color = p;
        stroke.gradient = null;
      } else {
        stroke.color = null;
        stroke.gradient = p.gradient;
      }
      return;
    }
    n.fill = rolePaint(role, cols, scaleOf(n.fill) ?? (role === 'effectBg' ? 100 : 20));
  });
}

/** Shows the color group that matches the card (exact pair, either order, first color) and repaints it if needed. */
function selectColorGroup(parent: SpecNode, cols: string[]): SpecNode | null {
  const all = (parent.children ?? []).filter(isColorGroup);
  if (!all.length) return null;
  // Some prototypes keep groups left over from another layout (the link prototype's WHITE and PURPLE pairs carry
  // the plain creature's boxes): only groups shaped like most of them are used.
  const shape = (g: SpecNode) => {
    let top = -1;
    walk(g.children ?? [], (n) => {
      if (top < 0 && n.name === 'Type Frame') top = Math.round(n.bbox[1]);
    });
    return top;
  };
  const counts = new Map<number, number>();
  for (const g of all) counts.set(shape(g), (counts.get(shape(g)) ?? 0) + 1);
  const usual = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const groups = all.filter((g) => shape(g) === usual);
  const name = (cs: string[]) => cs.map((c) => COLOR_KEYS[c]).join(' ');
  let pick = groups.find((g) => g.name === name(cols));
  // Two colors: the prototypes' pair groups differ in small ways from pair to pair, so any of them is only the
  // shape; it is always repainted by role, in the card's order (either way round).
  const exact = !!pick && cols.length === 1;
  if (cols.length === 2) {
    pick =
      groups.find((g) => g.name === name(cols)) ??
      groups.find((g) => g.name === name([cols[1], cols[0]])) ??
      groups.find((g) => g.name.split(' ').length === 2);
  }
  // A missing one-color group borrows the shape of another one-color group, never a pair.
  pick ??=
    groups.find((g) => g.name === COLOR_KEYS[cols[0]]) ??
    groups.find((g) => g.name.split(' ').length === 1) ??
    groups[0];
  for (const g of all) g.visible = g === pick;
  if (!exact) repaint(pick, cols);
  return pick;
}

/** Horizontal extent of a one-line text as drawn (Book Antiqua Bold, the font of name, class and edition). */
export function textSpan(n: SpecNode, measure: Measure): [number, number] {
  const t = n.text!;
  const [xx, , , yy, tx] = t.transform;
  const size = (t.runs[0]?.size ?? 12) * yy;
  const firstLine = t.text.replace(/\r[\s\S]*$/, '');
  const w = measure(firstLine, `700 ${size}px "ERAS Book Antiqua"`) * (xx / yy);
  let x = tx;
  if (t.box) {
    const [l, , r] = t.box;
    x =
      tx + (t.justify === 'center' ? ((r - l) / 2) * xx : t.justify === 'right' ? (r - l) * xx : 0);
  }
  if (t.justify === 'center') return [x - w / 2, x + w / 2];
  if (t.justify === 'right') return [x - w, x];
  return [x, x + w];
}

/**
 * Where a text sits on a two-color bar that has white on one side: 'white' when it lies wholly on the white side,
 * 'color' wholly on the other side, 'both' when it crosses the blend band (the middle 20% of the bar).
 */
export function sideOf(
  span: [number, number],
  bar: number[],
  whiteLeft: boolean,
): 'white' | 'color' | 'both' {
  const c = (bar[0] + bar[2]) / 2;
  const half = ((bar[2] - bar[0]) / 2) * 0.2;
  const left = span[1] <= c - half;
  const right = span[0] >= c + half;
  if (left) return whiteLeft ? 'white' : 'color';
  if (right) return whiteLeft ? 'color' : 'white';
  return 'both';
}

const rectPath = (x0: number, y0: number, x1: number, y1: number) =>
  `M${x0} ${y0}L${x1} ${y0}L${x1} ${y1}L${x0} ${y1}Z`;

/** The widest node with this name whose branch is shown (the visible color group's piece). */
function widestNode(nodes: SpecNode[], name: string): SpecNode | null {
  let best: SpecNode | null = null;
  const visit = (ns: SpecNode[]) => {
    for (const n of ns) {
      if (!n.visible) continue;
      if (n.name === name && (!best || n.bbox[2] - n.bbox[0] > best.bbox[2] - best.bbox[0]))
        best = n;
      if (n.children) visit(n.children);
    }
  };
  visit(nodes);
  return best;
}

/**
 * The link's level badge: a circle flattened at top and bottom (the prototype's own badge shape, grown by `grow`
 * px), centered where the link puts its level.
 */
function flatLevel(grow: number): { d: string; op: number }[] {
  const cx = 59.5;
  const cy = 988;
  const r = 50.5 + grow;
  const top = cy - 33.2 - grow;
  const bottom = cy + 34.2 + grow;
  const k = 0.5523 * r;
  const circle =
    `M${cx} ${cy - r}C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}` +
    `C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}` +
    `C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}` +
    `C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r}Z`;
  return [
    { d: circle, op: 1 },
    { d: rectPath(cx - r - 2, cy - r - 2, cx + r + 2, top), op: 2 },
    { d: rectPath(cx - r - 2, bottom, cx + r + 2, cy + r + 2), op: 2 },
  ];
}

/** Bounds of an absolute path's points. */
function pathBox(d: string): [number, number, number, number] {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const near = (a: number[], b: number[], tol = 3) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

/**
 * Gold border details the prototypes left out:
 * - Plain creatures, utilities and structures join the right side line to the name bar with a straight diagonal:
 *   it becomes a curve.
 * - Link cards: the name bar ends in a round cap like the inherit cards' one, 114 px lower; the inherit
 *   prototype's joint from the side line goes there, then a gold band around the cap (4 px from it all along)
 *   that runs on as the bottom line to the level ring.
 * - Inherit cards: their gold outline is a picture that still carries the plain creature's bottom line, which
 *   crosses the inherit effect box; it is cut out.
 */
function fixGold(layers: SpecNode[], link: boolean, templates: Record<string, CardSpec>): void {
  let gold: SpecNode | null = null;
  walk(layers, (n) => {
    if (!gold && n.name === 'GOLD BORDER') gold = n;
  });
  const g = gold as SpecNode | null;
  if (!g?.children) return;
  const curve = (x0: number) =>
    `M${x0 + 4} 923C${x0 + 4} 936 ${x0 - 12} 930 ${x0 - 12} 943L${x0 - 16} 943C${x0 - 16} 928 ${x0} 934 ${x0} 923Z`;
  const diagonal = [718, 923, 738, 943];
  const underCap = [[718, 940, 722, 1002]];
  walk(g.children, (n) => {
    if (n.children) return;
    if (typeof n.raster === 'string' && n.bbox[3] > 1030) {
      // Inherit cards: clip the stray bottom line out of the picture.
      n.paths = [
        { d: rectPath(0, 0, 744, 1039), op: 1 },
        { d: rectPath(70, 1008, 712, 1021), op: 1 },
      ];
      return;
    }
    if (!n.paths) return;
    n.paths = n.paths.flatMap((sp) => {
      const box = pathBox(sp.d);
      if (near(box, diagonal)) return link ? [] : [{ ...sp, d: curve(734) }];
      if (link && underCap.some((b) => near(box, b))) return [];
      // Link: no bottom line nor bottom right corner; after the cap curve the side line drops to the card's edge.
      if (link && box[0] >= 686 && box[1] >= 980 && box[2] <= 724 && box[3] <= 1020) return [];
      if (link && near(box, [80, 1012, 707, 1016])) return [];
      // Link: the left side line enters the flattened level ring right at its top left corner (coordinates before
      // the link's 17 px drop of the level).
      if (link && near(box, [6, 924, 25, 943])) {
        const [ax, ay, bx, by] = [8, 925, 24, 940];
        const len = Math.hypot(bx - ax, by - ay);
        const [nx, ny] = [(-(by - ay) / len) * 2, ((bx - ax) / len) * 2];
        return [
          {
            ...sp,
            d: `M${ax + nx} ${ay + ny}L${bx + nx} ${by + ny}L${bx - nx} ${by - ny}L${ax - nx} ${ay - ny}Z`,
          },
        ];
      }
      return [sp];
    });
  });
  if (!link) return;
  // The inherit prototype's cap curve and its joints, moved to the link's name bar.
  const her = templates['CRIATURA HER - PROTOTIPO'];
  const pieces: SpecNode[] = [];
  walk(her?.layers ?? [], (n) => {
    if (/^Rectángulo 33 copia 14$/.test(n.name) && n.paths && n.fill)
      pieces.push({
        ...clone(n),
        visible: true,
        paths: n.paths.map((sp) => ({ ...sp, d: mapPoints(sp.d, (x, y) => [x, y + 114]) })),
        bbox: [n.bbox[0], n.bbox[1] + 114, n.bbox[2], n.bbox[3] + 114],
      });
  });
  g.children.push(...pieces);
  // Around the name bar's round cap (center 703,988, radii 28 x 33) a gold band 4 px wide, 4 px away from it all
  // along; at the bottom it runs on as the bottom line, under the name, to the level ring, which it meets with a
  // short diagonal.
  const [cx, cy, rx, ry] = [703, 988, 28, 33];
  const ring = (k: number, t: number): [number, number] => [
    cx + (rx + k) * Math.cos(t),
    cy + (ry + k) * Math.sin(t),
  ];
  // Starts where the joint from the side line arrives.
  const t0 = Math.asin((957 - cy) / (ry + 6));
  const steps = 24;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((Math.PI / 2 - t0) * i) / steps;
    outer.push(ring(8, t));
    inner.push(ring(4, t));
  }
  const yIn = cy + ry + 4;
  const yOut = cy + ry + 8;
  const pts = [
    ...outer,
    [104, yOut],
    [96, yOut - 6],
    [99, yIn - 6],
    [104, yIn],
    ...inner.reverse(),
  ];
  const capBand: SpecNode = {
    name: 'GOLD CAP',
    kind: 'shape',
    visible: true,
    opacity: 1,
    bbox: [94, 940, 744, yOut + 1],
    fill: '#ffee13',
    fx: {
      bevel: {
        size: 2,
        depth: 100,
        angle: 120,
        altitude: 30,
        useGlobal: true,
        hi: '#ffffff',
        hiOpacity: 0.75,
        sh: '#000000',
        shOpacity: 0.75,
      },
    },
    paths: [
      {
        d: `M${pts.map(([x, y]) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`).join('L')}Z`,
        op: 1,
      },
    ],
  };
  g.children.push(capBand);
}

/** Moves every x y pair of an absolute path (M, L, C). */
function mapPoints(d: string, fn: (x: number, y: number) => [number, number]): string {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const out: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2)
    out.push(...fn(Number(nums[i]), Number(nums[i + 1])));
  let k = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, () => String(Math.round(out[k++] * 100) / 100));
}

/** A black rectangle node (card pixels). */
function rectNode(name: string, x0: number, y0: number, x1: number, y1: number): SpecNode {
  return {
    name,
    kind: 'shape',
    visible: true,
    opacity: 1,
    bbox: [x0, y0, x1, y1],
    fill: '#000000',
    paths: [{ d: rectPath(x0, y0, x1, y1), op: 1 }],
  };
}

function setText(n: SpecNode | undefined, text: string, color?: string | null): void {
  if (!n?.text) return;
  n.text.text = text;
  n.text.runs = [{ ...n.text.runs[0], text, ...(color ? { color } : {}) }];
  n.visible = text !== '';
}

function parentOf(nodes: SpecNode[], target: SpecNode): SpecNode[] | null {
  if (nodes.includes(target)) return nodes;
  for (const n of nodes) {
    const r = n.children ? parentOf(n.children, target) : null;
    if (r) return r;
  }
  return null;
}

/** Greedy word wrap. */
export function wrapText(text: string, font: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next, font) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function slotBox(text: TextSpec, bbox: number[]): EffectSlot['box'] {
  const [xx, , , yy, tx, ty] = text.transform;
  if (text.box) {
    const [l, t, r, b] = text.box;
    return { x: tx, y: ty, w: (r - l) * xx, h: (b - t) * yy };
  }
  return { x: bbox[0], y: bbox[1], w: 660, h: 260 };
}

/** Builds the spec of a card from its prototype. */
export function buildCard(
  card: CardDraft,
  templates: Record<string, CardSpec>,
  measure: Measure,
): BuiltCard {
  const spec = clone(templates[templateFor(card)]);
  const cols = colorsOf(card);
  const white = cols.length === 1 && cols[0] === 'W';
  const style: FrameStyle = card.frameStyle ?? 'standard';
  const kind = card.specialSummonKind || null;

  const byName = new Map<string, SpecNode[]>();
  walk(spec.layers, (n) => byName.set(n.name, [...(byName.get(n.name) ?? []), n]));
  const first = (name: string) => byName.get(name)?.[0];

  // The white creature prototype has no gold border: it borrows the plain creature's (same frame geometry).
  if (card.goldBorder && !first('GOLD BORDER')) {
    let borrowed: SpecNode | null = null;
    walk(templates['CRIATURA - PROTOTIPO']?.layers ?? [], (n) => {
      if (!borrowed && n.name === 'GOLD BORDER') borrowed = n;
    });
    const structure = first('CARD-STRUCTURE');
    if (borrowed && structure?.children) {
      const copy = clone(borrowed as SpecNode);
      structure.children.push(copy);
      walk([copy], (n) => byName.set(n.name, [...(byName.get(n.name) ?? []), n]));
    }
  }

  if (card.goldBorder) fixGold(spec.layers, !!card.enlace, templates);

  // Full art: the gold border's black box under the card type label stays out (the label sits on the art).
  if (style === 'full')
    walk(spec.layers, (n, p) => {
      if (p.includes('GOLD BORDER') && /^Rect.ngulo 3[46]$/.test(n.name)) n.visible = false;
    });

  // Frame: standard = NONFULLART; semi = semi frame over the full-art pieces (translucent boxes); full = full-art pieces.
  walk(spec.layers, (n) => {
    if (n.name === 'GOLD BORDER') n.visible = !!card.goldBorder;
    if (n.name !== 'CARD-STRUCTURE' || !n.children) return;
    for (const c of n.children) {
      if (!Object.values(STYLE_GROUP).includes(c.name)) continue;
      c.visible =
        style === 'standard'
          ? c.name === 'NONFULLART'
          : style === 'semi'
            ? c.name !== 'NONFULLART'
            : c.name === 'FULLART';
    }
  });

  // Colors.
  walk(spec.layers, (n) => {
    if (!n.children) return;
    if (n.name === 'COLOR OBJECTS') selectColorGroup(n, cols);
    else if (n.name === 'Alt Summon' || n.name === 'REQ')
      selectColorGroup(n, kind && KIND_COLOR[kind] ? [KIND_COLOR[kind]] : cols);
  });
  if (style !== 'standard') {
    walk(spec.layers, (n, p) => {
      if (p.includes('COLOR OBJECTS') && !n.children && roleOf(n.name) === 'effectBg' && n.fill)
        n.visible = false;
    });
  }

  // Special summon: its box, icon, cost and requirement.
  const alt = first('Alt Summon');
  if (alt) {
    alt.visible = true;
    for (const c of alt.children ?? []) {
      if (c.name === 'COLOR OBJECTS') continue;
      if (!kind) c.visible = false;
      else if (/^(SPEC COST|REQUIREMENT 2 LINES|Special Summon Frame)$/.test(c.name))
        c.visible = true;
    }
  }
  walk(spec.layers, (n, p) => {
    if (
      Object.values(KIND_GROUP).includes(n.name) &&
      p.some((x) => x === 'Alt Summon' || x === 'REQ')
    )
      n.visible = !!kind && n.name === KIND_GROUP[kind];
    if (p.includes('COLOR OBJECTS') && n.name === 'REQ') n.visible = !!kind;
    if (!kind && /^(Special Summon Frame|special cost|special cost edge)( copia)?$/.test(n.name))
      n.visible = false;
  });
  if (kind && alt) {
    // The chosen color group may lack this kind's icon: borrow it from another group (all icons are white strokes).
    let source: SpecNode | null = null;
    walk(alt.children ?? [], (c) => {
      if (!source && c.name === KIND_GROUP[kind] && c.children) source = c;
    });
    for (const g of (alt.children ?? []).filter((c) => isColorGroup(c) && c.visible)) {
      if (source && !g.children!.some((c) => c.name === KIND_GROUP[kind]))
        g.children!.push({ ...clone(source as SpecNode), visible: true });
    }
  }
  if (kind) {
    // The special cost hexagon takes its method's color, also where it sits in the card color's group (white cards).
    const k = KIND_COLOR[kind];
    if (k)
      walk(spec.layers, (n) => {
        if (n.name === 'special cost' && n.fill) n.fill = PALETTE[k].special;
        if (n.name === 'special cost edge') {
          const st = n.stroke ?? n.fx?.stroke;
          if (st) {
            st.color = PALETTE[k].edge;
            st.gradient = null;
          }
        }
      });
    setText(first('SPEC COST'), String(card.specialCost ?? ''), white ? '#000000' : null);
    const req = `${KIND_LABEL[kind] ?? kind}: ${card.requirement || ''}`.trim();
    const one = first('REQUIREMENT');
    const two = first('REQUIREMENT 2 LINES');
    for (const n of [one, two]) if (n) n.visible = false;
    const node = one ?? two;
    if (node?.text) {
      const [, , , yy, tx] = node.text.transform;
      const base = node.text.runs[0].size;
      let size = base;
      let lines: string[];
      for (;;) {
        lines = wrapText(req, `700 ${size * yy}px "ERAS Book Antiqua"`, 628 - tx, measure);
        if (lines.length <= 2 || size < base * 0.7) break;
        size *= 0.94;
      }
      const target = lines.length > 1 && two?.text ? two : node;
      target.text!.justify = 'left';
      setText(target, lines.join('\r'));
      target.text!.runs[0].size = size;
    }
  }

  // Link arrows: only the ones the card has. The semi and standard frames notch their edge where an arrow is and
  // run straight where there is none; in full art each arrow sits on a larger black copy of itself, to stand out
  // over the art.
  if (card.enlace) {
    const arrows = card.arrows ?? [];
    const has = (side: 'left' | 'right') => arrows.includes(side);
    walk(spec.layers, (n) => {
      if (n.name === 'LA') n.visible = has('left');
      if (n.name === 'RA') n.visible = has('right');
    });
    const sideOfNotch = (n: SpecNode): 'left' | 'right' | null =>
      /^Pol.gono 2( copia( \d+)?)?$/.test(n.name) && n.bbox[1] > 500 && n.bbox[3] < 700
        ? n.bbox[0] < 30
          ? 'left'
          : n.bbox[2] > 714
            ? 'right'
            : null
        : null;
    const gaps: Record<'left' | 'right', number[] | null> = { left: null, right: null };
    walk(spec.layers, (n, p) => {
      const side = sideOfNotch(n);
      if (!side) return;
      n.visible = has(side);
      if (!p.includes('SEMI-FULLART')) return;
      const g = gaps[side];
      gaps[side] = g
        ? [
            Math.min(g[0], n.bbox[0]),
            Math.min(g[1], n.bbox[1]),
            Math.max(g[2], n.bbox[2]),
            Math.max(g[3], n.bbox[3]),
          ]
        : [...n.bbox];
    });
    const semi = first('SEMI-FULLART');
    const box =
      widestNode(spec.layers, 'LINK BACK EFFECT') ?? widestNode(spec.layers, 'LINK EFFECT');
    const arrowsShown: SpecNode[] = [];
    walk(spec.layers, (n) => {
      if ((n.name === 'LA' || n.name === 'RA') && n.visible && n.paths) arrowsShown.push(n);
    });
    const geometry = (n: SpecNode) => {
      const left = n.name === 'LA';
      const [x0, y0, x1, y1] = n.bbox;
      const cx = (x0 + x1) / 2;
      return {
        left,
        cx,
        cy: (y0 + y1) / 2,
        r: (x1 - x0) / 2,
        dir: left ? -1 : 1,
        edge: box ? (left ? box.bbox[0] : box.bbox[2]) : cx,
      };
    };
    if (style !== 'standard') {
      // Over the art the colored diamond shows only up to the effect box's border.
      for (const n of arrowsShown) {
        const g = geometry(n);
        const [x0, y0, x1, y1] = n.bbox;
        n.paths = [
          ...n.paths!,
          {
            d: rectPath(
              g.left ? g.edge : g.edge - 4 * g.r,
              y0 - 10,
              g.left ? g.edge + 4 * g.r : g.edge,
              y1 + 10,
            ),
            op: 2,
          },
        ];
        n.shapeBox = g.left ? [x0, y0, g.edge, y1] : [g.edge, y0, x1, y1];
      }
    }
    if (style === 'semi' && semi?.children) {
      for (const side of ['left', 'right'] as const) {
        const arrow = arrowsShown.find((n) => (n.name === 'LA') === (side === 'left'));
        const [x0, x1] = side === 'left' ? [0, 18] : [726, 744];
        if (!arrow) {
          // The semi margin leaves room for the notch: close it with a straight edge where there is no arrow.
          const g = gaps[side];
          if (g) semi.children.push(rectNode(`EDGE ${side}`, x0, g[1], x1, g[3]));
          continue;
        }
        // The notch, measured on a semi full art link card exported by Photoshop (T1-R06): a black diamond centered
        // on the card's edge, reaching the effect box, with the colored arrow on it.
        const g = geometry(arrow);
        const cxEdge = side === 'left' ? 0 : 744;
        const R = 57;
        const notch = rectNode(`NOTCH ${side}`, cxEdge - R, g.cy - R, cxEdge + R, g.cy + R);
        notch.paths = [
          {
            d: `M${cxEdge - R} ${g.cy}L${cxEdge} ${g.cy - R}L${cxEdge + R} ${g.cy}L${cxEdge} ${g.cy + R}Z`,
            op: 1,
          },
          {
            d: rectPath(
              side === 'left' ? g.edge : g.edge - 2 * R,
              g.cy - R - 2,
              side === 'left' ? g.edge + 2 * R : g.edge,
              g.cy + R + 2,
            ),
            op: 2,
          },
        ];
        semi.children.push(notch);
      }
    }
    if (style === 'full') {
      // Measured on a full art link card exported by Photoshop (T1-R07): behind each colored arrow a black triangle
      // with the same bevel, its tip 0.3 of the diamond's half-width further out and its base on the box's border.
      for (const n of arrowsShown) {
        const holder = parentOf(spec.layers, n);
        if (!holder) continue;
        const g = geometry(n);
        const tip = g.cx + g.dir * g.r * 1.3;
        const h = Math.abs(tip - g.edge);
        const back: SpecNode = {
          ...clone(n),
          name: `${n.name} BACK`,
          fill: '#000000',
          stroke: undefined,
          shapeBox: undefined,
          paths: [{ d: `M${tip} ${g.cy}L${g.edge} ${g.cy - h}L${g.edge} ${g.cy + h}Z`, op: 1 }],
          bbox: [Math.min(tip, g.edge), g.cy - h, Math.max(tip, g.edge), g.cy + h],
        };
        holder.splice(holder.indexOf(n), 0, back);
      }
    }
  }

  // Link cards: their card type tab is 31 px wider on each side than the plain creature's and their level badge is
  // a circle flattened at top and bottom, 17.5 px lower. The prototype's standard frame tab and gold border were
  // left at the creature's size; they follow the link's here.
  if (card.enlace) {
    const tabPoint = (x: number, y: number): [number, number] =>
      y < 52 && x >= 270 && x < 372
        ? [x - 31, y]
        : y < 52 && x >= 372 && x <= 475
          ? [x + 30, y]
          : [x, y];
    walk(spec.layers, (n, p) => {
      // Standard frame tab (the semi one already has the link's width).
      if (
        /^CARDTYPE[BLR]$/.test(n.name) &&
        n.bbox[1] >= 20 &&
        p.includes('NONFULLART') &&
        n.paths
      ) {
        n.paths = n.paths.map((sp) => ({ ...sp, d: mapPoints(sp.d, tabPoint) }));
        const [a] = tabPoint(n.bbox[0], n.bbox[1]);
        const [c] = tabPoint(n.bbox[2], n.bbox[3]);
        n.bbox = [a, n.bbox[1], c, n.bbox[3]];
      }
      // Level badge background of the standard frame: flat at top and bottom.
      if (n.name === 'LEVEL BACKGROUND' && p.includes('NONFULLART')) n.paths = flatLevel(0);
    });
  }
  if (card.enlace && card.goldBorder) {
    const gold = first('GOLD BORDER');
    const linkPoint = (x: number, y: number): [number, number] => {
      if (y < 46) {
        if (x >= 270 && x < 372) return [x - 31, y];
        if (x >= 372 && x <= 475) return [x + 30, y];
      }
      if (x < 30 && y > 900 && y < 960) return [x, y + 17];
      // Right side line: down to where the link's name bar curve begins.
      if (x > 730 && y > 900 && y < 930) return [x, y + 18];
      return [x, y];
    };
    // Where an arrow is, the side line breaks in a V around it: on each side of the arrow's tip a gold triangle
    // whose edges are the side line, the black notch's edge 5 px in (the semi frame's notch, a diamond of radius 57 on the
    // card's edge) and the arrow's edge 5 px away (from its black back in full art). The triangles sit inside the
    // black of the standard and semi frames, and their corners end in points.
    const box =
      widestNode(spec.layers, 'LINK BACK EFFECT') ?? widestNode(spec.layers, 'LINK EFFECT');
    interface Shape {
      d: string;
      op: number;
    }
    const vees: { cuts: [number, number]; shapes: Shape[]; side: 'left' | 'right' }[] = [];
    walk(spec.layers, (n) => {
      if ((n.name !== 'LA' && n.name !== 'RA') || !n.visible || !box) return;
      const left = n.name === 'LA';
      const [x0, y0, x1, y1] = n.bbox;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const r = (x1 - x0) / 2;
      // Distances from the card's edge (u), mirrored for the right side.
      const tip = left
        ? cx - r * (style === 'full' ? 1.3 : 1)
        : 744 - (cx + r * (style === 'full' ? 1.3 : 1));
      const R = 57;
      const s2 = Math.SQRT2;
      const notch = (u: number, s: number) => cy - R + u + s * s2;
      const arrow = (u: number, t: number) => cy - (u - tip) - t * s2;
      const meet = (s: number, t: number) => (R + tip - (s + t) * s2) / 2;
      const X = (u: number) => (left ? u : 744 - u);
      const tri = (u0: number, s: number, t: number, flip: boolean): Shape => {
        const Y = (y: number) => (flip ? 2 * cy - y : y);
        const um = meet(s, t);
        const pts: [number, number][] = [
          [u0, notch(u0, s)],
          [um, notch(um, s)],
          [u0, arrow(u0, t)],
        ];
        return { d: `M${pts.map(([u, y]) => `${X(u)} ${Y(y)}`).join('L')}Z`, op: 1 };
      };
      const half = (flip: boolean): Shape[] => [
        tri(6, 5, 5, flip),
        { ...tri(10, 9, 9, flip), op: 2 },
      ];
      vees.push({
        cuts: [notch(10, 5), 2 * cy - notch(10, 5)],
        shapes: [...half(false), ...half(true)],
        side: left ? 'left' : 'right',
      });
    });
    if (gold?.children)
      walk(gold.children, (n) => {
        if (n.children) return;
        if (n.name === 'GOLD CAP') return;
        if (n.name === 'Elipse 9') {
          // The level badge is flattened at top and bottom: the ring follows it.
          n.paths = flatLevel(0);
          n.bbox = [9, 937, 111, 1038];
          return;
        }
        // Over the art the label needs no black box.
        if (n.name === 'Rectángulo 34' && style === 'full') n.visible = false;
        if (n.paths) {
          n.paths = n.paths.flatMap((sp) => {
            // Pieces under the name bar (bottom line, bottom right corner) move whole, 17 px lower; the bottom line
            // starts after the level badge.
            const d =
              pathBox(sp.d)[1] >= 980
                ? mapPoints(sp.d, (x, y) => [x <= 85 ? 100 : x, y + 17])
                : mapPoints(sp.d, linkPoint);
            const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
            const xs = nums.filter((_, i) => i % 2 === 0);
            const ys = nums.filter((_, i) => i % 2 === 1);
            const [minX, maxX, minY, maxY] = [
              Math.min(...xs),
              Math.max(...xs),
              Math.min(...ys),
              Math.max(...ys),
            ];
            const v = vees.find(
              (e) => (e.side === 'left' ? maxX <= 12 : minX >= 732) && maxY - minY > 300,
            );
            if (!v) return [{ ...sp, d }];
            // Side line split around the V, plus the two triangles (outer minus inner).
            return [
              { ...sp, d: rectPath(minX, minY, maxX, v.cuts[0] + 1) },
              { ...sp, d: rectPath(minX, v.cuts[1] - 1, maxX, maxY) },
              ...v.shapes,
            ];
          });
        }
        if (n.text) {
          // "Criatura Enlace" is nearly as wide as the tab: a little smaller so the gold sides clear it.
          n.text.transform[4] = 372;
          n.text.runs = n.text.runs.map((r) => ({ ...r, size: r.size * 0.86 }));
        }
        const [a, b] = linkPoint(n.bbox[0], n.bbox[1]);
        const [c, d] = linkPoint(n.bbox[2], n.bbox[3]);
        n.bbox = [Math.min(a, n.bbox[0]), b, Math.max(c, n.bbox[2]), d];
      });
  }

  // Cost and strength can be left out (cards with no normal cost, creatures with no strength).
  const COST_PARTS = /^(COST|COST FRAME|COST BACKGROUND|Pol.gono 1 copia)$/;
  const STRENGTH_PARTS = /^(STRENGHT|strengthfigure|BACK TR|BACK TR copia)$/;
  walk(spec.layers, (n) => {
    if (card.noCost && COST_PARTS.test(n.name)) n.visible = false;
    if (card.noStrength && STRENGTH_PARTS.test(n.name)) n.visible = false;
  });

  // Starter tag, structure / utility icon.
  const ini = first('INICIADOR');
  if (ini) {
    ini.visible = !!card.starter;
    const want = (
      { R: 'ROJO', B: 'AZUL', G: 'VERDE', P: 'PURPLE', W: 'BLANCO' } as Record<string, string>
    )[cols[0]];
    for (const c of ini.children ?? []) c.visible = c.name.endsWith(want);
  }
  for (const k of ['STRUCTURE', 'UTILITY']) {
    const g = first(k);
    if (g) g.visible = (k === 'STRUCTURE') === (card.cardType === 'structure');
  }

  // Texts.
  const onPrimary = white ? '#000000' : '#ffffff';
  setText(first('NAME'), card.cardName || '', onPrimary);
  setText(first('COST'), String(card.cost ?? ''));
  setText(first('STRENGHT'), card.cardType === 'creature' ? String(card.strength ?? '') : '');
  setText(first('LEVEL'), roman(card.level));
  setText(
    first('TYPE'),
    has(card.cardClasses) ? `[${card.cardClasses.join(' | ')}]` : '',
    onPrimary,
  );
  const typeLabel = card.enlace ? 'Criatura Enlace' : (TYPE_LABEL[card.cardType ?? ''] ?? '');
  for (const name of ['CARD-TYPE', 'CARD-TYPE copia', 'CARD-TYPE copia 2'])
    for (const n of byName.get(name) ?? []) setText(n, typeLabel);
  // With the gold border its own label (inside the gold tab) is the only one shown.
  if (card.goldBorder)
    walk(spec.layers, (n, p) => {
      if (
        /^CARD-TYPE( copia 2)?$/.test(n.name) &&
        !p.includes('GOLD BORDER') &&
        first('GOLD BORDER')
      )
        n.visible = false;
    });

  // Black text keeps no black outline (the link prototype outlines its white name; on white cards it went black).
  if (white)
    walk(spec.layers, (n) => {
      const st = n.fx?.stroke;
      if (n.text && st?.color === '#000000' && (n.text.runs[0]?.color ?? '') === '#000000')
        delete n.fx!.stroke;
    });

  const ed = first('EDITION');
  setText(ed, `${cardCode(card)} ${card.rarity || ''}`.trim(), onPrimary);
  // White and another color: a text wholly on the white side is black; one crossing both colors is white with a
  // black outline; one on the other color stays white.
  const halfWhite = cols.length === 2 && cols.includes('W');
  const widest = (name: string) =>
    (byName.get(name) ?? []).reduce<number[] | undefined>(
      (a, n) => (!a || n.bbox[2] - n.bbox[0] > a[2] - a[0] ? n.bbox : a),
      undefined,
    );
  const typeBar = widest('Type Frame');
  const nameBar = widest('br corner') ?? widest('left curved side');
  const sides = new Map<SpecNode, 'white' | 'color' | 'both'>();
  const onBar = (n: SpecNode | undefined, bar: number[] | undefined) => {
    if (!halfWhite || !n?.text || !n.visible || !bar) return;
    const side = sideOf(textSpan(n, measure), bar, cols[0] === 'W');
    sides.set(n, side);
    n.text.runs[0].color = side === 'white' ? '#000000' : '#ffffff';
    if (side === 'both')
      n.fx = {
        ...n.fx,
        stroke: { size: 1, pos: 'OutF', opacity: 1, color: '#000000', gradient: null },
      };
  };
  onBar(first('NAME'), nameBar);
  onBar(first('TYPE'), typeBar);
  const badge = first('REGULATION BG') ?? first('Rectángulo redondeado 4');
  if (ed?.text && badge) {
    // Regulation letter inside its badge: black border, white badge and black letter on every card.
    const [bx0, , bx1] = badge.bbox;
    ed.text.transform[4] = bx0 - 4;
    ed.text.justify = 'right';
    ed.text.box = null;
    onBar(ed, typeBar);
    badge.visible = !!card.regulation;
    if (!badge.fill) badge.fill = '#ffffff';
    const letter = clone(ed);
    letter.name = 'REGULATION';
    letter.text!.justify = 'center';
    letter.text!.transform[4] = (bx0 + bx1) / 2;
    // In the PSD the letter is part of the edition text, on its baseline.
    letter.text!.transform[5] = ed.text.transform[5];
    setText(letter, card.regulation || '', '#000000');
    const siblings = parentOf(spec.layers, ed);
    siblings?.splice(siblings.indexOf(ed) + 1, 0, letter);
  }

  // Effect boxes: the template's effect text frames (drawn later by the effect layout).
  const effectSlots: EffectSlot[] = [];
  for (const name of ['EFFECT', 'EFFECT copia', 'INHERIT EFFECT']) {
    const n = first(name);
    if (!n?.text) continue;
    n.visible = false;
    effectSlots.push({ name, box: slotBox(n.text, n.bbox) });
  }

  // Art over the whole card, under the frame.
  if (card.art)
    walk(spec.layers, (n) => {
      if (n.name === 'Fondo') n.art = card.art;
    });

  return { ...spec, effectSlots, card, colors: cols, style };
}
