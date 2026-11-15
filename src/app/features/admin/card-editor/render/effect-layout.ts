import { CardEffect, KeywordEffect, KeywordEffectRef } from '@data/cards/card.model';
import { BuiltCard, EffectSlot, Measure } from './card-build';
import { PieceStyle, PieceTable } from './spec.model';
import { SvgRenderer, svgEl } from './svg-render';
import { betweenCopiesMark } from '../effect-text';

/** Effect text sizes tried in order until the text fits its box (points at 300 dpi). */
export const EFFECT_SIZES = [7, 6.5, 6, 5.5, 5];
export const ptToPx = (pt: number) => (pt * 300) / 72;
const FONT = '"ERAS Arial"';
export const effectFont = (px: number, italic = false) =>
  `${italic ? 'italic ' : ''}700 ${px}px ${FONT}`;

export type PieceKind = 'timing' | 'condition' | 'keyword';
export type Token =
  | { t: 'word'; text: string; italic: boolean; glue?: boolean }
  | { t: 'space' }
  | { t: 'break' }
  | { t: 'ultimate' }
  | { t: 'ultimateEnd' }
  | { t: 'piece'; kind: PieceKind; label: string; style?: string };

const USAGE: Record<string, { piece?: string; style?: string; after?: string; ultimate?: boolean }> = {
  'once per turn': { piece: 'una vez por turno' },
  // Between copies the piece is the yellow one (SIMBOLOS' EXTRAS), the plain one is white
  'once per turn between copies': { piece: 'una vez por turno', style: 'una vez por turno entre copias', after: 'entre copias' },
  'ultimate effect': { ultimate: true },
};

/** Lowercase ASCII key of a label ("En Invocación" → "en invocacion"). */
export const pieceKey = (s: string) =>
  (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fill = (text: string, value: string | number | null | undefined) =>
  value == null || value === '' ? text : text.replace(/\{[^}]+\}/g, String(value));

/** Reminder text of a keyword: the reference's display text, or its effect written out. */
export function keywordReminder(
  keyword: string,
  value: string | number | null | undefined,
  ref: Record<string, KeywordEffectRef | undefined>,
): string | null {
  const entry = ref[keyword] ?? ref[keyword.replace(/\{[^}]+\}/, '').trim()];
  if (!entry) return null;
  let text = entry.displayText || entry.description || '';
  if (!text && entry.effect) {
    text = (entry.effect.effectBlocks ?? [])
      .map((b) =>
        `${b.activationCondition ? `${b.activationCondition}: ` : ''}${b.cost ? `${b.cost}; ` : ''}${b.resolution ?? ''}`.trim(),
      )
      .join(' ');
  }
  // The reference text carries the keyword's own heading ("<Todos Los Turnos> [una vez por turno]"): reminders print without it.
  text = text
    .replace(/<[^>]+>\s*/g, '')
    .replace(/\[(una vez por turno|efecto definitivo)\]\s*/gi, '')
    .trim();
  return text ? fill(text, value) : null;
}

export class EffectTokens {
  constructor(
    private readonly pieces: PieceTable,
    private readonly ref: Record<string, KeywordEffectRef | undefined>,
  ) {}

  /** One box: own keywords first, then the effects, one paragraph each. */
  slot(
    effects: readonly CardEffect[] | null | undefined,
    keywords: readonly KeywordEffect[] | null | undefined,
  ): Token[] {
    const paragraphs: Token[][] = [];
    for (const k of keywords ?? []) paragraphs.push(this.keyword(k));
    for (const e of effects ?? []) paragraphs.push(this.effect(e));
    const out: Token[] = [];
    for (const p of paragraphs.filter((p) => p.length)) {
      if (out.length) out.push({ t: 'break' });
      out.push(...p);
    }
    return out;
  }

  keyword(k: KeywordEffect): Token[] {
    const out: Token[] = [];
    if (!k.keyword) return out;
    out.push({ t: 'piece', kind: 'keyword', label: fill(k.keyword, k.number) });
    const note = keywordReminder(k.keyword, k.number, this.ref);
    if (note) {
      out.push({ t: 'space' });
      words(`(${note})`, true, out);
    }
    return out;
  }

  effect(e: CardEffect): Token[] {
    const out: Token[] = [];
    const usage = USAGE[e.ussageLimit ?? ''];
    if (usage?.ultimate) out.push({ t: 'ultimate' });
    const head: Token[] = (e.instance ?? '')
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ t: 'piece', kind: 'timing', label }) as Token);
    if (usage?.piece) head.push({ t: 'piece', kind: 'condition', label: usage.piece, style: usage.style });
    head.forEach((p, i) => {
      // Consecutive momentos touch (Turno Aliado + En Mano), as in the printed cards.
      const joined = p.t === 'piece' && p.kind === 'timing' && i > 0;
      if (i && !joined) out.push({ t: 'space' });
      out.push(p);
    });
    if (usage?.after) {
      out.push({ t: 'space' });
      // A colon closes the conditions; a comma when another condition follows.
      words(`${usage.after}${betweenCopiesMark(e)}`, false, out);
    }
    for (const b of e.effectBlocks ?? []) {
      const found: { keyword: string; value: string | null; label: string }[] = [];
      const cond = (b.activationCondition ?? '').trim();
      if (cond) {
        if (out.length) out.push({ t: 'space' });
        // A condition from the symbol sheet ("por efecto") is a piece and takes no colon.
        if (this.pieces.conditions[pieceKey(cond)])
          out.push({ t: 'piece', kind: 'condition', label: cond });
        else {
          found.push(...rich(cond, out));
          append(out, ':');
        }
      }
      if (b.cost) {
        out.push({ t: 'space' });
        found.push(...rich(b.cost, out));
        append(out, ';');
      }
      if (b.resolution) {
        out.push({ t: 'space' });
        found.push(...rich(b.resolution, out));
      }
      for (const f of found) {
        const note = keywordReminder(f.keyword, f.value, this.ref);
        if (note) {
          out.push({ t: 'space' });
          words(`(${f.label}: ${note})`, true, out);
        }
      }
    }
    return out;
  }
}

function words(text: string, italic: boolean, out: Token[]): void {
  for (const w of text.split(/(\s+)/)) {
    if (!w) continue;
    out.push(/^\s+$/.test(w) ? { t: 'space' } : { t: 'word', text: w, italic });
  }
}

/** "text [[Keyword:3]] more" → words and keyword pieces; returns the keywords found. */
function rich(
  text: string,
  out: Token[],
): { keyword: string; value: string | null; label: string }[] {
  const found: { keyword: string; value: string | null; label: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([^\]:]+)(?::([^\]]*))?\]\]/g)) {
    if (m.index > last) words(text.slice(last, m.index), false, out);
    const label = fill(m[1], m[2]);
    out.push({ t: 'piece', kind: 'keyword', label });
    found.push({ keyword: m[1], value: m[2] ?? null, label });
    last = m.index + m[0].length;
  }
  if (last < text.length) words(text.slice(last), false, out);
  return found;
}

function append(out: Token[], punct: string): void {
  const last = out[out.length - 1];
  if (last?.t === 'word') last.text += punct;
  else out.push({ t: 'word', text: punct, italic: false, glue: true });
}

// ── Layout ──────────────────────────────────────────────────────────────────

export interface PlacedToken {
  tok: Token;
  x: number;
  w: number;
  /** Drawn under the piece before it (interlocked momentos). */
  under?: boolean;
}

export interface EffectLayout {
  lines: PlacedToken[][];
  lineHeights: number[];
  height: number;
  pt: number;
  px: number;
  fits: boolean;
}

export function pieceMetrics(
  kind: PieceKind,
  label: string,
  px: number,
  measure: Measure,
): { w: number; h: number } {
  const h = kind === 'timing' ? px * 1.2 : px * 1.07;
  const pad = kind === 'timing' ? h * 0.5 : px * 0.22;
  return { w: measure(label, effectFont(px)) + pad * 2, h };
}

/** Greedy line breaking at one size; pieces never break. */
/** Extra left body of an interlocked momento, in em. */
const TUCK = 0.44;

export function layoutAt(
  tokens: Token[],
  width: number,
  height: number,
  pt: number,
  measure: Measure,
): EffectLayout {
  const px = ptToPx(pt);
  const lineH = px * 1.2;
  const space = measure(' ', effectFont(px));
  const lines: PlacedToken[][] = [[]];
  let x = 0;
  let pendingSpace = false;
  // The ultimate effect sits between two bars: its heading and, where the effect ends, a closing one.
  let inUltimate = false;
  const closeUltimate = () => {
    if (!inUltimate) return;
    if (lines[lines.length - 1].length) lines.push([]);
    lines[lines.length - 1].push({ tok: { t: 'ultimateEnd' }, x: 0, w: width });
    lines.push([]);
    inUltimate = false;
  };
  for (const tok of [...tokens, { t: 'break' } as Token]) {
    if (tok.t === 'space') {
      pendingSpace = true;
      continue;
    }
    if (tok.t === 'break' || tok.t === 'ultimate') {
      closeUltimate();
      if (lines[lines.length - 1].length) lines.push([]);
      if (tok.t === 'ultimate') {
        lines[lines.length - 1].push({ tok, x: 0, w: width });
        lines.push([]);
        inUltimate = true;
      }
      x = 0;
      pendingSpace = false;
      continue;
    }
    if (tok.t === 'ultimateEnd') continue;
    // A momento right after another (no space) interlocks with it: it starts under the other's tip, with extra
    // body on the left so its text clears the tip.
    const prev = lines[lines.length - 1].at(-1);
    const under =
      !pendingSpace &&
      tok.t === 'piece' &&
      tok.kind === 'timing' &&
      prev?.tok.t === 'piece' &&
      prev.tok.kind === 'timing';
    const w =
      tok.t === 'piece'
        ? pieceMetrics(tok.kind, tok.label, px, measure).w + (under ? px * TUCK : 0)
        : measure(tok.text, effectFont(px, tok.italic));
    const gap = under ? -px * 0.74 : pendingSpace && x > 0 ? space : 0;
    if (x > 0 && x + gap + w > width && !(tok.t === 'word' && tok.glue)) {
      lines.push([]);
      x = 0;
    } else x += gap;
    lines[lines.length - 1].push({ tok, x, w, ...(under && x > 0 ? { under: true } : {}) });
    x += w;
    pendingSpace = false;
  }
  while (lines.length && !lines[lines.length - 1].length) lines.pop();
  const lineHeights = lines.map((l) =>
    l.some((i) => i.tok.t === 'ultimate')
      ? lineH * 1.15
      : l.some((i) => i.tok.t === 'ultimateEnd')
        ? lineH * 0.6
        : lineH,
  );
  const total = lineHeights.reduce((a, b) => a + b, 0);
  return { lines, lineHeights, height: total, pt, px, fits: total <= height };
}

/** The largest size that fits, or the smallest one. */
export function layoutFit(
  tokens: Token[],
  width: number,
  height: number,
  measure: Measure,
): EffectLayout {
  let lay = layoutAt(tokens, width, height, EFFECT_SIZES[0], measure);
  for (const pt of EFFECT_SIZES.slice(1)) {
    if (lay.fits) break;
    lay = layoutAt(tokens, width, height, pt, measure);
  }
  return lay;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

/** Writes every effect box of a built card into its SVG. Returns the size used in each box. */
export function drawEffects(
  r: SvgRenderer,
  card: BuiltCard,
  pieces: PieceTable,
  ref: Record<string, KeywordEffectRef | undefined>,
  measure: Measure,
): EffectLayout[] {
  const tokens = new EffectTokens(pieces, ref);
  const draft = card.card;
  const color = card.style === 'standard' ? '#000000' : '#ffffff';
  const slots = [...card.effectSlots].sort((a, b) => a.box.y - b.box.y);
  const inherit = slots.find((s) => s.name === 'INHERIT EFFECT');
  const content: [CardEffect[] | null | undefined, KeywordEffect[] | null | undefined][] = [];
  // A Criatura Enlace prints its link effect in the upper box.
  if (draft.enlace) content.push([draft.formationEffects, draft.formationKeywordEffects]);
  content.push([draft.effects, draft.keywordEffects]);
  const out: EffectLayout[] = [];
  slots
    .filter((s) => s !== inherit)
    .forEach((slot, i) => {
      const [e, k] = content[i] ?? [];
      out.push(drawSlot(r, slot, tokens.slot(e, k), color, pieces, measure));
    });
  if (inherit)
    out.push(
      drawSlot(
        r,
        inherit,
        tokens.slot(draft.inheritEffects, draft.inheritKeywordEffects),
        color,
        pieces,
        measure,
      ),
    );
  return out;
}

function drawSlot(
  r: SvgRenderer,
  slot: EffectSlot,
  tokens: Token[],
  color: string,
  pieces: PieceTable,
  measure: Measure,
): EffectLayout {
  const g = svgEl('g', { 'data-name': `effect:${slot.name}` }, r.svg);
  const lay = layoutFit(tokens, slot.box.w, slot.box.h, measure);
  const px = lay.px;
  let y = slot.box.y;
  lay.lines.forEach((line, i) => {
    // Photoshop's first baseline in a text box sits about 0.715 em below the box top (Arial).
    const baseline = y + px * 0.715;
    let lastPiece: SVGElement | null = null;
    for (const { tok, x, under } of line) {
      const X = slot.box.x + x;
      if (tok.t === 'piece') {
        const pg = svgEl('g', {});
        if (under && lastPiece) g.insertBefore(pg, lastPiece);
        else g.appendChild(pg);
        drawPiece(
          r,
          pg,
          tok,
          X,
          baseline,
          px,
          pieces,
          measure,
          under ? px * TUCK : 0,
        );
        lastPiece = pg;
      } else if (tok.t === 'ultimate') drawUltimate(g, slot.box, y, px, measure);
      else if (tok.t === 'ultimateEnd') drawUltimateBar(g, slot.box, y + px * 0.3, px);
      else if (tok.t === 'word') {
        svgEl(
          'text',
          {
            x: X,
            y: baseline,
            fill: color,
            'font-family': FONT,
            'font-weight': 700,
            'font-style': tok.italic ? 'italic' : 'normal',
            'font-size': px,
          },
          g,
        ).textContent = tok.text;
      }
    }
    y += lay.lineHeights[i];
  });
  return lay;
}

function pieceStyle(pieces: PieceTable, kind: PieceKind, label: string, style?: string): PieceStyle | null {
  const table = { timing: pieces.timings, condition: pieces.conditions, keyword: pieces.keywords }[
    kind
  ];
  return (
    (style ? table[pieceKey(style)] : undefined) ??
    table[pieceKey(label)] ??
    table[pieceKey(label.replace(/\s*\d+$/, ''))] ??
    null
  );
}

function drawPiece(
  r: SvgRenderer,
  g: Element,
  tok: Extract<Token, { t: 'piece' }>,
  x: number,
  baseline: number,
  px: number,
  pieces: PieceTable,
  measure: Measure,
  tuck = 0,
): void {
  const m = pieceMetrics(tok.kind, tok.label, px, measure);
  const h = m.h;
  const w = m.w + tuck;
  const st: PieceStyle = pieceStyle(pieces, tok.kind, tok.label, tok.style) ?? {
    label: tok.label,
    fill: [
      [0, '#555555'],
      [1, '#777777'],
    ],
    text: '#ffffff',
    textStroke: null,
    textStrokeSize: null,
  };
  const y = baseline - px * 0.78 - (h - px) / 2 + px * 0.04;
  const grad = r.id('pg');
  const lg = svgEl(
    'linearGradient',
    { id: grad, gradientUnits: 'userSpaceOnUse', x1: x, y1: y + h, x2: x, y2: y },
    r.defs,
  );
  for (const [at, c] of cmykStops(st.fill)) svgEl('stop', { offset: at, 'stop-color': c }, lg);
  const paint = `url(#${grad})`;
  if (tok.kind === 'timing') {
    const d = `M${x} ${y + h / 2}L${x + h / 2} ${y}L${x + w - h / 2} ${y}L${x + w} ${y + h / 2}L${x + w - h / 2} ${y + h}L${x + h / 2} ${y + h}Z`;
    svgEl('path', { d, fill: paint }, g);
  } else if (tok.kind === 'condition') {
    const b = px * 0.07;
    svgEl(
      'rect',
      {
        x: x - b,
        y: y - b,
        width: w + 2 * b,
        height: h + 2 * b,
        rx: px * 0.17,
        fill: st.border || '#ffffff',
      },
      g,
    );
    svgEl('rect', { x, y, width: w, height: h, rx: px * 0.15, fill: paint }, g);
  } else {
    svgEl('rect', { x, y, width: w, height: h, rx: px * 0.17, fill: paint }, g);
  }
  svgEl(
    'text',
    {
      x: x + tuck + m.w / 2,
      y: baseline,
      'text-anchor': 'middle',
      fill: st.text || '#ffffff',
      'font-family': FONT,
      'font-weight': 700,
      'font-size': px,
      filter: st.textStroke ? `url(#${r.outline(st.textStrokeSize || 1, st.textStroke)})` : null,
    },
    g,
  ).textContent = tok.label;
}

const ULTIMATE_PURPLE = '#5b3b6e';

/** The ultimate effect's bar across the box, with a diamond at each end, centered on `mid`. */
function drawUltimateBar(g: Element, box: EffectSlot['box'], mid: number, px: number): void {
  const purple = ULTIMATE_PURPLE;
  svgEl(
    'rect',
    {
      x: box.x + px * 0.3,
      y: mid - px * 0.09,
      width: box.w - px * 0.6,
      height: px * 0.18,
      rx: px * 0.09,
      fill: purple,
    },
    g,
  );
  for (const ex of [box.x + px * 0.3, box.x + box.w - px * 0.3]) {
    svgEl(
      'path',
      {
        d: `M${ex - px * 0.35} ${mid}L${ex} ${mid - px * 0.35}L${ex + px * 0.35} ${mid}L${ex} ${mid + px * 0.35}Z`,
        fill: purple,
      },
      g,
    );
  }
}

function drawUltimate(
  g: Element,
  box: EffectSlot['box'],
  y: number,
  px: number,
  measure: Measure,
): void {
  const mid = y + px * 0.6;
  const label = 'Efecto Definitivo';
  const tw = measure(label, effectFont(px, true)) + px * 1.4;
  const cx = box.x + box.w / 2;
  const h = px * 1.2;
  drawUltimateBar(g, box, mid, px);
  const l = cx - tw / 2;
  const rr = cx + tw / 2;
  svgEl(
    'path',
    {
      d: `M${l} ${mid}L${l + h / 2} ${mid - h / 2}L${rr - h / 2} ${mid - h / 2}L${rr} ${mid}L${rr - h / 2} ${mid + h / 2}L${l + h / 2} ${mid + h / 2}Z`,
      fill: ULTIMATE_PURPLE,
    },
    g,
  );
  svgEl(
    'text',
    {
      x: cx,
      y: mid + px * 0.35,
      'text-anchor': 'middle',
      fill: '#ebc868',
      'font-family': FONT,
      'font-weight': 700,
      'font-style': 'italic',
      'font-size': px,
    },
    g,
  ).textContent = label;
}

/**
 * Gradient stops blended as Photoshop does in a CMYK file: when every stop carries its CMYK, the run between two
 * stops is sampled in CMYK (a black-to-green momento darkens sooner than an RGB blend would).
 */
export function cmykStops(fill: PieceStyle['fill'], steps = 8): [number, string][] {
  if (!fill.every((f) => f.length > 2)) return fill.map(([at, c]) => [at, c]);
  const naive = (k: number[]) => {
    const [c, m, y, b] = k.map((v) => v / 100);
    const ch = (v: number) =>
      Math.round(255 * (1 - v) * (1 - b))
        .toString(16)
        .padStart(2, '0');
    return `#${ch(c)}${ch(m)}${ch(y)}`;
  };
  const out: [number, string][] = [];
  for (let i = 0; i < fill.length; i++) {
    const [at, , k] = fill[i] as [number, string, number[]];
    if (i === 0 || at === fill[i - 1][0]) {
      out.push([at, naive(k)]);
      continue;
    }
    const [at0, , k0] = fill[i - 1] as [number, string, number[]];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([at0 + (at - at0) * t, naive(k0.map((v, j) => v + (k[j] - v) * t))]);
    }
  }
  return out;
}
