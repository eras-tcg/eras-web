import { CardSlot } from '@data/simulator/simulator.model';

/**
 * Enlace, the choice of a creature that entered the Línea frontal (FORMATION_ENTRY, engine Formations.entryOptions): the row as the
 * sheet draws it. The engine counts its positions in the row without the entering creature ("others"): "pos:i" puts it before
 * others[i] (i = others.length: at the end) in no formation, "pos:i:<id>" there linking with <id> (its formation, or a new one of
 * the two); <id> is always the creature next to that gap.
 *
 * Drawn: the other creatures in order, each formation boxed; between the boxes (and at the ends) a gap where it goes alone; each
 * creature's left and right halves, the link through that side (joining its box, or forming one with a loose creature). Only the
 * options the engine gives are targets. The entering creature is drawn where it would go: the option chosen, or where it stands.
 */

/** Where the entering creature goes: the gap among the others, and the creature it links with (null: alone). */
export interface EntryPlace {
  gap: number;
  withId: string | null;
}

/** A creature of the row (not the entering one), with the options of its left and right halves. */
export interface EntryCard {
  kind: 'card';
  card: CardSlot;
  /** Its place among the others. */
  index: number;
  left: string | null;
  right: string | null;
}

/** The entering creature, inside a box or in a gap. */
export interface EntrySubject {
  kind: 'subject';
}

/** A gap between boxes or loose creatures (and at both ends): the creature goes there alone. */
export interface EntryGap {
  kind: 'gap';
  gap: number;
  target: string | null;
  /** The entering creature is drawn here. */
  holds: boolean;
}

/** A formation (boxed), or a loose creature (boxed only when the entering creature forms one with it). */
export interface EntryGroup {
  kind: 'group';
  /** A formation already made. */
  formation: boolean;
  /** The entering creature is in it: a formation it joins, or one it forms with this loose creature. */
  joined: boolean;
  /** Every option whose link is with this group (its box lights while one of them is hovered). */
  targets: string[];
  items: (EntryCard | EntrySubject)[];
}

export type EntryItem = EntryGap | EntryGroup;

/** "pos:i" or "pos:i:id" read, or null when it is not an option of this choice. */
export function readPlace(option: string | null | undefined): EntryPlace | null {
  const m = option ? /^pos:(\d+)(?::(.+))?$/.exec(option) : null;
  return m ? { gap: Number(m[1]), withId: m[2] ?? null } : null;
}

/**
 * Where it stands now: its place in the row. Left between two members of one formation it is in none of, the engine puts it at
 * the end when nothing is chosen (Formations.splits).
 */
export function homePlace(cards: readonly CardSlot[], subjectId: string, formations: readonly (readonly string[])[]): EntryPlace {
  const others = cards.filter((c) => c.instanceId !== subjectId);
  const at = cards.findIndex((c) => c.instanceId === subjectId);
  const gap = at < 0 ? others.length : at;
  const of = (id: string | undefined) => (id ? formations.findIndex((f) => f.includes(id)) : -1);
  const left = of(others[gap - 1]?.instanceId);
  return { gap: left >= 0 && left === of(others[gap]?.instanceId) ? others.length : gap, withId: null };
}

/** The row: gaps and groups, left to right, with the entering creature where `place` puts it. */
export function entryLayout(
  cards: readonly CardSlot[],
  subjectId: string,
  formations: readonly (readonly string[])[],
  validIds: readonly string[],
  place: EntryPlace,
): EntryItem[] {
  const valid = new Set(validIds);
  const others = cards.filter((c) => c.instanceId !== subjectId);
  const formationOf = (id: string) => formations.findIndex((f) => f.includes(id));

  // The others, in runs: the members of one formation together, each loose creature alone
  const runs: { formation: boolean; members: { card: CardSlot; index: number }[] }[] = [];
  others.forEach((card, index) => {
    const f = formationOf(card.instanceId);
    const last = runs[runs.length - 1];
    if (f >= 0 && last?.formation && formationOf(last.members[0].card.instanceId) === f) last.members.push({ card, index });
    else runs.push({ formation: f >= 0, members: [{ card, index }] });
  });
  // A formation has at least 2 creatures side by side: a member standing apart is drawn as a lone creature
  for (const run of runs) if (run.members.length < 2) run.formation = false;

  // The link through a gap with this run: the option at that gap whose creature is one of its members
  const linkAt = (gap: number, ids: Set<string>) => validIds.find((o) => {
    const p = readPlace(o);
    return !!p && p.gap === gap && !!p.withId && ids.has(p.withId);
  }) ?? null;

  const gapItem = (gap: number): EntryGap => ({ kind: 'gap', gap, target: valid.has(`pos:${gap}`) ? `pos:${gap}` : null, holds: !place.withId && place.gap === gap });

  const out: EntryItem[] = [];
  for (const run of runs) {
    out.push(gapItem(run.members[0].index));
    const ids = new Set(run.members.map((m) => m.card.instanceId));
    const joined = !!place.withId && ids.has(place.withId);
    const items: (EntryCard | EntrySubject)[] = [];
    const targets = new Set<string>();
    for (const m of run.members) {
      if (joined && place.gap === m.index) items.push({ kind: 'subject' });
      const left = linkAt(m.index, ids);
      const right = linkAt(m.index + 1, ids);
      if (left) targets.add(left);
      if (right) targets.add(right);
      items.push({ kind: 'card', card: m.card, index: m.index, left, right });
    }
    if (joined && place.gap === run.members[run.members.length - 1].index + 1) items.push({ kind: 'subject' });
    out.push({ kind: 'group', formation: run.formation, joined, targets: [...targets], items });
  }
  out.push(gapItem(others.length));
  return out;
}

/** A stretch while the spots are measured: a gap's reaches its neighbours. */
interface Spot {
  target: string | null;
  left: number;
  right: number;
  gap: boolean;
}

/** A box of the row as measured on the screen (left to right): a gap, or a group with its cards and the options of their halves. */
export type MeasuredItem =
  | { kind: 'gap'; target: string | null; left: number; right: number }
  | { kind: 'group'; boxed: boolean; left: number; right: number; cards: { left: number; right: number; leftTarget: string | null; rightTarget: string | null }[] };

/** The stretch of the row (screen x) that takes the dragged creature to one option. */
export interface EntrySpot {
  target: string;
  left: number;
  right: number;
}

/**
 * Where each option takes the dragged creature, left to right, with no hole between them: each half of a creature is its own side;
 * the halves at the ends of a formation's box reach its frame (its padding is theirs); a gap takes the whole space between its
 * neighbours (from a box's frame, or a loose creature's edge, to the next one), so the place alone after a formation is as wide as
 * the room between it and the next card.
 */
export function entrySpots(items: readonly MeasuredItem[]): EntrySpot[] {
  const spots: Spot[] = [];
  for (const it of items) {
    if (it.kind === 'gap') {
      spots.push({ target: it.target, left: it.left, right: it.right, gap: true });
      continue;
    }
    it.cards.forEach((c, i) => {
      const mid = (c.left + c.right) / 2;
      const left = it.boxed && i === 0 ? it.left : c.left;
      const right = it.boxed && i === it.cards.length - 1 ? it.right : c.right;
      spots.push({ target: c.leftTarget, left, right: mid, gap: false });
      spots.push({ target: c.rightTarget, left: mid, right, gap: false });
    });
  }
  // A gap reaches its neighbours
  spots.forEach((s, i) => {
    if (!s.gap) return;
    const before = spots[i - 1];
    const after = spots[i + 1];
    if (before) s.left = Math.min(s.left, before.right);
    if (after) s.right = Math.max(s.right, after.left);
  });
  return spots.filter((s): s is Spot & { target: string } => !!s.target).map(({ target, left, right }) => ({ target, left, right }));
}

/** The option at screen x: the stretch it is in, else the nearest one (the first of two as near). */
export function spotAt(spots: readonly EntrySpot[], x: number): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const s of spots) {
    if (x >= s.left && x < s.right) return s.target;
    const distance = x < s.left ? s.left - x : x - s.right;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = s.target;
    }
  }
  return best;
}
