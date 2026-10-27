export const CARD_COLORS = ['B', 'G', 'P', 'R', 'W'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const CARD_RARITIES = ['C', 'UC', 'R', 'SR', 'SEC'] as const;

/** Card image record, GET /api/drive/cards/db (snake_case comes from the backend). */
export interface DriveCard {
  id: string;
  name: string | null;
  edition: string;
  sub_edition: string | null;
  number: number | null;
  color_identity: string | null;
  image_url: string | null;
  time_stamp: string | null;
  file_name?: string;
}

export interface EffectBlock {
  activationCondition?: string | null;
  cost?: string | null;
  resolution?: string | null;
}

export interface CardEffect {
  instance?: string | null;
  ussageLimit?: string | null;
  effectBlocks?: EffectBlock[] | null;
  kind?: string | null;
  tags?: string[] | null;
}

export interface KeywordEffect {
  keyword: string | null;
  number?: string | number | null;
}

/** Card metadata, GET /api/cards/search */
export interface CardMeta {
  id: string;
  cardName?: string | null;
  cardType?: string | null;
  strength?: number | null;
  cost?: number | null;
  level?: number | null;
  starter?: boolean | null;
  cardClasses?: string[] | null;
  edition?: string | null;
  subEdition?: string | null;
  colorIdentity?: string | null;
  cardNumber?: number | null;
  regulation?: string | null;
  effects?: CardEffect[] | null;
  inheritEffects?: CardEffect[] | null;
  keywordEffects?: KeywordEffect[] | null;
  inheritKeywordEffects?: KeywordEffect[] | null;
  specialCost?: number | null;
  specialSummonKind?: string | null;
  requirement?: string | null;
  rarity?: string | null;
  colors?: string[] | null;
}

/** Reference data, GET /api/cards/ref */
export interface CardRefData {
  classes?: string[];
  instances?: string[];
  kinds?: string[];
  tags?: string[];
  keywordEffects?: Record<string, { keyword?: string; displayText?: string | null } | undefined>;
}

/** A card image joined with its metadata (null when it has none yet). */
export interface CatalogCard extends DriveCard {
  meta: CardMeta | null;
}

export const CARD_TYPE_LABELS: Record<string, string> = {
  creature: 'Criatura',
  utility: 'Utilidad',
  structure: 'Estructura',
};

export const SPECIAL_SUMMON_LABELS: Record<string, string> = {
  materialization: 'Materialización',
  promotion: 'Ascenso',
  ritual: 'Ritual',
  evolution: 'Evolución',
};

export const COLOR_LABELS: Record<string, string> = {
  B: 'Azul',
  G: 'Verde',
  P: 'Violeta',
  R: 'Rojo',
  W: 'Blanco',
};
