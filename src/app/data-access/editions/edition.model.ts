export const RARITIES = ['C', 'UC', 'R', 'SR', 'SEC'] as const;
export type RarityCode = (typeof RARITIES)[number];

export type CardsPerRarity = Record<RarityCode, number>;

export interface PackType {
  name: string;
  cardsPerRarity: CardsPerRarity;
}

export type BoxEntryMode = 'FIXED' | 'PROB' | 'FLEX';

export interface ProbOption {
  quantity: number;
  prob: number;
}

export interface BoxEntry {
  packTypeName: string;
  mode: BoxEntryMode;
  quantity: number;
  probOptions: ProbOption[];
}

export interface BoxConfig {
  totalPacks: number;
  entries: BoxEntry[];
}

/**
 * How an edition's cover sits in its card-shaped tile (the image is not cut): the point kept in view, in % of the
 * image (50, 50 = its middle), and how much it is enlarged (1 = it just covers the tile).
 */
export interface CoverFrame {
  x: number;
  y: number;
  zoom: number;
}

/** Edition as returned by GET /api/drive/editions */
export interface Edition {
  editionId: string;
  editionName?: string | null;
  numberOfCards?: number | null;
  editionDescription?: string | null;
  editionImage?: string | null;
  releaseDate?: string | null;
  packTypes?: PackType[] | null;
  boxConfig?: BoxConfig | null;
  /** Its slots: the colors it has and how many cards each ("G" × 18 → G01–G18); null before slots existed. */
  colors?: string[] | null;
  cardsPerColor?: number | null;
  coverFrame?: CoverFrame | null;
}

/** Body of POST /api/drive/editions (create or update by editionId). */
export interface EditionSaveRequest {
  editionId: string;
  editionName: string;
  numberOfCards: number;
  editionDescription: string;
  /** Drive file id of a new image; empty keeps the current one. */
  editionImage: string;
  releaseDate: string;
  packTypes: PackType[];
  boxConfig: BoxConfig;
  /** Left out (the shop's form): the server keeps the edition's slots. */
  colors?: string[];
  cardsPerColor?: number;
  /** Left out: the server keeps the cover's framing. */
  coverFrame?: CoverFrame;
}
