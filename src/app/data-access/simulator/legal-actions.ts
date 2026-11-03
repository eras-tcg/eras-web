import { ActivatableEffect, CardSlot, GameState } from './simulator.model';

/** What a card can do now by the rules (clicking it offers these; the right-click menu keeps the manual actions). */
export type LegalAction = 'attack' | 'summon' | 'ritual' | 'play' | 'activate';

/** What the server says one player can do now: the board repeats no rule, and the server checks them again. */
export interface RulesView {
  legal: Record<string, LegalAction[]>;
  attackTargets: Record<string, string[]>;
  /** Slow effects I can activate now. */
  activatable: ActivatableEffect[];
}

export function rulesView(state: GameState | null, me: string | null): RulesView {
  return {
    legal: (me && state?.legalActions?.[me]) || {},
    attackTargets: (me && state?.attackTargets?.[me]) || {},
    activatable: (me && state?.activatable?.[me]) || [],
  };
}

/** The Línea frontal is the half of the field nearer the opponent (y below 50 in the owner's view). */
export function inFrontLine(slot: CardSlot): boolean {
  return slot.y != null && slot.y < 50;
}

/** Legal actions of one of your cards. */
export function legalActions(view: RulesView, slot: CardSlot): LegalAction[] {
  return view.legal[slot.instanceId] ?? [];
}

/** The enemies this creature can attack. */
export function attackableCreatures(view: RulesView, attacker: CardSlot, enemies: readonly CardSlot[]): CardSlot[] {
  const targets = view.attackTargets[attacker.instanceId] ?? [];
  return enemies.filter((c) => targets.includes(c.instanceId));
}

/** The name of a special summon kind, for the board. */
export function specialKindLabel(kind: string | null | undefined): string {
  switch (kind?.toLowerCase()) {
    case 'evolution':
      return 'Evolución';
    case 'promotion':
      return 'Ascenso';
    case 'materialization':
      return 'Materialización';
    default:
      return 'Ritual';
  }
}

/** The field in two rows, each ordered left to right. */
export function fieldRows(field: readonly CardSlot[]): { front: CardSlot[]; back: CardSlot[] } {
  const byX = (a: CardSlot, b: CardSlot) => (a.x ?? 50) - (b.x ?? 50);
  return {
    front: field.filter(inFrontLine).sort(byX),
    back: field.filter((s) => !inFrontLine(s)).sort(byX),
  };
}
