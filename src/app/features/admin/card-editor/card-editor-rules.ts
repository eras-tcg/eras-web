import { MetaForm } from '@data/cards/meta-rules';
import { CardDraft, cardCode } from './render/card-build';

/** The card the editor draws from the metadata form. */
export function draftFromForm(f: MetaForm): CardDraft {
  return {
    ...f,
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
