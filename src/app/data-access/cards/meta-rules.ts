import { CardEffect, CardMeta, CatalogCard, DriveCard, KeywordEffect } from './card.model';

/** Editable copy of card metadata. Numbers are null when empty; edition is "E1" or "E1.1". */
export interface MetaForm {
  cardName: string;
  cardType: string | null;
  edition: string;
  colorIdentity: string | null;
  cardNumber: number | null;
  strength: number | null;
  cost: number | null;
  level: number | null;
  starter: boolean;
  cardClasses: string[];
  regulation: string;
  specialCost: number | null;
  specialSummonKind: string | null;
  requirement: string;
  rarity: string | null;
  colors: string[];
  effects: CardEffect[];
  inheritEffects: CardEffect[];
  keywordEffects: KeywordEffect[];
  inheritKeywordEffects: KeywordEffect[];
}

const clone = <T>(v: T): T => structuredClone(v);

export const blankMeta = (edition = ''): MetaForm => ({
  cardName: '',
  cardType: 'creature',
  edition,
  colorIdentity: 'W',
  cardNumber: null,
  strength: null,
  cost: null,
  level: null,
  starter: false,
  cardClasses: [],
  regulation: '',
  specialCost: null,
  specialSummonKind: null,
  requirement: '',
  rarity: null,
  colors: [],
  effects: [],
  inheritEffects: [],
  keywordEffects: [],
  inheritKeywordEffects: [],
});

const editionOf = (d: Pick<DriveCard, 'edition' | 'sub_edition'>) => (d.sub_edition ? `${d.edition}.${d.sub_edition}` : d.edition);

/** Game data copied from another printing with the same name (stats and effects do not change between printings). */
function gameFields(m: CardMeta): Partial<MetaForm> {
  return {
    cardType: m.cardType ?? 'creature',
    strength: m.strength ?? null,
    cost: m.cost ?? null,
    level: m.level ?? null,
    starter: m.starter ?? false,
    cardClasses: [...(m.cardClasses ?? [])],
    regulation: m.regulation ?? '',
    specialCost: m.specialCost ?? null,
    specialSummonKind: m.specialSummonKind ?? null,
    requirement: m.requirement ?? '',
    rarity: m.rarity ?? null,
    effects: clone(m.effects ?? []),
    inheritEffects: clone(m.inheritEffects ?? []),
    keywordEffects: clone(m.keywordEffects ?? []),
    inheritKeywordEffects: clone(m.inheritKeywordEffects ?? []),
  };
}

/** New metadata for an image: identity from the image, game data from a same-name printing when there is one. */
export function metaForImage(image: DriveCard, allMeta: readonly CardMeta[]): MetaForm {
  const name = (image.name ?? '').toLowerCase();
  const sameName = name ? allMeta.find((m) => (m.cardName ?? '').toLowerCase() === name) : undefined;
  return {
    ...blankMeta(),
    ...(sameName ? gameFields(sameName) : {}),
    cardName: image.name ?? '',
    edition: editionOf(image),
    colorIdentity: image.color_identity ?? null,
    cardNumber: image.number ?? null,
    colors: image.color_identity ? [image.color_identity] : [],
  };
}

export function metaFormFor(card: CatalogCard): MetaForm {
  const m = card.meta;
  if (!m) return { ...metaForImage(card, []) };
  return {
    ...blankMeta(),
    ...gameFields(m),
    cardType: m.cardType ?? null,
    cardName: m.cardName ?? card.name ?? '',
    edition: editionOf(card),
    colorIdentity: m.colorIdentity ?? card.color_identity ?? null,
    cardNumber: m.cardNumber ?? card.number ?? null,
    colors: m.colors?.length ? [...m.colors] : m.colorIdentity ? [m.colorIdentity] : [],
  };
}

/** Validation errors; empty when the form can be saved. */
export function validateMeta(f: MetaForm): string[] {
  const errors: string[] = [];
  if (!f.cardName.trim()) errors.push('El nombre es obligatorio.');
  if (!f.edition.trim()) errors.push('La edición es obligatoria.');
  for (const [label, v] of [
    ['Número', f.cardNumber],
    ['Fuerza', f.strength],
    ['Coste', f.cost],
    ['Nivel', f.level],
    ['Coste especial', f.specialCost],
  ] as const) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) errors.push(`${label} debe ser un número positivo.`);
  }
  return errors;
}

/** Body for POST/PUT /api/cards: splits "E1.1" into edition + subEdition and sends empty values as null. */
export function toMetaPayload(f: MetaForm): Omit<CardMeta, 'id'> {
  const [edition, sub] = f.edition.trim().split('.');
  const orNull = (s: string) => s.trim() || null;
  return {
    cardName: f.cardName.trim(),
    cardType: f.cardType || null,
    edition,
    subEdition: sub ?? null,
    colorIdentity: f.colorIdentity || null,
    cardNumber: f.cardNumber,
    strength: f.strength,
    cost: f.cost,
    level: f.level,
    starter: f.starter,
    cardClasses: f.cardClasses,
    regulation: orNull(f.regulation),
    specialCost: f.specialCost,
    specialSummonKind: f.specialSummonKind || null,
    requirement: orNull(f.requirement),
    rarity: f.rarity || null,
    colors: f.colors.length ? f.colors : null,
    effects: f.effects,
    inheritEffects: f.inheritEffects,
    keywordEffects: f.keywordEffects.filter((k) => k.keyword),
    inheritKeywordEffects: f.inheritKeywordEffects.filter((k) => k.keyword),
  };
}

/** "[[Provocar {nivel}:3]]" — the token effect text uses to reference a keyword. */
export function keywordToken(keyword: string, value: string | number | null | undefined): string {
  return value !== null && value !== undefined && value !== '' ? `[[${keyword}:${value}]]` : `[[${keyword}]]`;
}

/** Metadata whose image key (edition, number, sub-edition, color) matches no image, or more than one. */
export function metaWithoutImage(meta: readonly CardMeta[], images: readonly DriveCard[]): CardMeta[] {
  const key = (e: unknown, n: unknown, s: unknown, c: unknown) => `${e ?? ''}|${n ?? ''}|${s ?? ''}|${c ?? ''}`;
  const counts = new Map<string, number>();
  for (const d of images) {
    const k = key(d.edition, d.number, d.sub_edition, d.color_identity);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return meta.filter((m) => counts.get(key(m.edition, m.cardNumber, m.subEdition, m.colorIdentity)) !== 1);
}

/** Metadata pointed at another image: takes its edition, number, sub-edition and color. */
export function assignImage(meta: CardMeta, image: DriveCard): CardMeta {
  return { ...meta, edition: image.edition, cardNumber: image.number, subEdition: image.sub_edition || null, colorIdentity: image.color_identity };
}
