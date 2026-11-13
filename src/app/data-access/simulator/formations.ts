import { inFrontLine } from './legal-actions';
import { CardSlot, PlayerState } from './simulator.model';

/** Enlace (engine Formations.kt): the order of the Línea frontal, who points to whom, and what each card receives. */

/** The player's creatures of the Línea frontal, left to right: by x, ties by their place in the field (as the engine orders them). */
export function frontOrder(field: readonly CardSlot[]): CardSlot[] {
  return field
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.cardType === 'creature' && inFrontLine(c))
    .sort((a, b) => (a.c.x ?? 50) - (b.c.x ?? 50) || a.i - b.i)
    .map(({ c }) => c);
}

/** `from` points to its neighbour on that side: the arrow printed toward it, a creature there, and `from` active (face up, not exhausted). */
export function pointsSide(order: readonly CardSlot[], from: CardSlot, side: 'left' | 'right'): boolean {
  if (from.tapped || from.faceDown || !from.arrows?.includes(side)) return false;
  const at = order.findIndex((c) => c.instanceId === from.instanceId);
  if (at < 0) return false;
  return !!order[side === 'left' ? at - 1 : at + 1];
}

/** Where a card of the Línea frontal stands in its formation as drawn: the formation's number and whether it starts or ends the run. */
export interface FormationPlace {
  index: number;
  start: boolean;
  end: boolean;
}

/** The cards of a row (as drawn, left to right) that are in a formation, each with its place in it. */
export function formationPlaces(player: PlayerState, row: readonly CardSlot[]): Map<string, FormationPlace> {
  const places = new Map<string, FormationPlace>();
  const formations = player.formations ?? [];
  const indexOf = (id: string | undefined) => (id ? formations.findIndex((f) => f.includes(id)) : -1);
  row.forEach((c, i) => {
    const index = indexOf(c.instanceId);
    if (index < 0) return;
    places.set(c.instanceId, { index, start: indexOf(row[i - 1]?.instanceId) !== index, end: indexOf(row[i + 1]?.instanceId) !== index });
  });
  return places;
}

/** A link effect a card receives: the member that gives it. */
export interface FormationGrant {
  sourceId: string;
  sourceName: string;
}

/** The link effects the card receives now ("sourceInstanceId|since|sourceName"). */
export function formationGrants(slot: CardSlot): FormationGrant[] {
  return (slot.formationGrants ?? []).map((g) => {
    const [sourceId, , ...name] = g.split('|');
    return { sourceId, sourceName: name.join('|') };
  });
}
