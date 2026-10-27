import { CatalogCard } from '../cards/card.model';
import { Edition, PackType, ProbOption, RARITIES } from './edition.model';

export type OpeningMode = 'pack' | 'box';

/** Rarest first, for showing results. */
export const RARITY_DISPLAY_ORDER = ['SEC', 'SR', 'R', 'UC', 'C'] as const;

export const RARITY_NAMES: Record<string, string> = {
  C: 'Común',
  UC: 'Poco común',
  R: 'Rara',
  SR: 'Súper rara',
  SEC: 'Secreta',
};

type Random = () => number;

/** Cards of an edition ("E1" or "E1.1") that have metadata, grouped by rarity (no rarity counts as C). */
export function cardsByRarity(cards: readonly CatalogCard[], editionId: string): Map<string, CatalogCard[]> {
  const [base, sub = ''] = editionId.split('.');
  const groups = new Map<string, CatalogCard[]>();
  for (const card of cards) {
    if (!card.meta || card.edition !== base || (card.sub_edition ?? '') !== sub) continue;
    const rarity = card.meta.rarity || 'C';
    groups.set(rarity, [...(groups.get(rarity) ?? []), card]);
  }
  return groups;
}

/** Each slot is an independent pick (with replacement), as in the legacy simulator. */
export function openPack(pack: PackType, pool: Map<string, CatalogCard[]>, random: Random = Math.random): CatalogCard[] {
  const picked: CatalogCard[] = [];
  for (const rarity of RARITIES) {
    const candidates = pool.get(rarity) ?? [];
    const n = pack.cardsPerRarity?.[rarity] ?? 0;
    if (!candidates.length) continue;
    for (let i = 0; i < n; i++) picked.push(candidates[Math.floor(random() * candidates.length)]);
  }
  return picked;
}

/** How many packs a PROB entry gives, rolling its probability table. */
export function rollQuantity(options: readonly ProbOption[], random: Random = Math.random): number {
  const roll = random();
  let cumulative = 0;
  for (const option of options) {
    cumulative += Number(option.prob) || 0;
    if (roll <= cumulative) return Math.trunc(Number(option.quantity)) || 0;
  }
  return Math.trunc(Number(options[options.length - 1]?.quantity)) || 0;
}

/** A whole box: FIXED entries, then PROB rolls, then FLEX fills the remaining packs. */
export function openBox(edition: Edition, pool: Map<string, CatalogCard[]>, random: Random = Math.random): CatalogCard[] {
  const packs = edition.packTypes ?? [];
  const entries = edition.boxConfig?.entries ?? [];
  const total = edition.boxConfig?.totalPacks ?? 0;
  const packNamed = (name: string) => packs.find((p) => p.name === name);
  const picked: CatalogCard[] = [];
  let placed = 0;

  const open = (pack: PackType | undefined, times: number) => {
    if (!pack) return;
    for (let i = 0; i < times; i++) picked.push(...openPack(pack, pool, random));
    placed += times;
  };

  for (const entry of entries.filter((e) => e.mode === 'FIXED')) open(packNamed(entry.packTypeName), entry.quantity || 0);
  for (const entry of entries.filter((e) => e.mode === 'PROB')) {
    if (entry.probOptions?.length) open(packNamed(entry.packTypeName), rollQuantity(entry.probOptions, random));
  }
  const flex = entries.find((e) => e.mode === 'FLEX');
  if (flex) open(packNamed(flex.packTypeName), Math.max(0, total - placed));
  return picked;
}

export interface OpenedCard {
  card: CatalogCard;
  rarity: string;
  count: number;
}

export interface RarityGroup {
  rarity: string;
  cards: OpenedCard[];
  count: number;
}

/** Counts repeated pulls and groups them rarest first, by card number inside each rarity. */
export function groupOpening(picked: readonly CatalogCard[]): RarityGroup[] {
  const counts = new Map<string, OpenedCard>();
  for (const card of picked) {
    const current = counts.get(card.id);
    if (current) current.count++;
    else counts.set(card.id, { card, rarity: card.meta?.rarity || 'C', count: 1 });
  }
  return RARITY_DISPLAY_ORDER.map((rarity) => {
    const cards = [...counts.values()].filter((c) => c.rarity === rarity).sort((a, b) => (a.card.number ?? 0) - (b.card.number ?? 0));
    return { rarity, cards, count: cards.reduce((sum, c) => sum + c.count, 0) };
  }).filter((g) => g.cards.length > 0);
}
