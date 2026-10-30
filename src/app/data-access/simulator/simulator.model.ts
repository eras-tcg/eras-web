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
  /** Abilities and strength its continuous effects give it now (they stop when their condition does). */
  continuousKeywords?: string[];
  continuousStrength?: number;
  specialCost?: number | null;
  requirement?: string | null;
  /** Strength gained or lost until the end of the turn. */
  turnStrength?: number;
  /** Strength gained or lost until the end of the opponent's next turn ("hasta el final del turno oponente"). */
  laterStrength?: number;
  /** What effects gave or took from it for a while, with the card they came from. */
  floating?: FloatingEffect[];
  materials: CardSlot[];
  resources: CardSlot[];
  /** What of its effects the rules engine does not run yet (played by hand); null when all of it runs. */
  unprogrammed?: string | null;
}

/** "Pierde 3 de fuerza hasta el final del turno", from Arc xioma. */
export interface FloatingEffect {
  text: string;
  source: string | null;
  until: 'turn' | 'nextTurn' | 'attack';
  strength: number;
  keyword: string | null;
}

/** Test room: a made-up card (or a copy of a real one: its name gives it that card's effects) and where it goes. */
export interface DummyCard {
  zone: ZoneName;
  /** Deck or lives: on top (else at the bottom / the end). */
  position?: 'top' | 'bottom';
  faceDown?: boolean;
  /** Field: where (y < 50 is the Línea frontal). */
  x?: number;
  y?: number;
  cardId?: string | null;
  imageUrl?: string | null;
  cardName: string;
  cardType: 'creature' | 'utility' | 'structure';
  cost?: number | null;
  level?: number | null;
  strength?: number | null;
  specialCost?: number | null;
  specialSummonKind?: string | null;
  requirement?: string | null;
  starter?: boolean;
  colors?: string[];
  classes?: string[];
  keywords?: string[];
}

export const ZONES = ['hand', 'deck', 'lifeStack', 'tributeZone', 'discardPile', 'field'] as const;
export type ZoneName = (typeof ZONES)[number];

export interface PlayerState {
  userId: string;
  username: string;
  connected: boolean;
  /** Pre-room: the deck's name, the starter chosen (a card id of the deck) and whether they confirmed. */
  deckName?: string | null;
  starterCardId?: string | null;
  ready?: boolean;
  deckId: string | null;
  /** Gem marker (0..5). */
  resourceCount: number;
  /** The engine does not offer their optional triggered effects ("En Juego" ones still). */
  skipOptional?: boolean;
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
  /** Timeline event's type (ACTIVATE…, DRAW, DESTROY…), MANUAL for an action by hand, or none (a note). */
  kind?: string | null;
  /** The card behind it: the effect's card for an effect's steps, else the card the action is about. */
  sourceId?: string | null;
  sourceName?: string | null;
  imageUrl?: string | null;
  /** One of an effect's steps (not its activation or resolution). */
  detail?: boolean;
  /** An inherited effect: the Recurso that gives it. */
  inheritedFromName?: string | null;
  inheritedFromImage?: string | null;
}

/** Every broadcast on /topic/room/{id} carries the whole room state. */
export interface GameState {
  roomId: string;
  status: RoomStatus;
  players: Record<string, PlayerState>;
  hostId: string | null;
  /** A test room: its owner plays both sides alone (the other side is not a real player). */
  editor?: boolean;
  /** Mulligan: who already confirmed their hand. */
  mulliganReady?: string[] | null;
  currentTurnUserId: string | null;
  currentPhase: string | null;
  event: string | null;
  actorId: string | null;
  /** The player an event is about (the one taken out of the room by PLAYER_KICKED). */
  subjectUserId?: string | null;
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
  /** Pre-room: who takes the first turn, chosen by the room's owner (hostId) ("random" or a player id). */
  firstChoice?: string | null;
  /** Slow effects each player can activate now, by player id. */
  activatable?: Record<string, ActivatableEffect[]> | null;
  /** Cards each player can special summon now (from the hand, or the Tributos when the card allows it), by player id. */
  specialSummonable?: Record<string, string[]> | null;
  /** Players who already played a structure normally this turn (one per turn). */
  structurePlayed?: string[] | null;
  /** Utilities in each player's hand that cannot be played now (their "En Juego" cannot be activated), by player id. */
  unplayable?: Record<string, string[]> | null;
  /** Who won the game that just ended, and why. */
  winnerId?: string | null;
  endReason?: 'lives' | 'surrender' | 'deck' | null;
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
  | 'PRIORITY'
  /** A card about to leave the field: replace it ("en su lugar", Protección), and the hand card that pays it. */
  | 'REPLACE'
  | 'REPLACE_HAND';

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
  /** The art of the card whose effect asks it (to see at a glance what is resolving). */
  sourceImageUrl?: string | null;
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
  /** The rest goes back to the deck top instead of its bottom. */
  restToTop?: boolean;
  /** The card the choice is about (the creature summoned by Ritual, the life card…). */
  subjectId?: string | null;
  /** Ritual from the hand: the summoner it was dropped onto. */
  summonerId?: string | null;
  /** What each card stands for in this choice (the effects it triggered), by instance id. */
  cardLabels?: Record<string, string> | null;
  /** The effects offered in a chaining choice, with their whole text; each one is chosen by its effectId. */
  effects?: OfferedEffect[] | null;
  /** The whole text of the effect resolving or paying its cost. */
  effectText?: string | null;
  /** The levels of the cards chosen may add up to this at most. */
  maxLevelSum?: number | null;
}

/** An effect offered to be chained (a card can trigger several at once: its own and the inherited ones). */
export interface OfferedEffect {
  /** What is answered to chain it (older servers only send the card's id). */
  effectId?: string;
  sourceId: string;
  sourceName: string;
  label: string;
  text: string;
  /** An inherited effect: the Recurso that gives it. */
  inheritedFromName?: string | null;
  inheritedFromImage?: string | null;
}

/** GET /api/simulator/rooms/{id} */
export interface RoomInfo {
  roomId?: string;
  status: RoomStatus;
  playerIds?: string[];
  /** Usernames of the players in it. */
  players?: string[];
  playerCount?: number;
  createdAt?: string;
}

export const STATUS_LABELS: Record<RoomStatus, string> = {
  WAITING: 'Preparando la partida',
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
