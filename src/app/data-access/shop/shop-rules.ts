import { BoxEntry, Edition } from '../editions/edition.model';
import { canSimulateBox, canSimulatePack } from '../editions/edition-rules';

// Prices in the Editions shop, in simulated gems (the wallet: core/wallet)

/** Any pack, of any edition (a random pack of a box too). */
export const PACK_PRICE = 100;
/** A booster box of an edition (E1, E2…) and of a sub-edition (E1.1, E1.2…). */
export const BOX_PRICE = 2400;
export const SUB_EDITION_BOX_PRICE = 1200;
/** A structure deck (ST1, ST2…), whole. */
export const STRUCTURE_PRICE = 500;

/** A structure deck has an ST code (ST1, ST2…): it sells itself whole, not in packs. */
export function isStructure(editionId: string): boolean {
  return editionId.toUpperCase().startsWith('ST');
}

/** A sub-edition has a dotted code (E1.1, E1.2…); editions and structures do not (E1, ST1…). */
export function isSubEdition(editionId: string): boolean {
  return editionId.includes('.');
}

export type ProductKind = 'pack' | 'box' | 'structure';

export interface ShopProduct {
  kind: ProductKind;
  name: string;
  price: number;
  /** box: packs inside. */
  packs?: number;
}

/** Price of an edition's booster box: less for a sub-edition. */
export function boxPrice(editionId: string): number {
  return isSubEdition(editionId) ? SUB_EDITION_BOX_PRICE : BOX_PRICE;
}

/**
 * What an edition sells: a structure deck, itself whole; any other edition, a pack (its type drawn at random, see
 * packOdds) and, with a box configured, the booster box. Never a chosen pack type: the point of buying is not
 * knowing which one comes.
 */
export function shopProducts(edition: Edition): ShopProduct[] {
  if (isStructure(edition.editionId)) return [{ kind: 'structure', name: 'Structure deck', price: STRUCTURE_PRICE }];
  if (!canSimulatePack(edition)) return [];
  const products: ShopProduct[] = [{ kind: 'pack', name: 'Sobre', price: PACK_PRICE }];
  const packs = edition.boxConfig?.totalPacks ?? 0;
  if (canSimulateBox(edition) && packs > 0) products.push({ kind: 'box', name: 'Booster box', price: boxPrice(edition.editionId), packs });
  return products;
}

export interface PackOdds {
  packType: string;
  /** 0..1 */
  probability: number;
}

/** Every way the PROB entries can roll, with its probability and how many packs each one gives. */
function probOutcomes(entries: readonly BoxEntry[]): { probability: number; quantities: number[] }[] {
  let outcomes = [{ probability: 1, quantities: [] as number[] }];
  for (const entry of entries) {
    const options = entry.probOptions.length ? entry.probOptions : [{ quantity: 0, prob: 1 }];
    outcomes = outcomes.flatMap((o) =>
      options.map((option) => ({ probability: o.probability * (Number(option.prob) || 0), quantities: [...o.quantities, Math.trunc(Number(option.quantity)) || 0] })),
    );
  }
  return outcomes.filter((o) => o.probability > 0);
}

/**
 * Chance that a pack bought alone is of each type: the same as drawing one pack at random from a whole box
 * (as pickRandomPackFromBox does), counted exactly over every roll of the PROB entries. Without a box, the
 * first pack type always.
 */
export function packOdds(edition: Edition): PackOdds[] {
  const types = (edition.packTypes ?? []).map((p) => p.name);
  const entries = edition.boxConfig?.entries ?? [];
  const total = edition.boxConfig?.totalPacks ?? 0;
  if (!types.length) return [];
  if (!total || !entries.length) return types.map((t, i) => ({ packType: t, probability: i === 0 ? 1 : 0 }));

  const fixed = entries.filter((e) => e.mode === 'FIXED');
  const prob = entries.filter((e) => e.mode === 'PROB');
  const flex = entries.find((e) => e.mode === 'FLEX');
  const odds = new Map(types.map((t) => [t, 0]));

  for (const outcome of probOutcomes(prob)) {
    const counts = new Map<string, number>();
    const add = (type: string, n: number) => counts.set(type, (counts.get(type) ?? 0) + n);
    fixed.forEach((e) => add(e.packTypeName, Math.trunc(Number(e.quantity)) || 0));
    prob.forEach((e, i) => add(e.packTypeName, outcome.quantities[i]));
    const placed = [...counts.values()].reduce((a, b) => a + b, 0);
    if (flex) add(flex.packTypeName, Math.max(0, total - placed));
    const size = [...counts.values()].reduce((a, b) => a + b, 0);
    if (!size) continue;
    for (const [type, n] of counts) odds.set(type, (odds.get(type) ?? 0) + (outcome.probability * n) / size);
  }
  return [...odds].map(([packType, probability]) => ({ packType, probability }));
}

export interface BoxContent {
  packType: string;
  /** Packs of this type in a box: always `min` when it is fixed. */
  min: number;
  max: number;
  /** A PROB entry: how many, with what chance. */
  options?: { quantity: number; probability: number }[];
}

/** How many packs of each type a booster box brings (a FLEX entry fills what the others leave). */
export function boxContents(edition: Edition): BoxContent[] {
  const entries = edition.boxConfig?.entries ?? [];
  const total = edition.boxConfig?.totalPacks ?? 0;
  const quantity = (n: unknown) => Math.trunc(Number(n)) || 0;
  const fixedSum = entries.filter((e) => e.mode === 'FIXED').reduce((sum, e) => sum + quantity(e.quantity), 0);
  const probRange = entries
    .filter((e) => e.mode === 'PROB')
    .map((e) => e.probOptions.map((o) => quantity(o.quantity)))
    .filter((q) => q.length);
  const probMin = probRange.reduce((sum, q) => sum + Math.min(...q), 0);
  const probMax = probRange.reduce((sum, q) => sum + Math.max(...q), 0);

  return entries.map((e): BoxContent => {
    if (e.mode === 'FIXED') return { packType: e.packTypeName, min: quantity(e.quantity), max: quantity(e.quantity) };
    if (e.mode === 'PROB') {
      const q = e.probOptions.map((o) => quantity(o.quantity));
      return {
        packType: e.packTypeName,
        min: q.length ? Math.min(...q) : 0,
        max: q.length ? Math.max(...q) : 0,
        options: e.probOptions.map((o) => ({ quantity: quantity(o.quantity), probability: Number(o.prob) || 0 })),
      };
    }
    return { packType: e.packTypeName, min: Math.max(0, total - fixedSum - probMax), max: Math.max(0, total - fixedSum - probMin) };
  });
}

/** An opening as /booster-result describes it (its query: mode pack | box | structure and, for a pack, the type that came out). */
export interface OpeningRequest {
  mode: string;
  packType?: string;
}

/** The product an opening belongs to (null when the edition does not sell it). */
export function productFor(edition: Edition, request: OpeningRequest): ShopProduct | null {
  const kind = request.mode === 'box' || request.mode === 'structure' ? request.mode : 'pack';
  return shopProducts(edition).find((p) => p.kind === kind) ?? null;
}

/** The query that opens `product` (a pack's type is drawn by the server, and the opening learns it then). */
export function openingQuery(edition: Edition, product: ShopProduct): OpeningRequest & { edition: string } {
  return { edition: edition.editionId, mode: product.kind };
}
