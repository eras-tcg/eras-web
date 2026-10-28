import { ActivatableEffect, CardSlot, GameState, ZoneName } from './simulator.model';

/** What a card can do now by the rules (clicking it offers these; the right-click menu keeps the manual actions). */
export type LegalAction = 'attack' | 'summon' | 'ritual' | 'play' | 'activate';

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
  /** I still have the "ventaja del iniciador": an Iniciador costs me 1 less, once (rule 6.2.1.4). */
  starterAdvantage: boolean;
  /** My field, for the Requerimiento of a Ritual. */
  field: CardSlot[];
  /** Slow effects I can activate now (the server lists them). */
  activatable: ActivatableEffect[];
  /** I already played a structure normally this turn (only one per turn). */
  structurePlayed: boolean;
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
    starterAdvantage: !!me && state?.starterAdvantageUserId === me,
    field: (me && state?.players[me]?.field) || [],
    activatable: (me && state?.activatable?.[me]) || [],
    structurePlayed: !!me && !!state?.structurePlayed?.includes(me),
  };
}

/** The Línea frontal is the half of the field nearer the opponent (y below 50 in the owner's view). */
export function inFrontLine(slot: CardSlot): boolean {
  return slot.y != null && slot.y < 50;
}

/**
 * Rule 5.0.0.1: on your turn, paying may not leave the opponent with more gems than their Marcador shows; on
 * theirs only the end of the Contador limits it. Paying 0 always works.
 */
export function canPay(view: RulesView, cost: number): boolean {
  return cost <= 0 || view.gems - cost >= (view.myTurn ? -view.opponentMarker : -10);
}

/** Cost to play a utility or structure, after the reductions printed on it (mirrors the server). */
export function playCost(view: RulesView, slot: CardSlot): number {
  let cost = slot.cost ?? 0;
  if (slot.cardName?.toLowerCase() === 'caza nocturna' && view.gems < 0) cost -= 1;
  return Math.max(0, cost);
}

/** A summon cost after the "ventaja del iniciador". */
export function summonCost(view: RulesView, slot: CardSlot, cost: number): number {
  return slot.starter && view.starterAdvantage && cost > 0 ? cost - 1 : cost;
}

/** Furia N → N; Furia without a number → -1 (no limit); null without Furia. */
export function furia(slot: CardSlot): number | null {
  let best: number | null = null;
  for (const k of [...(slot.keywords ?? []), ...(slot.turnKeywords ?? [])]) {
    if (!k.toLowerCase().startsWith('furia')) continue;
    const n = /(\d+)/.exec(k);
    if (!n) return -1;
    best = Math.max(best ?? 0, Number(n[1]));
  }
  return best;
}

/** Rule 10.1.1.1: 0 or more gems; Furia N while the opponent has N or fewer; Furia alone, always. */
export function attackGemsOk(view: RulesView, slot: CardSlot): boolean {
  if (view.gems >= 0) return true;
  const f = furia(slot);
  return f != null && (f < 0 || view.gems >= -f);
}

/** Requerimiento of a Ritual: one creature of level N, or several whose levels add up to N. */
export function requirement(slot: CardSlot): { sum: boolean; level: number } | null {
  const text = slot.requirement?.toLowerCase() ?? '';
  const m = /nivel\s*(\d+)|sumen\s*(\d+)/.exec(text);
  return m ? { sum: text.includes('sum'), level: Number(m[1] ?? m[2]) } : null;
}

/** Rule 9.2.0.10: a creature used for a Ritual shares a type or a color with the summoned one. */
export function sharesTypeOrColor(used: CardSlot, summoned: CardSlot): boolean {
  const colors = summoned.colors ?? [];
  const classes = (summoned.classes ?? []).map((c) => c.toLowerCase());
  return (used.colors ?? []).some((c) => colors.includes(c)) || (used.classes ?? []).some((c) => classes.includes(c.toLowerCase()));
}

/** Creatures of my field that can be used for the Ritual of `slot`. */
export function ritualMaterials(view: RulesView, slot: CardSlot): CardSlot[] {
  return view.field.filter((c) => c.cardType === 'creature' && c.level != null && sharesTypeOrColor(c, slot));
}

/** Some of the creatures' levels add up exactly to `target` ("criaturas que en nivel sumen N"). */
export function sumsExactly(cards: readonly CardSlot[], target: number): boolean {
  if (target < 0) return false;
  const reachable = new Array<boolean>(target + 1).fill(false);
  reachable[0] = true;
  for (const c of cards) {
    const level = c.level ?? 0;
    if (level <= 0) continue;
    for (let t = target; t >= level; t--) if (reachable[t - level]) reachable[t] = true;
  }
  return reachable[target];
}

/** The creature can be summoned by Ritual now: special cost payable and the Requerimiento met (mirrors the server). */
export function canRitual(view: RulesView, slot: CardSlot): boolean {
  const req = requirement(slot);
  if (slot.specialSummonKind?.toLowerCase() !== 'ritual' || !req || slot.specialCost == null) return false;
  if (!canPay(view, summonCost(view, slot, slot.specialCost))) return false;
  const materials = ritualMaterials(view, slot);
  return req.sum ? sumsExactly(materials, req.level) : materials.some((c) => c.level === req.level);
}

/** Legal actions of one of your cards; the server checks them again. */
export function legalActions(view: RulesView, slot: CardSlot, zone: ZoneName): LegalAction[] {
  if (!view.inProgress || view.phase !== 'MAIN' || view.closed) return [];
  const actions: LegalAction[] = [];
  // Slow effects: the server says which ones can be activated now
  if (view.activatable.some((e) => e.instanceId === slot.instanceId)) actions.push('activate');
  if (!view.myTurn) return actions;
  if (zone === 'field') {
    // Rule 10.1.1.1: an active creature of the Línea frontal, with 0 or more gems (or what its Furia allows)
    if (slot.cardType === 'creature' && !slot.tapped && inFrontLine(slot) && attackGemsOk(view, slot)) actions.unshift('attack');
  } else if (zone === 'hand') {
    if (slot.cardType === 'creature' && slot.cost != null && canPay(view, summonCost(view, slot, slot.cost))) actions.push('summon');
    if (slot.cardType === 'creature' && canRitual(view, slot)) actions.push('ritual');
    const structureLeft = slot.cardType !== 'structure' || !view.structurePlayed;
    if ((slot.cardType === 'utility' || slot.cardType === 'structure') && structureLeft && canPay(view, playCost(view, slot))) actions.push('play');
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
