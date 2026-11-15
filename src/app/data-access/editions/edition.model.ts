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
}
