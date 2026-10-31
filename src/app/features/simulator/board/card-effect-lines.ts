import { renderEffect, renderKeywordEffect, usageLimitLabel } from '@data/cards/card-rules';
import { CardEffect, CardRefData, KeywordEffect } from '@data/cards/card.model';

/** An effect for display: its moment ("Al Atacar") and tags ("una vez por turno") apart from its text. */
export interface EffectLine {
  moment: string | null;
  tags: string[];
  text: string;
}

/** The effects and keyword abilities as lines: the moment and the usage limit come from the card's data. */
export function effectLines(effects: CardEffect[] | null | undefined, keywords: KeywordEffect[] | null | undefined, ref: CardRefData | null): EffectLine[] {
  const text = (l: { segments: { text: string }[] }) => l.segments.map((x) => x.text).join('').trim();
  return [
    ...(effects ?? []).map((e) => ({
      moment: e.instance ?? null,
      tags: [usageLimitLabel(e.ussageLimit)].filter((t): t is string => !!t),
      text: text(renderEffect(e, ref, false)),
    })),
    ...(keywords ?? []).map((k) => ({ moment: null, tags: [], text: text(renderKeywordEffect(k, ref)) })),
  ].filter((l) => l.text);
}

const words = (text: string) => text.toLowerCase().normalize('NFD').replace(/[^a-zñ0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);

/**
 * Which of the lines is the effect with this text (the server words it its own way, maybe with its moment first):
 * the line that shares most of its words, or -1 when none is close.
 */
export function matchingLine(lines: EffectLine[], text: string | null | undefined): number {
  if (!text) return -1;
  const wanted = new Set(words(text));
  if (!wanted.size) return -1;
  let best = -1;
  let bestScore = 0.5;
  lines.forEach((l, i) => {
    const own = words(l.text);
    if (!own.length) return;
    const score = own.filter((w) => wanted.has(w)).length / own.length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
