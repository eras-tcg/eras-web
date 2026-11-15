import { MetaForm } from '@data/cards/meta-rules';
import { CardDraft, cardCode } from './render/card-build';

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
  // The code's color letters follow the card's colors.
  return { ...f, colors, colorIdentity: colors.join('') };
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
