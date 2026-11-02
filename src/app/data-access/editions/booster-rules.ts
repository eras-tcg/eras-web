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

/** A pack as it comes out of an opening: its type and its cards, in pull order. */
export interface OpenedPack {
  packType: string;
  cards: CatalogCard[];
}

/** A whole box, pack by pack: FIXED entries, then PROB rolls, then FLEX fills the remaining packs. */
export function openBoxPacks(edition: Edition, pool: Map<string, CatalogCard[]>, random: Random = Math.random): OpenedPack[] {
  const packs = edition.packTypes ?? [];
  const entries = edition.boxConfig?.entries ?? [];
  const total = edition.boxConfig?.totalPacks ?? 0;
  const packNamed = (name: string) => packs.find((p) => p.name === name);
  const opened: OpenedPack[] = [];

  const open = (pack: PackType | undefined, times: number) => {
    if (!pack) return;
    for (let i = 0; i < times; i++) opened.push({ packType: pack.name, cards: openPack(pack, pool, random) });
  };

  for (const entry of entries.filter((e) => e.mode === 'FIXED')) open(packNamed(entry.packTypeName), entry.quantity || 0);
  for (const entry of entries.filter((e) => e.mode === 'PROB')) {
    if (entry.probOptions?.length) open(packNamed(entry.packTypeName), rollQuantity(entry.probOptions, random));
  }
  const flex = entries.find((e) => e.mode === 'FLEX');
  if (flex) open(packNamed(flex.packTypeName), Math.max(0, total - opened.length));
  return opened;
}

/** A whole box, its cards together. */
export function openBox(edition: Edition, pool: Map<string, CatalogCard[]>, random: Random = Math.random): CatalogCard[] {
  return openBoxPacks(edition, pool, random).flatMap((p) => p.cards);
}

/** How special a pack type looks before opening it: none, SR, SEC or GOD (the aura it shows). */
export type PackTier = 'none' | 'sr' | 'sec' | 'god';

const TIER_ORDER: PackTier[] = ['none', 'sr', 'sec', 'god'];

/** GOD: named so, or two secrets or more, or five SR+SEC or more; else SEC or SR by the best rarity it brings. */
export function packTier(pack: Pick<PackType, 'name' | 'cardsPerRarity'> | undefined): PackTier {
  if (!pack) return 'none';
  const sr = pack.cardsPerRarity?.SR ?? 0;
  const sec = pack.cardsPerRarity?.SEC ?? 0;
  if (/\bgod\b/i.test(pack.name) || sec >= 2 || sr + sec >= 5) return 'god';
  if (sec > 0) return 'sec';
  if (sr > 0) return 'sr';
  return 'none';
}

/** Opening order: the plain packs first, the most special last (the suspense grows). Stable inside each tier. */
export function openingOrder<T>(packs: readonly T[], tierOf: (pack: T) => PackTier): T[] {
  return packs
    .map((pack, index) => ({ pack, index, rank: TIER_ORDER.indexOf(tierOf(pack)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((p) => p.pack);
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
