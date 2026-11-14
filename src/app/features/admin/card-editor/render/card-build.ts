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
interface Swatch extends Record<Role, string> {
  bi: string;
  biBg: string;
}

/** Colors of each part, taken from the COLOR OBJECTS groups of the prototypes. */
export const PALETTE: Record<string, Swatch> = {
  R: {
    primary: '#990608',
    special: '#b4070c',
    effectBg: '#fea1ce',
    margin: '#d83982',
    dark: '#511117',
    edge: '#74090a',
    bi: '#990608',
    biBg: '#fea1ce',
  },
  B: {
    primary: '#022fff',
    special: '#022fff',
    effectBg: '#afc7f6',
    margin: '#3b67ff',
    dark: '#0a1883',
    edge: '#0012a1',
    bi: '#022fff',
    biBg: '#afc7f6',
  },
  G: {
    primary: '#277b09',
    special: '#277b09',
    effectBg: '#affdac',
    margin: '#51ce38',
    dark: '#192c16',
    edge: '#2f8116',
    bi: '#277b09',
    biBg: '#affdac',
  },
  P: {
    primary: '#441eea',
    special: '#441eea',
    effectBg: '#d0c0fe',
    margin: '#835aff',
    dark: '#26108e',
    edge: '#13038b',
    bi: '#441fea',
    biBg: '#d0c1fe',
  },
  W: {
    primary: '#ebf3f3',
    special: '#ebf3f3',
    effectBg: '#9bb4b5',
    margin: '#ebf3f3',
    dark: '#364546',
    edge: '#d7e6e6',
    bi: '#ffffff',
    biBg: '#c5d8d8',
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
  const her = has(card.inheritEffects) || has(card.inheritKeywordEffects);
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
  const color = card.colorIdentity || colorsOf(card).join('');
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
  link = false,
): Paint {
  const [a, b] = cols.map((c) => PALETTE[c]);
  if (!b) return a[role];
  if (role === 'primary' || role === 'special') return gradient(a.bi, b.bi, scale);
  if (role === 'effectBg')
    return link ? gradient(a.biBg, b.biBg, scale) : gradient(a.effectBg, b.effectBg, scale);
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
      n.fill = PALETTE[cols[n.name === 'LA' ? 0 : 1]].bi;
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
    n.fill = rolePaint(
      role,
      cols,
      scaleOf(n.fill) ?? (role === 'effectBg' ? 100 : 20),
      n.name.startsWith('LINK'),
    );
  });
}

/** Shows the color group that matches the card (exact pair, either order, first color) and repaints it if needed. */
function selectColorGroup(parent: SpecNode, cols: string[]): SpecNode | null {
  const groups = (parent.children ?? []).filter(isColorGroup);
  if (!groups.length) return null;
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
  pick ??= groups.find((g) => g.name === COLOR_KEYS[cols[0]]) ?? groups[0];
  for (const g of groups) g.visible = g === pick;
  if (!exact) repaint(pick, cols);
  return pick;
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

  // Frame: standard = NONFULLART; semi = semi frame over the full-art pieces (translucent boxes); full = full-art pieces.
  walk(spec.layers, (n) => {
    if (n.name === 'GOLD BORDER') n.visible = false;
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
  for (const name of ['CARD-TYPE', 'CARD-TYPE copia 2'])
    for (const n of byName.get(name) ?? []) setText(n, typeLabel);

  const ed = first('EDITION');
  setText(ed, `${cardCode(card)} ${card.rarity || ''}`.trim(), onPrimary);
  const badge = first('REGULATION BG') ?? first('Rectángulo redondeado 4');
  if (ed?.text && badge) {
    // Regulation letter inside its badge: white badge and black letter, dark badge on white cards.
    const [bx0, , bx1] = badge.bbox;
    ed.text.transform[4] = bx0 - 4;
    ed.text.justify = 'right';
    ed.text.box = null;
    badge.visible = !!card.regulation;
    if (!badge.fill) badge.fill = white ? '#364546' : '#ffffff';
    const letter = clone(ed);
    letter.name = 'REGULATION';
    letter.text!.justify = 'center';
    letter.text!.transform[4] = (bx0 + bx1) / 2;
    // In the PSD the letter is part of the edition text, on its baseline.
    letter.text!.transform[5] = ed.text.transform[5];
    setText(letter, card.regulation || '', white ? '#ffffff' : '#000000');
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
