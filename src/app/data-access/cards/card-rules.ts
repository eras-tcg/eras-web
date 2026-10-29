import { CARD_COLORS, CARD_RARITIES, CardEffect, CardMeta, CardRefData, CatalogCard, DriveCard, KeywordEffect } from './card.model';

const metaKey = (edition: string | null | undefined, number: number | null | undefined, sub: string | null | undefined, color: string | null | undefined) =>
  `${edition ?? ''}|${number ?? ''}|${sub ?? ''}|${color ?? ''}`;

/** Joins every image with its metadata by edition + number + sub-edition + color. */
export function mergeCards(drive: readonly DriveCard[], meta: readonly CardMeta[]): CatalogCard[] {
  const byKey = new Map<string, CardMeta>();
  for (const m of meta) {
    if (m.edition && m.cardNumber != null) byKey.set(metaKey(m.edition, m.cardNumber, m.subEdition, m.colorIdentity), m);
  }
  return drive.map((d) => ({ ...d, meta: byKey.get(metaKey(d.edition, d.number, d.sub_edition, d.color_identity)) ?? null }));
}

/** Image URL with a cache-buster, so a replaced image is not served from cache. */
export function cardImageUrl(card: Pick<DriveCard, 'image_url' | 'time_stamp'>): string | null {
  if (!card.image_url) return null;
  const version = card.time_stamp ? new Date(card.time_stamp).getTime() : 0;
  return version ? `${card.image_url}?v=${version}` : card.image_url;
}

/** "E1" or "E1.1" — the id editions use. */
export function fullEditionId(card: Pick<DriveCard, 'edition' | 'sub_edition'>): string {
  return card.sub_edition ? `${card.edition}.${card.sub_edition}` : card.edition;
}

/** Keeps one card per name: the one from the most recently released edition. Unnamed cards are all kept. */
export function collapseByName(cards: readonly CatalogCard[], releaseDates: ReadonlyMap<string, string>): CatalogCard[] {
  const newest = new Map<string, CatalogCard>();
  for (const card of cards) {
    const name = (card.name ?? '').toLowerCase();
    if (!name) continue;
    const current = newest.get(name);
    if (!current || (releaseDates.get(fullEditionId(card)) ?? '') > (releaseDates.get(fullEditionId(current)) ?? '')) {
      newest.set(name, card);
    }
  }
  const winners = new Set([...newest.values()].map((c) => c.id));
  return cards.filter((c) => !c.name || winners.has(c.id));
}

/** Every printing of the card's name, newest edition first. */
export function nameVariants(card: CatalogCard, all: readonly CatalogCard[], releaseDates: ReadonlyMap<string, string>): CatalogCard[] {
  const name = (card.name ?? '').toLowerCase();
  if (!name) return [card];
  return all
    .filter((c) => (c.name ?? '').toLowerCase() === name)
    .sort((a, b) => (releaseDates.get(fullEditionId(b)) ?? '').localeCompare(releaseDates.get(fullEditionId(a)) ?? ''));
}

const sortedUnique = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))].sort();
const maxOf = (meta: readonly CardMeta[], pick: (m: CardMeta) => number | null | undefined) =>
  meta.reduce((max, m) => Math.max(max, pick(m) ?? 0), 0);

export interface FilterOptions {
  colors: string[];
  rarities: string[];
  types: string[];
  specialSummons: string[];
  classes: string[];
  keywords: string[];
  tags: string[];
  maxCost: number;
  maxLevel: number;
  maxStrength: number;
  maxSpecialCost: number;
}

/** Values the filters can take, derived from the loaded data. */
export function filterOptions(cards: readonly CatalogCard[], meta: readonly CardMeta[], ref: CardRefData | null): FilterOptions {
  const colors = new Set(cards.map((c) => c.color_identity));
  const rarities = new Set(meta.map((m) => m.rarity));
  return {
    colors: CARD_COLORS.filter((c) => colors.has(c)),
    rarities: CARD_RARITIES.filter((r) => rarities.has(r)),
    types: sortedUnique(meta.map((m) => m.cardType)),
    specialSummons: sortedUnique(meta.map((m) => m.specialSummonKind)),
    classes: [...(ref?.classes ?? [])].sort(),
    keywords: Object.keys(ref?.keywordEffects ?? {}).sort(),
    tags: [...(ref?.tags ?? [])].sort(),
    maxCost: maxOf(meta, (m) => m.cost),
    maxLevel: maxOf(meta, (m) => m.level),
    maxStrength: maxOf(meta, (m) => m.strength),
    maxSpecialCost: maxOf(meta, (m) => m.specialCost),
  };
}

// ── Effect text ──────────────────────────────────────────────────────────────
// Effects are rendered as plain segments (never HTML), so card text cannot inject markup.

export type EffectSegmentKind = 'text' | 'keyword' | 'note';
export interface EffectSegment {
  kind: EffectSegmentKind;
  text: string;
}
export interface EffectLine {
  segments: EffectSegment[];
  tags: string[];
}

const USAGE_LIMIT_TEXT: Record<string, string> = {
  'once per turn': '[una vez por turno]',
  'once per turn between copies': '[una vez por turno] entre copias,',
  'ultimate effect': '[efecto definitivo]',
};

const PLACEHOLDER = /\{[^}]+\}/;

/** Reference description of a keyword. Cards store "Provocar {nivel}" while the reference key is "Provocar". */
function keywordDescription(keyword: string, ref: CardRefData | null): string | null {
  const refs = ref?.keywordEffects ?? {};
  const entry = refs[keyword] ?? refs[keyword.replace(PLACEHOLDER, '').trim()];
  return entry?.displayText || null;
}

const fill = (text: string, value: string | number | null | undefined, all = false) =>
  value == null || value === '' ? text : text.replace(all ? new RegExp(PLACEHOLDER, 'g') : PLACEHOLDER, String(value));

/** Splits "text [[Keyword:3]] more" into text and keyword segments; returns the keywords found. */
function tokenize(text: string, out: EffectSegment[], found: { keyword: string; value: string | null; rendered: string }[]): void {
  const token = /\[\[([^\]:]+)(?::([^\]]*))?\]\]/g;
  let last = 0;
  for (const match of text.matchAll(token)) {
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) });
    const [, keyword, value] = match;
    const rendered = fill(keyword, value);
    out.push({ kind: 'keyword', text: rendered });
    found.push({ keyword, value: value || null, rendered });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
}

/** The usage limit as words ("una vez por turno"), for a label; null without one. */
export function usageLimitLabel(limit: string | null | undefined): string | null {
  const text = USAGE_LIMIT_TEXT[limit ?? ''];
  return text ? text.replace(/[[\],]/g, '').replace(/\s+/g, ' ').trim() : null;
}

/**
 * An effect's text. With {@code withHeading} false it leaves out its moment and usage limit ("<Al Atacar> [una vez
 * por turno]"), for a view that shows them apart.
 */
export function renderEffect(effect: CardEffect, ref: CardRefData | null, withHeading = true): EffectLine {
  const segments: EffectSegment[] = [];
  const prefix = withHeading
    ? [effect.instance ? `<${effect.instance}>` : '', USAGE_LIMIT_TEXT[effect.ussageLimit ?? ''] ?? ''].filter(Boolean).join(' ')
    : '';
  if (prefix) segments.push({ kind: 'text', text: prefix + ' ' });

  for (const block of effect.effectBlocks ?? []) {
    const found: { keyword: string; value: string | null; rendered: string }[] = [];
    const parts: [string | null | undefined, string][] = [
      [block.activationCondition, ': '],
      [block.cost, '; '],
      [block.resolution, ''],
    ];
    const before = segments.length;
    for (const [text, separator] of parts) {
      if (!text) continue;
      tokenize(text, segments, found);
      if (separator) segments.push({ kind: 'text', text: separator });
    }
    if (segments.length === before) continue;
    for (const { keyword, value, rendered } of found) {
      const description = keywordDescription(keyword, ref);
      if (description) segments.push({ kind: 'note', text: ` (${rendered}: ${fill(description, value)})` });
    }
    segments.push({ kind: 'text', text: ' ' });
  }

  const trimmed = trimSegments(segments);
  return { segments: trimmed.length ? trimmed : [{ kind: 'text', text: 'efecto vacío' }], tags: effect.tags ?? [] };
}

export function renderKeywordEffect(effect: KeywordEffect, ref: CardRefData | null): EffectLine {
  if (!effect.keyword) return { segments: [], tags: [] };
  const segments: EffectSegment[] = [{ kind: 'keyword', text: fill(effect.keyword, effect.number) }];
  const description = keywordDescription(effect.keyword, ref);
  if (description) segments.push({ kind: 'note', text: ` (${fill(description, effect.number, true)})` });
  return { segments, tags: [] };
}

function trimSegments(segments: EffectSegment[]): EffectSegment[] {
  const out = segments.filter((s) => s.text !== '');
  while (out.length && out[out.length - 1].kind === 'text' && !out[out.length - 1].text.trim()) out.pop();
  if (out.length && out[out.length - 1].kind === 'text') {
    out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.trimEnd() };
  }
  return out;
}
