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

/**
 * The Línea frontal as drawn (`row`: its cards by x). Creatures in no formation standing between two members of one (one that just
 * entered and whose place is not chosen yet, or one the client put there before the engine answers) are drawn at the end of the
 * row, where the engine leaves them when nothing is chosen (Formations.splits): a formation is never drawn broken in the meantime.
 */
export function drawnFrontRow(player: PlayerState, row: readonly CardSlot[]): CardSlot[] {
  const formations = player.formations ?? [];
  const of = (c: CardSlot | undefined) => (c?.instanceId ? formations.findIndex((f) => f.includes(c.instanceId)) : -1);
  const creatures = row.filter((c) => c.cardType === 'creature');
  const apart = new Set<string>();
  for (let i = 0; i < creatures.length; ) {
    if (of(creatures[i]) >= 0) {
      i++;
      continue;
    }
    // A run of creatures in no formation, between two members of the same one
    let j = i;
    while (j < creatures.length && of(creatures[j]) < 0) j++;
    const left = of(creatures[i - 1]);
    if (left >= 0 && left === of(creatures[j])) creatures.slice(i, j).forEach((c) => apart.add(c.instanceId));
    i = j;
  }
  if (!apart.size) return [...row];
  return [...row.filter((c) => !apart.has(c.instanceId)), ...row.filter((c) => apart.has(c.instanceId))];
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
    const start = indexOf(row[i - 1]?.instanceId) !== index;
    const end = indexOf(row[i + 1]?.instanceId) !== index;
    // A formation has at least 2 creatures side by side: a member standing apart is drawn as a lone creature
    if (start && end) return;
    places.set(c.instanceId, { index, start, end });
  });
  return places;
}

/**
 * The rank of each formation of a row (its creatures' highest level), shown under its middle: by the member it is
 * drawn on, centered on it (an odd count) or at its right edge, between the two middle members (an even count).
 */
export function formationRanks(places: ReadonlyMap<string, FormationPlace>, row: readonly CardSlot[]): Map<string, { rank: number; between: boolean }> {
  const ranks = new Map<string, { rank: number; between: boolean }>();
  let run: CardSlot[] = [];
  for (const c of row) {
    const place = places.get(c.instanceId);
    if (!place) continue;
    if (place.start) run = [];
    run.push(c);
    if (!place.end) continue;
    const rank = Math.max(0, ...run.map((m) => m.level ?? 0));
    if (rank > 0) ranks.set(run[Math.floor((run.length - 1) / 2)].instanceId, { rank, between: run.length % 2 === 0 });
  }
  return ranks;
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
