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
