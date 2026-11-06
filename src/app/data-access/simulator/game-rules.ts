import { CardSlot, GameState, PlayerState, PostGameChoice, RoomStatus, ZoneName } from './simulator.model';

/** Strength shown on a creature (base + modifier); null for cards without strength. */
export function displayStrength(slot: CardSlot): number | null {
  return slot.strength == null ? null : slot.strength + strengthChange(slot);
}

/** What its strength gained or lost: by hand, until the end of this turn and until the end of the next one. */
export function strengthChange(slot: CardSlot): number {
  return (slot.strengthModifier || 0) + (slot.turnStrength || 0) + (slot.laterStrength || 0) + (slot.continuousStrength || 0);
}

/** Opponent hands are always hidden; other cards when face down. */
export function isHidden(slot: CardSlot, zone: ZoneName, opponent: boolean): boolean {
  return slot.faceDown || (opponent && zone === 'hand');
}

/** Your own face-down cards in the Tributos and the Descarte: you know them, so you see them (with a corner of their back). */
export function knownToOwner(slot: CardSlot, zone: ZoneName, opponent: boolean): boolean {
  return !opponent && slot.faceDown && (zone === 'tributeZone' || zone === 'discardPile');
}

/** Warnings shown when joining with a deck (incomplete, missing images or metadata). */
export function deckWarnings(originalDeck: readonly CardSlot[]): string[] {
  const warnings: string[] = [];
  if (originalDeck.length < 50) warnings.push(`Mazo incompleto: ${originalDeck.length}/50 cartas cargadas`);
  const noImage = originalDeck.filter((s) => !s.imageUrl).length;
  if (noImage) warnings.push(`${noImage} ${noImage === 1 ? 'carta' : 'cartas'} sin imagen`);
  const noMeta = originalDeck.filter((s) => s.imageUrl && !s.cardType);
  if (noMeta.length) {
    const counts = new Map<string, number>();
    for (const s of noMeta) counts.set(s.cardName || '?', (counts.get(s.cardName || '?') ?? 0) + 1);
    warnings.push(`Sin metadatos: ${[...counts].map(([name, n]) => (n > 1 ? `×${n} ${name}` : name)).join(', ')}`);
  }
  // Effects the rules engine does not run: they are played by hand (editor mode)
  const unprogrammed = new Map<string, number>();
  for (const s of originalDeck) if (s.unprogrammed) unprogrammed.set(s.cardName || '?', (unprogrammed.get(s.cardName || '?') ?? 0) + 1);
  if (unprogrammed.size) {
    warnings.push(`Efectos sin programar (se juegan a mano): ${[...unprogrammed].map(([name, n]) => (n > 1 ? `×${n} ${name}` : name)).join(', ')}`);
  }
  return warnings;
}

/**
 * Zone targets travel as "zone:own:x" / "zone:opp:x" from the actor's point of view;
 * the other player sees them swapped.
 */
export function targetForViewer(targetId: string, viewerIsActor: boolean): string {
  if (viewerIsActor || !targetId.startsWith('zone:')) return targetId;
  if (targetId.startsWith('zone:opp:')) return targetId.replace('zone:opp:', 'zone:own:');
  if (targetId.startsWith('zone:own:')) return targetId.replace('zone:own:', 'zone:opp:');
  return targetId;
}

export const zoneTargetId = (zone: ZoneName, opponent: boolean) => `zone:${opponent ? 'opp' : 'own'}:${zone}`;

/**
 * Optimistic local move, mirroring what the server does, so the card does not jump back while the
 * broadcast is on its way. Returns a new player state; unknown cards leave it unchanged.
 */
export function applyLocalMove(player: PlayerState, instanceId: string, from: ZoneName, to: ZoneName, x?: number, y?: number): PlayerState {
  const fromList = [...player[from]];
  const index = fromList.findIndex((c) => c.instanceId === instanceId);
  if (index === -1) return player;
  const [original] = fromList.splice(index, 1);
  const card: CardSlot = { ...original };
  const next: PlayerState = { ...player, [from]: fromList };
  if (to === 'field') {
    card.x = x ?? 50;
    card.y = y ?? 50;
  } else {
    card.x = null;
    card.y = null;
    card.tapped = false;
  }
  if (to === 'discardPile' || to === 'tributeZone' || to === 'hand') card.faceDown = false;
  if (to === 'deck') card.faceDown = true;
  let discard = next.discardPile;
  if (from === 'field' && to !== 'field') {
    // Attachments fall to the discard pile and modifiers reset when a card leaves the field
    discard = [...discard, ...[...card.materials, ...card.resources].map((a) => ({ ...a, faceDown: false, tapped: false }))];
    card.materials = [];
    card.resources = [];
    card.strengthModifier = 0;
  }
  next.discardPile = discard;
  const toList = to === from ? fromList : [...next[to]];
  toList.push(card);
  return { ...next, [to]: toList };
}

/** Post-game options for me, given who surrendered and what they chose. */
export function postGameOptions(iSurrendered: boolean, surrendererChoice: PostGameChoice | null): PostGameChoice[] {
  if (iSurrendered) return ['new_game', 'change_deck', 'exit'];
  if (surrendererChoice === 'exit') return ['exit'];
  if (surrendererChoice === 'change_deck') return ['change_deck', 'exit'];
  return ['new_game', 'change_deck', 'exit'];
}

export const POST_GAME_LABELS: Record<PostGameChoice, string> = {
  new_game: 'Nueva partida',
  change_deck: 'Cambiar mazo',
  exit: 'Salir',
};

/**
 * Shared gem bar: 21 positions (index 0..20) labelled 10…0…10. The value is stored from the first
 * player's side; the second player sees it mirrored so their positive side is also on the left.
 */
export function sharedIndexForValue(value: number, firstPlayer: boolean): number {
  return (firstPlayer ? value : -value) + 10;
}

export function sharedValueForIndex(index: number, firstPlayer: boolean): number {
  return firstPlayer ? index - 10 : 10 - index;
}

/** Field coordinates are stored from the owner's view; the opponent's field is drawn upside down. */
export function fieldY(y: number | null, opponent: boolean): number {
  const v = y ?? 50;
  return opponent ? 100 - v : v;
}

export const FIELD_INTERACTION_RANGE = 7;

/** Creature close enough to (x, y) to interact with (summon on top, attach), excluding the dragged card. */
export function creatureNear(field: readonly CardSlot[], x: number, y: number, excludeId: string | null): CardSlot | null {
  return (
    field.find(
      (s) =>
        s.instanceId !== excludeId &&
        s.cardType === 'creature' &&
        Math.abs((s.x ?? 50) - x) < FIELD_INTERACTION_RANGE &&
        Math.abs((s.y ?? 50) - y) < FIELD_INTERACTION_RANGE,
    ) ?? null
  );
}

/** The piles of a player, in the order a card is looked for in them. */
export const PILES: readonly ZoneName[] = ['hand', 'deck', 'lifeStack', 'tributeZone', 'discardPile'];

/**
 * A card anywhere in the state: on a field, in a hand or a pile; with `attached`, also as a Material or Recurso
 * under a field card. Null when it is not there.
 */
export function findSlot(state: GameState | null | undefined, id: unknown, options: { attached?: boolean } = {}): CardSlot | null {
  if (!state || typeof id !== 'string') return null;
  for (const p of Object.values(state.players ?? {})) {
    for (const c of [...p.field, ...PILES.flatMap((z) => p[z] as CardSlot[])]) {
      if (c.instanceId === id) return c;
      if (options.attached) {
        const under = [...(c.materials ?? []), ...(c.resources ?? [])].find((a) => a.instanceId === id);
        if (under) return under;
      }
    }
  }
  return null;
}

/** The pile a card is in (its owner and zone), when it is in one (not on a field). */
export function pileOf(state: GameState | null | undefined, id: string, zones: readonly ZoneName[] = PILES): { ownerId: string; zone: ZoneName } | null {
  for (const p of Object.values(state?.players ?? {})) {
    for (const zone of zones) {
      if ((p[zone] as CardSlot[]).some((c) => c.instanceId === id)) return { ownerId: p.userId, zone };
    }
  }
  return null;
}

/** The last event of the state's timeline (0: none). */
export function lastSeq(state: GameState | null | undefined): number {
  return (state?.timeline ?? []).reduce((m, e) => Math.max(m, e.seq), 0);
}

/** A match is under way: choosing the starters, the mulligan or the game itself (not the pre-room nor its end). */
export function isMatchActive(status: RoomStatus | null | undefined): boolean {
  return status === 'SELECTING_STARTER' || status === 'MULLIGAN' || status === 'IN_PROGRESS';
}

/** The table plays the timeline's events: during the game and on its last update (the blow that ends it). */
export function playsTimeline(status: RoomStatus | null | undefined): boolean {
  return status === 'IN_PROGRESS' || status === 'POST_GAME';
}

/** The bot's edge goes up to this level. */
export const BOT_EDGE_MAX = 8;

/**
 * The bot's edge in words: levels 1–4 raise the bot's Marcador 1 more in its turn 4, 3, 2 or 1; levels 5–8 also
 * hold the rival's back 1 in their turn 5, 4, 3 or 2. Empty for none.
 */
export function botEdgeText(level: number | null | undefined): string {
  const n = Math.max(0, Math.min(BOT_EDGE_MAX, level ?? 0));
  if (!n) return '';
  const botTurn = Math.max(1, 5 - n);
  const bot = `el Marcador del bot sube 1 más en su turno ${botTurn}`;
  return n < 5 ? `${bot}.` : `${bot} y el tuyo sube 1 menos en tu turno ${10 - n}.`;
}
