import { MetaForm } from '@data/cards/meta-rules';
import { CardDraft, FrameStyle, cardCode } from './render/card-build';

/** The card the editor draws from the metadata form. */
export function draftFromForm(f: MetaForm, her = false): CardDraft {
  return {
    ...f,
    her: her || f.inheritEffects.length > 0 || f.inheritKeywordEffects.length > 0,
    regulation: f.regulation || null,
    requirement: f.requirement || null,
    colors: f.colors.length ? f.colors : f.colorIdentity ? [f.colorIdentity] : [],
  };
}

/** File name of an export: "E1-P04 Albigio". */
export function exportName(f: MetaForm): string {
  const name = (f.cardName || 'carta').replace(/[\\:*?"<>|/]+/g, '').trim();
  return `${cardCode(draftFromForm(f))} ${name}`.trim();
}

/** Card types the editor makes. */
export const CARD_TYPES = {
  creature: 'Criatura',
  utility: 'Utilidad',
  structure: 'Estructura',
} as const;
export type CardType = keyof typeof CARD_TYPES;

/** Changes the card type; only creatures can be link cards. */
export function withCardType(f: MetaForm, cardType: CardType): MetaForm {
  const link = cardType === 'creature' && f.enlace;
  return { ...f, cardType, enlace: link, arrows: link ? f.arrows : [] };
}

/** Turns the link frame on or off; a link card has no inherit frame. */
export function withLink(f: MetaForm, on: boolean): MetaForm {
  return on
    ? { ...f, cardType: 'creature', enlace: true, inheritEffects: [], inheritKeywordEffects: [] }
    : { ...f, enlace: false, arrows: [] };
}

/** Turns the inherit frame off: its effects go with it. */
export function withoutInherit(f: MetaForm): MetaForm {
  return { ...f, inheritEffects: [], inheritKeywordEffects: [] };
}

/** Toggles a color; a card always keeps at least one. */
export function toggleCardColor(f: MetaForm, c: string): MetaForm {
  const colors = f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c];
  if (!colors.length) return f;
  // The code's color letter is the first color's (bicolor cards: "R" for red-white).
  return { ...f, colors, colorIdentity: colors[0] };
}

/** Swaps the two colors of a bicolor card (its code letter follows the first). */
export function swapCardColors(f: MetaForm): MetaForm {
  const colors = [...f.colors].reverse();
  return { ...f, colors, colorIdentity: colors[0] ?? f.colorIdentity };
}

/** The colors the editor shows for a form: its own, else its code's letters, else white. */
export function cardColorsOf(f: MetaForm): string[] {
  if (f.colors.length) return f.colors;
  const fromCode = (f.colorIdentity || '').split('').filter((c) => /[BGPRW]/.test(c));
  return fromCode.length ? fromCode : ['W'];
}

/** Writes a typed code ("E1-B15", "E1.1-P04") into edition, color identity and number. */
export function applyCode(f: MetaForm, raw: string): MetaForm {
  const m = /^\s*([A-Za-z]+\d*(?:\.\d+)?)\s*-\s*([A-Za-z]{1,2})\s*(\d+)\s*$/.exec(raw);
  if (!m) return f;
  return {
    ...f,
    edition: m[1].toUpperCase(),
    colorIdentity: m[2].toUpperCase(),
    cardNumber: Number(m[3]),
  };
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Known classes that contain what was typed (accents ignored), without the ones the card has. */
export function classMatches(query: string, known: string[], current: string[], max = 8): string[] {
  const q = fold(query.trim());
  if (!q) return [];
  return known
    .filter((c) => !current.includes(c) && fold(c).includes(q))
    .sort(
      (a, b) =>
        Number(!fold(a).startsWith(q)) - Number(!fold(b).startsWith(q)) || a.localeCompare(b),
    )
    .slice(0, max);
}

/** The special summon a color usually has (red ascends, blue materializes, violet rituals, green evolves). */
export function defaultSummonKind(f: MetaForm): string {
  const c = f.colors[0] ?? f.colorIdentity ?? 'B';
  return (
    ({ R: 'promotion', P: 'ritual', G: 'evolution' } as Record<string, string>)[c] ??
    'materialization'
  );
}

/** What a draft keeps besides the metadata: frame, extras and the art's framing. */
export interface DraftDesign {
  frameStyle: FrameStyle;
  goldBorder: boolean;
  /** Inherit frame chosen before the card has inherit effects. */
  her: boolean;
  noCost: boolean;
  noStrength: boolean;
  /** The art's zoom and offset (card pixels); null without art. */
  art: { scale: number; x: number; y: number } | null;
}

const FRAMES: FrameStyle[] = ['standard', 'semi', 'full'];

/** A saved design read back, with defaults for anything missing or unknown. */
export function readDesign(raw: Record<string, unknown> | null | undefined): DraftDesign {
  const d = raw ?? {};
  const art = d['art'] as Record<string, unknown> | null | undefined;
  const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
  return {
    frameStyle: FRAMES.includes(d['frameStyle'] as FrameStyle)
      ? (d['frameStyle'] as FrameStyle)
      : 'standard',
    goldBorder: d['goldBorder'] === true,
    her: d['her'] === true,
    noCost: d['noCost'] === true,
    noStrength: d['noStrength'] === true,
    art: art ? { scale: num(art['scale'], 1), x: num(art['x'], 0), y: num(art['y'], 0) } : null,
  };
}

/** Edition and number of a new card typed as "E5-03", "E5 3" or "E1.1-R07" (its color comes from its colors). */
export function parseNewCode(raw: string): { edition: string; cardNumber: number } | null {
  const m = /^\s*([A-Za-z]+\d*(?:\.\d+)?)\s*[-\s]\s*[BGPRW]?\s*(\d{1,3})\s*$/i.exec(raw);
  return m && Number(m[2]) > 0 ? { edition: m[1].toUpperCase(), cardNumber: Number(m[2]) } : null;
}
