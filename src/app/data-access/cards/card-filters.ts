import { CatalogCard } from './card.model';

export type ColorMatchMode = 'any' | 'identity';
export type CardSortKey = 'number' | 'name' | 'cost' | 'level' | 'strength';
export type SortDirection = 'asc' | 'desc';

/** A numeric range; `null` bounds mean "no limit on this side". */
export interface NumberRange {
  min: number | null;
  max: number | null;
}

export interface CardFilters {
  name: string;
  type: string;
  /** Empty = every color. */
  colors: string[];
  colorMode: ColorMatchMode;
  classes: string[];
  cost: NumberRange;
  level: NumberRange;
  strength: NumberRange;
  specialCost: NumberRange;
  specialSummon: string;
  requirement: string;
  /** Edition id, "E1" or "E1.1"; empty = all. */
  edition: string;
  cardNumber: string;
  /** Only used when no edition is selected. `null` = all, '' = main set only. */
  subEdition: string | null;
  rarities: string[];
  starterOnly: boolean;
  keywords: string[];
  tags: string[];
}

export const NO_RANGE: NumberRange = { min: null, max: null };

export const EMPTY_FILTERS: CardFilters = {
  name: '',
  type: '',
  colors: [],
  colorMode: 'any',
  classes: [],
  cost: NO_RANGE,
  level: NO_RANGE,
  strength: NO_RANGE,
  specialCost: NO_RANGE,
  specialSummon: '',
  requirement: '',
  edition: '',
  cardNumber: '',
  subEdition: null,
  rarities: [],
  starterOnly: false,
  keywords: [],
  tags: [],
};

const isRangeSet = (r: NumberRange) => r.min !== null || r.max !== null;

export function hasActiveFilters(f: CardFilters): boolean {
  return (
    !!(f.name || f.type || f.specialSummon || f.requirement || f.edition || f.cardNumber || f.starterOnly) ||
    f.subEdition !== null ||
    [f.colors, f.classes, f.rarities, f.keywords, f.tags].some((list) => list.length > 0) ||
    [f.cost, f.level, f.strength, f.specialCost].some(isRangeSet)
  );
}

/** Case-insensitive regex search; an invalid pattern falls back to a plain substring match. */
function matchesPattern(pattern: string, value: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, 'i').test(value);
  } catch {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

/** Cards without the attribute pass, as in the legacy page (a structure has no strength, etc.). */
function inRange(value: number | null | undefined, range: NumberRange): boolean {
  if (!isRangeSet(range) || value == null) return true;
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

function matchesEdition(card: CatalogCard, f: CardFilters): boolean {
  if (f.edition) {
    const [base, sub] = f.edition.split('.');
    return card.edition === base && (card.sub_edition ?? '') === (sub ?? '');
  }
  if (f.subEdition === null) return true;
  return (card.sub_edition ?? '') === f.subEdition;
}

function matchesColor(card: CatalogCard, f: CardFilters): boolean {
  if (!f.colors.length) return true;
  const colors = f.colorMode === 'identity' ? [card.color_identity] : [card.color_identity, ...(card.meta?.colors ?? [])];
  const known = colors.filter((c): c is string => !!c);
  return !known.length || known.some((c) => f.colors.includes(c));
}

function matchesKeywords(card: CatalogCard, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const meta = card.meta;
  const keywordEffects = [...(meta?.keywordEffects ?? []), ...(meta?.inheritKeywordEffects ?? [])];
  const texts = [...(meta?.effects ?? []), ...(meta?.inheritEffects ?? [])]
    .flatMap((e) => e.effectBlocks ?? [])
    .flatMap((b) => [b.activationCondition, b.cost, b.resolution])
    .filter((t): t is string => !!t)
    .map((t) => t.toLowerCase());
  return keywords.some(
    (kw) =>
      keywordEffects.some((ke) => ke.keyword === kw || ke.keyword?.startsWith(kw + ' ')) ||
      texts.some((t) => t.includes(kw.toLowerCase())),
  );
}

function matchesTags(card: CatalogCard, tags: string[]): boolean {
  if (!tags.length) return true;
  return [...(card.meta?.effects ?? []), ...(card.meta?.inheritEffects ?? [])].some((e) => e.tags?.some((t) => tags.includes(t)));
}

/**
 * Applies every filter. `includeWithoutMeta` shows images that have no metadata yet
 * (only people who can create it need to see them).
 */
export function filterCards(cards: readonly CatalogCard[], f: CardFilters, includeWithoutMeta: boolean): CatalogCard[] {
  return cards.filter((card) => {
    const m = card.meta;
    if (!m && !includeWithoutMeta) return false;
    if (!matchesEdition(card, f)) return false;
    if (!matchesPattern(f.name, card.name ?? '')) return false;
    if (f.type && m?.cardType?.toLowerCase() !== f.type.toLowerCase()) return false;
    if (!matchesColor(card, f)) return false;
    if (f.classes.length && !m?.cardClasses?.some((c) => f.classes.includes(c))) return false;
    if (!inRange(m?.cost, f.cost) || !inRange(m?.level, f.level) || !inRange(m?.strength, f.strength)) return false;
    // Unlike the other ranges, filtering by special cost hides cards that have none
    if (isRangeSet(f.specialCost) && (m?.specialCost == null || !inRange(m.specialCost, f.specialCost))) return false;
    if (f.specialSummon && m?.specialSummonKind !== f.specialSummon) return false;
    if (!matchesPattern(f.requirement, m?.requirement ?? '')) return false;
    if (!matchesPattern(f.cardNumber, String(card.number ?? ''))) return false;
    if (f.rarities.length && !f.rarities.includes(m?.rarity ?? '')) return false;
    if (f.starterOnly && m?.starter !== true) return false;
    return matchesKeywords(card, f.keywords) && matchesTags(card, f.tags);
  });
}

function sortValue(card: CatalogCard, key: CardSortKey): string | number {
  switch (key) {
    case 'name':
      return (card.name ?? '').toLowerCase();
    case 'cost':
      return card.meta?.cost ?? Infinity;
    case 'level':
      return card.meta?.level ?? Infinity;
    case 'strength':
      return card.meta?.strength ?? Infinity;
    default:
      return card.number ?? Infinity;
  }
}

export function sortCards(cards: readonly CatalogCard[], key: CardSortKey, direction: SortDirection): CatalogCard[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === vb) return 0;
    const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : va < vb ? -1 : 1;
    return cmp * sign;
  });
}
