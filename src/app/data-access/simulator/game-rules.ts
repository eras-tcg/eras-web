import { CardSlot, PlayerState, PostGameChoice, ZoneName } from './simulator.model';

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
