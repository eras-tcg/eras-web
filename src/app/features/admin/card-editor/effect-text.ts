import { CardEffect, KeywordEffect } from '@data/cards/card.model';
import { PieceTable } from './render/spec.model';

/**
 * The effect box as the admin types it: lines of text and pieces (momento, condición, keyword, efecto definitivo).
 * One line is one effect, or one keyword with its value. Converts to and from the card's effect metadata.
 */
export type PieceSegKind = 'timing' | 'condition' | 'keyword' | 'ultimate';
export type Seg =
  { t: 'text'; text: string } | { t: 'piece'; kind: PieceSegKind; label: string; key?: string };
export type Line = Seg[];

export interface PieceCatalog {
  timings: string[];
  conditions: string[];
  /** Keyword names as printed, with the reference key ("Provocar" → "Provocar {nivel}"). */
  keywords: { label: string; key: string }[];
}

export const ULTIMATE_LABEL = 'Efecto Definitivo';
const ONCE = 'una vez por turno';

/** Same-length, accent-free, lowercase copy (positions stay aligned with the original). */
export function foldChars(s: string): string {
  return [...s].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] ?? c).join('');
}

const isLetter = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
// Keyword parameters are written "{nivel}" or as a trailing X ("Valor X").
const baseName = (key: string) => key.replace(/\s*(\{[^}]+\}|\bX$)/g, '').trim();
const hasParam = (key: string) => /\{[^}]+\}|\bX$/.test(key);

/** Labels the editor recognizes, from the symbol sheet and the keyword reference. */
export function pieceCatalog(pieces: PieceTable, keywordKeys: string[]): PieceCatalog {
  const conditions = Object.values(pieces.conditions).map((p) => p.label);
  const isCondition = new Set(conditions.map(foldChars));
  return {
    timings: Object.values(pieces.timings).map((p) => p.label),
    conditions,
    // A keyword named like a condition ("Por efecto") is that condition.
    keywords: keywordKeys
      .map((key) => ({ label: baseName(key), key }))
      .filter((k) => !isCondition.has(foldChars(k.label))),
  };
}

/** A keyword's value written after it: a number, X, or a bracketed condition ("Protección [Dragón]"). */
const VALUE = /^\s*(\d+|X\b|\[[^\]]*\])/;

/**
 * The reference key for a keyword label: the one with a {parameter} when a value follows ("Furia 2"), the plain one
 * otherwise ("Furia"); a keyword with only one form keeps it.
 */
function keywordKey(cat: PieceCatalog, label: string, after: string): string {
  const forms = cat.keywords.filter((k) => foldChars(k.label) === foldChars(label));
  const valued = VALUE.test(after);
  return forms.find((k) => hasParam(k.key) === valued)?.key ?? forms[0]?.key ?? label;
}

// ── Metadata → lines ────────────────────────────────────────────────────────

/** Text with inline keywords ("gana [[Celeridad]]") as segments. */
function richSegs(text: string, cat: PieceCatalog): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([^\]:]+)(?::([^\]]*))?\]\]/g)) {
    if (m.index > last) out.push({ t: 'text', text: text.slice(last, m.index) });
    const key = m[1];
    const label = cat.keywords.find((k) => k.key === key)?.label ?? baseName(key);
    out.push({ t: 'piece', kind: 'keyword', label, key });
    if (m[2]) out.push({ t: 'text', text: ` ${m[2]}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) });
  return out;
}

export function effectsToLines(
  effects: readonly CardEffect[],
  keywords: readonly KeywordEffect[],
  cat: PieceCatalog,
): Line[] {
  const lines: Line[] = [];
  for (const k of keywords) {
    if (!k.keyword) continue;
    const label = cat.keywords.find((x) => x.key === k.keyword)?.label ?? baseName(k.keyword);
    const line: Line = [{ t: 'piece', kind: 'keyword', label, key: k.keyword }];
    if (k.number !== null && k.number !== undefined && k.number !== '')
      line.push({ t: 'text', text: ` ${k.number}` });
    lines.push(line);
  }
  for (const e of effects) {
    const line: Line = [];
    const sep = () => line.length && line.push({ t: 'text', text: ' ' });
    if (e.ussageLimit === 'ultimate effect')
      line.push({ t: 'piece', kind: 'ultimate', label: ULTIMATE_LABEL });
    for (const label of (e.instance ?? '')
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean)) {
      sep();
      line.push({ t: 'piece', kind: 'timing', label });
    }
    if (e.ussageLimit === 'once per turn' || e.ussageLimit === 'once per turn between copies') {
      sep();
      line.push({ t: 'piece', kind: 'condition', label: ONCE });
      if (e.ussageLimit === 'once per turn between copies')
        line.push({ t: 'text', text: ` entre copias${betweenCopiesMark(e)}` });
    }
    for (const b of e.effectBlocks ?? []) {
      const cond = (b.activationCondition ?? '').trim();
      const condPiece = cat.conditions.find((c) => foldChars(c) === foldChars(cond));
      if (cond) {
        sep();
        if (condPiece) line.push({ t: 'piece', kind: 'condition', label: condPiece });
        else line.push(...richSegs(`${cond}:`, cat));
      }
      if (b.cost) {
        sep();
        line.push(...richSegs(`${b.cost.trim()};`, cat));
      }
      if (b.resolution) {
        sep();
        line.push(...richSegs(b.resolution.trim(), cat));
      }
    }
    lines.push(merge(line));
  }
  return lines;
}

/** "entre copias" closes the conditions with a colon, or takes a comma when another condition follows. */
export function betweenCopiesMark(e: CardEffect): string {
  return (e.effectBlocks ?? []).some((b) => (b.activationCondition ?? '').trim()) ? ',' : ':';
}

/** Joins neighbouring text segments. */
function merge(line: Line): Line {
  const out: Line = [];
  for (const s of line) {
    const prev = out[out.length - 1];
    if (s.t === 'text' && prev?.t === 'text') prev.text += s.text;
    else if (!(s.t === 'text' && !s.text)) out.push(s.t === 'text' ? { ...s } : s);
  }
  return out;
}

// ── Typing → pieces ─────────────────────────────────────────────────────────

interface Hit {
  start: number;
  end: number;
  seg: Seg;
}

/** The first label found at `pos` (longest wins), whole words only. `final`: the line may end right after it. */
function labelAt(
  text: string,
  folded: string,
  pos: number,
  labels: { label: string; seg: Seg }[],
  final: boolean,
): Hit | null {
  for (const { label, seg } of labels) {
    const f = foldChars(label);
    if (!folded.startsWith(f, pos)) continue;
    const after = text[pos + f.length];
    if (isLetter(text[pos - 1]) || isLetter(after)) continue;
    if (after === undefined && !final) continue;
    return { start: pos, end: pos + f.length, seg };
  }
  return null;
}

/**
 * Turns typed labels into pieces. At the start of a line (before any plain words): momentos, condiciones, efecto
 * definitivo and keywords. Elsewhere only keywords ("gana Celeridad", "gana celeridad"). A label is replaced once a
 * space or punctuation follows it, or at the end when `final`. "entre copias" after "una vez por turno" stays text and
 * keeps the head open (its colon or comma is the author's: a colon when no other condition follows).
 */
export function splitPieces(line: Line, cat: PieceCatalog, final = false): Line {
  const byLength = <T extends { label: string }>(xs: T[]) =>
    [...xs].sort((a, b) => b.label.length - a.label.length);
  const head = byLength([
    ...cat.timings.map((label) => ({ label, seg: { t: 'piece', kind: 'timing', label } as Seg })),
    ...cat.conditions.map((label) => ({
      label,
      seg: { t: 'piece', kind: 'condition', label } as Seg,
    })),
    { label: ULTIMATE_LABEL, seg: { t: 'piece', kind: 'ultimate', label: ULTIMATE_LABEL } as Seg },
    ...cat.keywords.map((k) => ({
      label: k.label,
      seg: { t: 'piece', kind: 'keyword', label: k.label, key: k.key } as Seg,
    })),
  ]);
  const inline = byLength(
    cat.keywords.map((k) => ({
      label: k.label,
      seg: { t: 'piece', kind: 'keyword', label: k.label, key: k.key } as Seg,
    })),
  );
  // Every piece is read again from its label, so a piece typed in parts joins into the longest label it makes
  // ("por efecto" then "o enfrentamiento"); a keyword written as metadata ("[[Furia {gemas}:1]]") reads as typed.
  // A piece stands apart from its neighbours (the editor keeps no space beside a piece): a space marks it.
  const textOf = (s: Seg | undefined) => (s?.t === 'text' ? s.text : '');
  const flat = line
    .map((s, i) => {
      if (s.t === 'text') return s.text;
      const prev = line[i - 1];
      const before = prev?.t === 'text' && !/\s$/.test(prev.text) ? ' ' : '';
      const next = line[i + 1];
      const after = next && !/^[\s,:;.)]/.test(textOf(next) || 'x') ? ' ' : '';
      return `${before}${s.label}${after}`;
    })
    .join('')
    .replace(/\[\[([^\]:]+)(?::\s*([^\]]*))?\]\]/g, (_, key: string, value?: string) =>
      value?.trim() ? `${baseName(key)} ${value.trim()}` : baseName(key),
    );
  const out: Line = [];
  let inHead = true;
  const text = flat;
  const folded = foldChars(text);
  let pos = 0;
  let from = 0;
  while (pos < text.length) {
    if (/\s/.test(text[pos])) {
      pos++;
      continue;
    }
    // "entre copias" completes "una vez por turno" and keeps the head of the effect open.
    if (inHead && folded.startsWith('entre copias', pos) && !isLetter(text[pos + 12])) {
      pos += 12;
      if (text[pos] === ',' || text[pos] === ':') pos++;
      continue;
    }
    const hit = inHead
      ? labelAt(text, folded, pos, head, final)
      : labelAt(text, folded, pos, inline, final);
    if (hit) {
      if (hit.start > from) out.push({ t: 'text', text: text.slice(from, hit.start) });
      // A keyword keeps its printed capital whatever was typed, and the form that fits its value.
      if (hit.seg.t === 'piece' && hit.seg.kind === 'keyword')
        out.push({ ...hit.seg, key: keywordKey(cat, hit.seg.label, text.slice(hit.end)) });
      else out.push(hit.seg);
      pos = from = hit.end;
      continue;
    }
    // Plain word: the head of the line is over; jump to the next word.
    if (inHead && !/[,:;.]/.test(text[pos])) inHead = false;
    while (pos < text.length && !/\s/.test(text[pos])) pos++;
  }
  if (from < text.length) out.push({ t: 'text', text: text.slice(from) });
  return merge(out);
}

// ── Lines → metadata ────────────────────────────────────────────────────────

/** Segments back to metadata text: keywords as [[Key]] or [[Key:value]]. */
function serialize(segs: Seg[]): string {
  let out = '';
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.t === 'text') out += s.text;
    else if (s.kind === 'keyword') {
      const key = s.key ?? s.label;
      // A value right after a keyword with a {parameter} belongs to it.
      const next = segs[i + 1];
      const m = hasParam(key) && next?.t === 'text' ? VALUE.exec(next.text) : null;
      if (m && next?.t === 'text') {
        out += `[[${key}:${m[1]}]]`;
        segs = [
          ...segs.slice(0, i + 1),
          { t: 'text', text: next.text.slice(m[0].length) },
          ...segs.slice(i + 2),
        ];
      } else out += `[[${key}]]`;
    } else out += s.label;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** First `ch` outside inline keywords ("[[Furia {gemas}:1]]" carries its own colon). */
function outside(text: string, ch: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('[[', i)) depth++;
    else if (text.startsWith(']]', i)) depth = Math.max(0, depth - 1);
    else if (!depth && text[i] === ch) return i;
  }
  return -1;
}

export function linesToEffects(lines: Line[]): {
  effects: CardEffect[];
  keywords: KeywordEffect[];
} {
  const effects: CardEffect[] = [];
  const keywords: KeywordEffect[] = [];
  for (const raw of lines) {
    const line = raw.filter((s) => !(s.t === 'text' && !s.text.trim()));
    if (!line.length) continue;
    const [first, ...rest] = line;
    // A keyword alone (maybe with its value) is the card's own keyword.
    const restText = rest
      .map((s) => (s.t === 'text' ? s.text : '\u0000'))
      .join('')
      .trim();
    if (
      first.t === 'piece' &&
      first.kind === 'keyword' &&
      (!restText || /^(\d+|X|\[[^\]]*\])$/.test(restText))
    ) {
      keywords.push({ keyword: first.key ?? first.label, number: restText || null });
      continue;
    }
    const effect: CardEffect = {};
    const instance: string[] = [];
    let i = 0;
    for (; i < line.length; i++) {
      const s = line[i];
      if (s.t === 'text' && !s.text.trim()) continue;
      if (s.t !== 'piece') break;
      if (s.kind === 'ultimate') effect.ussageLimit = 'ultimate effect';
      else if (s.kind === 'timing') instance.push(s.label);
      else if (s.kind === 'condition' && foldChars(s.label) === ONCE)
        effect.ussageLimit = 'once per turn';
      else break;
    }
    if (instance.length) effect.instance = instance.join('>');
    let body = line.slice(i);
    // "entre copias" right after "una vez por turno".
    if (effect.ussageLimit === 'once per turn' && body[0]?.t === 'text') {
      const m = /^\s*entre copias\s*[,:]?/i.exec(body[0].text);
      if (m) {
        effect.ussageLimit = 'once per turn between copies';
        body = [{ t: 'text', text: body[0].text.slice(m[0].length) }, ...body.slice(1)];
      }
    }
    const block: { activationCondition?: string; cost?: string; resolution?: string } = {};
    const lead = body.find((s) => !(s.t === 'text' && !s.text.trim()));
    let text: string;
    if (lead?.t === 'piece' && lead.kind === 'condition') {
      // A condition piece takes no colon of its own.
      block.activationCondition = lead.label;
      text = serialize(body.slice(body.indexOf(lead) + 1)).replace(/^[:,]\s*/, '');
    } else {
      text = serialize(body);
      const colon = outside(text, ':');
      if (colon >= 0) {
        block.activationCondition = text.slice(0, colon).trim();
        text = text.slice(colon + 1).trim();
      }
    }
    const semi = outside(text, ';');
    if (semi >= 0) {
      block.cost = text.slice(0, semi).trim();
      text = text.slice(semi + 1).trim();
    }
    if (text) block.resolution = text;
    effect.effectBlocks = [block];
    effects.push(effect);
  }
  return { effects, keywords };
}
