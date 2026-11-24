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
  /** A color with its own count (E1: 25 of each color but 5 white); the rest use cardsPerColor. */
  cardsByColor?: Record<string, number> | null;
  /** The regulation its cards print (A…): a new card of the edition starts with it. */
  regulation?: string | null;
  coverFrame?: CoverFrame | null;
  /** Hidden by an admin (still in development): the server lists it only to admins and testers. */
  hidden?: boolean | null;
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
  cardsByColor?: Record<string, number>;
  regulation?: string;
  /** Left out: the server keeps the cover's framing. */
  coverFrame?: CoverFrame;
  /** Left out (the shop's form): the server keeps whether it is hidden. */
  hidden?: boolean;
}
