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
  /** Printed properties read by the rules engine (may be missing on old rooms). */
  cost?: number | null;
  level?: number | null;
  colors?: string[];
  classes?: string[];
  /** Printed keyword abilities ("Provocar", "Letalidad 1") and those gained until the end of the turn. */
  keywords?: string[];
  turnKeywords?: string[];
  specialCost?: number | null;
  requirement?: string | null;
  /** Strength gained or lost until the end of the turn. */
  turnStrength?: number;
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
  /** Latest rules events (structured timeline, rules 11.6–11.7). */
  timeline?: GameEvent[] | null;
  /** Effects in the chain; the last one resolves first. */
  chain?: PendingEffect[] | null;
  /** Choice the rules engine is waiting for (only prompt.playerId may answer). */
  prompt?: EffectPrompt | null;
  /** Combat in progress (the engine runs it step by step). */
  combat?: Combat | null;
  /** Who took the first turn. */
  firstPlayerId?: string | null;
  /** The second player while the "ventaja del iniciador" is unused (−1 to an Iniciador's cost, once). */
  starterAdvantageUserId?: string | null;
  /** Slow effects each player can activate now, by player id. */
  activatable?: Record<string, ActivatableEffect[]> | null;
  /** Players who already played a structure normally this turn (one per turn). */
  structurePlayed?: string[] | null;
  /** Who won the game that just ended, and why. */
  winnerId?: string | null;
  endReason?: 'lives' | 'surrender' | null;
}

/** A slow effect (passive moment without a trigger) that can be activated from the board now. */
export interface ActivatableEffect {
  instanceId: string;
  scriptId: string;
  label: string;
  text: string;
}

/** One rules event of the timeline (the text log is generated from these). */
export interface GameEvent {
  seq: number;
  ts: number;
  type: string;
  playerId: string | null;
  cardInstanceId: string | null;
  cardName: string | null;
  fromZone: string | null;
  toZone: string | null;
  /** Effect instance it belongs to, and the resolution where it happened. */
  effectId: string | null;
  resolutionId: string | null;
  data: Record<string, unknown> | null;
}

export interface PendingEffect {
  id: string;
  scriptId: string;
  controllerId: string;
  sourceInstanceId: string;
  sourceName: string;
  label: string;
  text: string;
  /** Its chain link: 1 for the first one activated (it resolves last). */
  link: number;
  /** Set while it resolves. */
  resolutionId?: string | null;
}

export interface Combat {
  attackerId: string;
  attackerOwnerId: string;
  defenderId: string;
  /** Exhausted enemy creature attacked; null = the opponent. */
  targetId: string | null;
  blockerId: string | null;
  step: 'ATTACK' | 'BLOCK' | 'CLASH' | 'DAMAGE' | 'END';
  /** Entering the step, carrying it out or leaving it (each opens a window for triggers). */
  phase: 'ENTER' | 'ACT' | 'EXIT';
  byEffect: boolean;
}

/** TAKE_REVEALED_REST_BOTTOM: pick for the hand and order the rest. PICK: choose cards. CONFIRM: yes (choose the card) or no. */
export type EffectPromptKind = 'TAKE_REVEALED_REST_BOTTOM' | 'PICK' | 'CONFIRM';

export type PromptPurpose =
  | 'BLOCK'
  | 'PROVOKE'
  | 'ADVANCE'
  | 'RITUAL'
  | 'SPECIAL'
  | 'SPECIAL_FRONT'
  | 'REINFORCE'
  | 'LIFE_PLAY'
  | 'ORDER'
  | 'OPTIONAL'
  | 'PRIORITY';

/** A choice the engine waits for; it cannot be dismissed. */
export interface EffectPrompt {
  id: string;
  kind: EffectPromptKind;
  playerId: string;
  effectId: string | null;
  /**
   * Choices made by the rules, not by an effect: BLOCK, PROVOKE (Provocar), ADVANCE (move up to the Línea frontal),
   * RITUAL (creatures for a Ritual from the hand), SPECIAL_FRONT (move up after a special summon), REINFORCE
   * (Reforzar), LIFE_PLAY (play a lost life), ORDER (order of simultaneous mandatory triggers), OPTIONAL (chain one
   * of your optional triggers, then the next) or PRIORITY (respond to the chain).
   */
  purpose?: PromptPurpose | null;
  sourceName: string;
  title: string;
  instruction: string;
  /** What happens to a chosen card ("A tu mano", "Tributar", "Destruir"). */
  chosenLabel: string | null;
  cards: CardSlot[];
  /** Cards that may be chosen; the rest are locked. */
  validIds: string[];
  min: number;
  max: number;
  /** The cards not chosen can be reordered (they go to the deck bottom in that order). */
  reorderRest: boolean;
  /** The card the choice is about (the creature summoned by Ritual, the life card…). */
  subjectId?: string | null;
  /** Ritual from the hand: the summoner it was dropped onto. */
  summonerId?: string | null;
  /** What each card stands for in this choice (the effects it triggered), by instance id. */
  cardLabels?: Record<string, string> | null;
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
