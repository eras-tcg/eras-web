/** A card instance in a game (DriveManager simulator CardSlot). */
export interface CardSlot {
  instanceId: string;
  cardId: string;
  imageUrl: string | null;
  faceDown: boolean;
  tapped: boolean;
  /** Field position in % of the field area (own perspective). */
  x: number | null;
  y: number | null;
  cardName: string | null;
  cardType: string | null;
  strength: number | null;
  specialSummonKind: string | null;
  starter: boolean;
  strengthModifier: number;
  materials: CardSlot[];
  resources: CardSlot[];
}

export const ZONES = ['hand', 'deck', 'lifeStack', 'tributeZone', 'discardPile', 'field'] as const;
export type ZoneName = (typeof ZONES)[number];

export interface PlayerState {
  userId: string;
  username: string;
  connected: boolean;
  deckId: string | null;
  /** Gem marker (0..5). */
  resourceCount: number;
  hand: CardSlot[];
  deck: CardSlot[];
  originalDeck: CardSlot[];
  lifeStack: CardSlot[];
  tributeZone: CardSlot[];
  discardPile: CardSlot[];
  field: CardSlot[];
}

export type RoomStatus = 'WAITING' | 'SELECTING_STARTER' | 'MULLIGAN' | 'IN_PROGRESS' | 'POST_GAME' | 'FINISHED';
export type PostGameChoice = 'new_game' | 'change_deck' | 'exit';

export interface GameLogEntry {
  ts: number;
  text: string;
}

/** Every broadcast on /topic/room/{id} carries the whole room state. */
export interface GameState {
  roomId: string;
  status: RoomStatus;
  players: Record<string, PlayerState>;
  hostId: string | null;
  currentTurnUserId: string | null;
  currentPhase: string | null;
  event: string | null;
  actorId: string | null;
  error?: string | null;
  /** Shared gem bar, -10..10 from the first player's point of view. */
  sharedCounter: number;
  postGameChoices: Record<string, PostGameChoice>;
  targetedInstanceId?: string | null;
  targetingSourceInstanceId?: string | null;
  revealedCardImageUrl?: string | null;
  revealedCardName?: string | null;
  eventLog?: GameLogEntry[];
}

/** GET /api/simulator/rooms/{id} */
export interface RoomInfo {
  roomId?: string;
  status: RoomStatus;
  playerIds?: string[];
}

export const STATUS_LABELS: Record<RoomStatus, string> = {
  WAITING: 'Esperando oponente',
  SELECTING_STARTER: 'Seleccionando iniciador',
  MULLIGAN: 'Mulligan',
  IN_PROGRESS: 'En curso',
  POST_GAME: 'Post partida',
  FINISHED: 'Finalizada',
};

export const ZONE_LABELS: Record<ZoneName, string> = {
  hand: 'Mano',
  deck: 'Mazo',
  lifeStack: 'Vidas',
  tributeZone: 'Tributos',
  discardPile: 'Descarte',
  field: 'Campo',
};
