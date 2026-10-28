import { CardSlot, GameState, ZoneName } from './simulator.model';

/** What a card can do now by the rules (clicking it offers these; the right-click menu keeps the manual actions). */
export type LegalAction = 'attack' | 'summon' | 'play';

/** Everything the rules check, read from the room for one player. */
export interface RulesView {
  inProgress: boolean;
  myTurn: boolean;
  phase: string;
  /** A chain, a choice or a combat is pending: the game state is closed (rule 7.2). */
  closed: boolean;
  /** Gems on the shared Contador, positive on my side. */
  gems: number;
  /** The opponent's Marcador: how far below 0 I may pay (rule 5.0.0.1). */
  opponentMarker: number;
}

export function rulesView(state: GameState | null, me: string | null): RulesView {
  const ids = Object.keys(state?.players ?? {});
  const first = ids.length === 0 || ids[0] === me;
  const opponent = ids.find((id) => id !== me);
  return {
    inProgress: state?.status === 'IN_PROGRESS',
    myTurn: !!me && state?.currentTurnUserId === me,
    phase: state?.currentPhase ?? 'MAIN',
    closed: !!state?.prompt || !!state?.chain?.length || !!state?.combat,
    gems: (state?.sharedCounter ?? 0) * (first ? -1 : 1),
    opponentMarker: opponent ? (state?.players[opponent]?.resourceCount ?? 0) : 0,
  };
}

/** The Línea frontal is the half of the field nearer the opponent (y below 50 in the owner's view). */
export function inFrontLine(slot: CardSlot): boolean {
  return slot.y != null && slot.y < 50;
}

/** Rule 5.0.0.1: paying may not leave the opponent with more gems than their Marcador shows. */
export function canPay(view: RulesView, cost: number): boolean {
  return view.gems - cost >= -view.opponentMarker;
}

/** Cost to play a utility or structure, after the reductions printed on it (mirrors the server). */
export function playCost(view: RulesView, slot: CardSlot): number {
  let cost = slot.cost ?? 0;
  if (slot.cardName?.toLowerCase() === 'caza nocturna' && view.gems < 0) cost -= 1;
  return Math.max(0, cost);
}

/** Legal actions of one of your cards; the server checks them again. */
export function legalActions(view: RulesView, slot: CardSlot, zone: ZoneName): LegalAction[] {
  if (!view.inProgress || !view.myTurn || view.phase !== 'MAIN' || view.closed) return [];
  const actions: LegalAction[] = [];
  if (zone === 'field') {
    // Rule 10.1.1.1: an active creature of the Línea frontal, with 0 or more gems
    if (slot.cardType === 'creature' && !slot.tapped && inFrontLine(slot) && view.gems >= 0) actions.push('attack');
  } else if (zone === 'hand') {
    if (slot.cardType === 'creature' && slot.cost != null && canPay(view, slot.cost)) actions.push('summon');
    if ((slot.cardType === 'utility' || slot.cardType === 'structure') && canPay(view, playCost(view, slot))) actions.push('play');
  }
  return actions;
}

/** The field in two rows, each ordered left to right. */
export function fieldRows(field: readonly CardSlot[]): { front: CardSlot[]; back: CardSlot[] } {
  const byX = (a: CardSlot, b: CardSlot) => (a.x ?? 50) - (b.x ?? 50);
  return {
    front: field.filter(inFrontLine).sort(byX),
    back: field.filter((s) => !inFrontLine(s)).sort(byX),
  };
}
