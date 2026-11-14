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

/** The seven card kinds the editor offers (type, inherit frame, link). */
export const CARD_KINDS = {
  creature: 'Criatura',
  'creature-her': 'Criatura con heredado',
  link: 'Criatura enlace',
  utility: 'Utilidad',
  'utility-her': 'Utilidad con heredado',
  structure: 'Estructura',
  'structure-her': 'Estructura con heredado',
} as const;
export type CardKind = keyof typeof CARD_KINDS;

/** Kind of a card from its form and the inherit flag. */
export function cardKindOf(f: MetaForm, her: boolean): CardKind {
  if (f.enlace) return 'link';
  const base = (f.cardType || 'creature') as 'creature' | 'utility' | 'structure';
  return her ? (`${base}-her` as CardKind) : base;
}

/** Form and inherit flag for a chosen kind. */
export function applyCardKind(f: MetaForm, kind: CardKind): { form: MetaForm; her: boolean } {
  const link = kind === 'link';
  const cardType = link ? 'creature' : kind.replace('-her', '');
  return {
    form: { ...f, cardType, enlace: link, arrows: link ? f.arrows : [] },
    her: kind.endsWith('-her'),
  };
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
