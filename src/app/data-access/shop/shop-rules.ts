import { RarityCode, Edition, RARITIES } from '../editions/edition.model';
import { canSimulateBox, canSimulatePack } from '../editions/edition-rules';

/**
 * The Editions shop runs on simulated gems: there is no money on the platform. Every account starts with a
 * balance on each device and gets a daily reward; packs and boxes cost gems and open with the existing rules.
 */
export const STARTING_GEMS = 2400;
export const DAILY_GEMS = 300;
/** Any pack, of any edition (a random pack of a box too). */
export const PACK_PRICE = 100;
/** A booster box of an edition (E1, E2…) and of a sub-edition (E1.1, E1.2…). */
export const BOX_PRICE = 2400;
export const SUB_EDITION_BOX_PRICE = 1200;

export interface Wallet {
  gems: number;
  /** Day (YYYY-MM-DD, local time) of the last daily reward. */
  lastReward: string;
}

/** Local calendar day of `date`, as YYYY-MM-DD. */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The wallet as of `today`: a new one starts with the starting gems (that day's reward included); an existing
 * one gets the daily reward once per day. `reward` is what was just added (0 when nothing was).
 */
export function openWallet(saved: Wallet | null, today: string): { wallet: Wallet; reward: number } {
  if (!saved || !Number.isFinite(saved.gems)) return { wallet: { gems: STARTING_GEMS, lastReward: today }, reward: 0 };
  if (saved.lastReward === today) return { wallet: saved, reward: 0 };
  return { wallet: { gems: Math.max(0, saved.gems) + DAILY_GEMS, lastReward: today }, reward: DAILY_GEMS };
}

/** The wallet after paying `price`, or null when the gems do not reach. */
export function spend(wallet: Wallet, price: number): Wallet | null {
  return price <= wallet.gems ? { ...wallet, gems: wallet.gems - price } : null;
}

/** A sub-edition has a dotted code (E1.1, E1.2…); editions and structures do not (E1, ST1…). */
export function isSubEdition(editionId: string): boolean {
  return editionId.includes('.');
}

export type ProductKind = 'pack' | 'random' | 'box';

export interface ShopProduct {
  /** Unique within its edition. */
  id: string;
  kind: ProductKind;
  name: string;
  price: number;
  /** pack: its pack type. */
  packType?: string;
  /** pack: cards of each rarity, only the rarities it has. */
  contents?: { rarity: RarityCode; count: number }[];
  /** box: packs inside. */
  packs?: number;
}

/** Price of an edition's booster box: less for a sub-edition. */
export function boxPrice(editionId: string): number {
  return isSubEdition(editionId) ? SUB_EDITION_BOX_PRICE : BOX_PRICE;
}

/** What an edition sells: one product per pack type, and with a box configured a random pack of it and the box. */
export function shopProducts(edition: Edition): ShopProduct[] {
  if (!canSimulatePack(edition)) return [];
  const products: ShopProduct[] = (edition.packTypes ?? []).map((pack) => ({
    id: `pack:${pack.name}`,
    kind: 'pack',
    name: `Sobre ${pack.name}`,
    price: PACK_PRICE,
    packType: pack.name,
    contents: RARITIES.filter((r) => (pack.cardsPerRarity[r] ?? 0) > 0).map((r) => ({ rarity: r, count: pack.cardsPerRarity[r] })),
  }));
  if (canSimulateBox(edition)) {
    const packs = edition.boxConfig?.totalPacks ?? 0;
    products.push({ id: 'random', kind: 'random', name: 'Sobre al azar de una caja', price: PACK_PRICE });
    if (packs > 0) products.push({ id: 'box', kind: 'box', name: `Caja de ${packs} sobres`, price: boxPrice(edition.editionId), packs });
  }
  return products;
}

/** An opening as /booster-result describes it (its query: mode, pack type, random pack of a box). */
export interface OpeningRequest {
  mode: string;
  packType?: string;
  random?: string;
}

/** The product an opening belongs to (null when the edition does not sell it). */
export function productFor(edition: Edition, request: OpeningRequest): ShopProduct | null {
  const products = shopProducts(edition);
  if (request.mode === 'box') return products.find((p) => p.kind === 'box') ?? null;
  if (request.random === '1') return products.find((p) => p.kind === 'random') ?? null;
  return products.find((p) => p.kind === 'pack' && p.packType === request.packType) ?? null;
}

/** The query that opens `product` (a random pack of a box draws its pack type with `pickPack`). */
export function openingQuery(edition: Edition, product: ShopProduct, pickPack: () => string): OpeningRequest & { edition: string } {
  const base = { edition: edition.editionId };
  if (product.kind === 'box') return { ...base, mode: 'box' };
  if (product.kind === 'random') return { ...base, mode: 'pack', packType: pickPack(), random: '1' };
  return { ...base, mode: 'pack', packType: product.packType ?? '' };
}

