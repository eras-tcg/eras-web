import { CardSlot } from '@data/simulator/simulator.model';
import { EntryCard, EntryGap, EntryGroup, HOME, MeasuredItem, entryLayout, entrySpots, homePlace, readPlace, spotAt } from './formation-entry';

const card = (id: string) => ({ instanceId: id, cardName: id }) as CardSlot;

/** The row in short: gaps as "|" (target "|*", holding the entering one "|S"), groups as [a b] (formation) or (a) (loose). */
function draw(items: ReturnType<typeof entryLayout>): string {
  return items
    .map((it) => {
      if (it.kind === 'gap') return '|' + (it.target ? '*' : '') + (it.holds ? 'S' : '');
      const inner = it.items.map((c) => (c.kind === 'subject' ? 'S' : c.card.instanceId)).join(' ');
      return it.formation || it.joined ? `[${inner}]` : `(${inner})`;
    })
    .join(' ');
}

describe('formation entry layout', () => {
  // Front line A B C D S: A and B a formation, C and D loose, S entering at the end
  const cards = ['a', 'b', 'c', 'd', 's'].map(card);
  const formations = [['a', 'b']];
  const valid = ['pos:0', 'pos:1:a', 'pos:2', 'pos:2:b', 'pos:2:c', 'pos:3', 'pos:3:c', 'pos:3:d', 'pos:4', 'pos:4:d'];

  it('keeps a place to drop it back where it stands when only links are offered (main phase)', () => {
    const links = valid.filter((o) => o.split(':').length === 3);
    const items = entryLayout(cards, 's', formations, links, { gap: -1, withId: null }, 4);
    expect((items.at(-1) as EntryGap).target).toBe(HOME);
    expect((items[0] as EntryGap).target).toBeNull();
  });

  it('reads the options of the engine', () => {
    expect(readPlace('pos:3')).toEqual({ gap: 3, withId: null });
    expect(readPlace('pos:0:x-1')).toEqual({ gap: 0, withId: 'x-1' });
    expect(readPlace('nada')).toBeNull();
    expect(readPlace(null)).toBeNull();
  });

  it('boxes the formations, leaves the rest loose, with the entering one where it stands', () => {
    const home = homePlace(cards, 's', formations);
    expect(home).toEqual({ gap: 4, withId: null });
    expect(draw(entryLayout(cards, 's', formations, valid, home))).toBe('|* [a b] |* (c) |* (d) |*S');
  });

  it('leaves the entering one out while it is dragged: one place per gap, none next to itself', () => {
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: -1, withId: null }))).toBe('|* [a b] |* (c) |* (d) |*');
  });

  it('never boxes a lone member: a formation is at least 2 creatures side by side', () => {
    const split = ['a', 'c', 'b', 's'].map(card);
    expect(draw(entryLayout(split, 's', formations, ['pos:0', 'pos:3'], homePlace(split, 's', formations)))).toBe('|* (a) | (c) | (b) |*S');
  });

  it('gives each side of a creature the link through it, and the gaps their place alone', () => {
    const items = entryLayout(cards, 's', formations, valid, { gap: 4, withId: null });
    const [a, b] = (items[1] as EntryGroup).items as EntryCard[];
    expect([a.left, a.right, b.left, b.right]).toEqual([null, 'pos:1:a', 'pos:1:a', 'pos:2:b']);
    const c = (items[3] as EntryGroup).items[0] as EntryCard;
    expect([c.left, c.right]).toEqual(['pos:2:c', 'pos:3:c']);
    expect((items[3] as EntryGroup).targets).toEqual(['pos:2:c', 'pos:3:c']);
    expect((items[2] as EntryGap).target).toBe('pos:2');
  });

  it('draws it inside the formation it joins, or boxed with the loose creature it links with', () => {
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: 1, withId: 'a' }))).toBe('|* [a S b] |* (c) |* (d) |*');
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: 2, withId: 'b' }))).toBe('|* [a b S] |* (c) |* (d) |*');
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: 3, withId: 'c' }))).toBe('|* [a b] |* [c S] |* (d) |*');
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: 3, withId: 'd' }))).toBe('|* [a b] |* (c) |* [S d] |*');
    expect(draw(entryLayout(cards, 's', formations, valid, { gap: 0, withId: null }))).toBe('|*S [a b] |* (c) |* (d) |*');
  });

  it('only offers what the engine gives', () => {
    const items = entryLayout(cards, 's', formations, ['pos:2:c'], { gap: 4, withId: null });
    expect(items.filter((i): i is EntryGap => i.kind === 'gap').every((g) => !g.target)).toBe(true);
    const c = (items[3] as EntryGroup).items[0] as EntryCard;
    expect([c.left, c.right]).toEqual(['pos:2:c', null]);
  });

  it('left between two members of a formation, it stands at the end (as the engine leaves it)', () => {
    const split = ['a', 's', 'b', 'c'].map(card);
    expect(homePlace(split, 's', formations)).toEqual({ gap: 3, withId: null });
    expect(homePlace(['a', 'b', 's', 'c'].map(card), 's', formations)).toEqual({ gap: 2, withId: null });
  });

  describe('where the dragged creature goes', () => {
    // On the screen: a gap, the box of [a b] (padding 9px), a gap, loose c (its room 9px wider each side), a gap
    const row: MeasuredItem[] = [
      { kind: 'gap', target: 'pos:0', left: 0, right: 16 },
      { kind: 'group', boxed: true, left: 16, right: 170, cards: [
        { left: 25, right: 85, leftTarget: null, rightTarget: 'pos:1:a' },
        { left: 101, right: 161, leftTarget: 'pos:1:a', rightTarget: 'pos:2:b' },
      ] },
      { kind: 'gap', target: 'pos:2', left: 170, right: 186 },
      { kind: 'group', boxed: false, left: 186, right: 264, cards: [{ left: 195, right: 255, leftTarget: 'pos:2:c', rightTarget: 'pos:3:c' }] },
      { kind: 'gap', target: 'pos:3', left: 264, right: 280 },
    ];
    const spots = entrySpots(row);
    /** The options met sweeping from x0 to x1, one per change. */
    const sweep = (x0: number, x1: number) => {
      const seen: (string | null)[] = [];
      for (let x = x0; x0 < x1 ? x <= x1 : x >= x1; x += x0 < x1 ? 0.5 : -0.5) {
        const t = spotAt(spots, x);
        if (seen[seen.length - 1] !== t) seen.push(t);
      }
      return seen;
    };

    it('leaves no hole: the padding of a box is its end card side, a gap reaches the next card', () => {
      expect(spotAt(spots, 165)).toBe('pos:2:b');
      expect(spotAt(spots, 172)).toBe('pos:2');
      expect(spotAt(spots, 190)).toBe('pos:2');
      expect(spotAt(spots, 196)).toBe('pos:2:c');
      expect(spotAt(spots, 20)).toBe('pos:0');
      expect(spotAt(spots, 260)).toBe('pos:3');
    });

    it('goes through the places in order when swept across the right edge of a formation, both ways', () => {
      expect(sweep(131, 220)).toEqual(['pos:2:b', 'pos:2', 'pos:2:c']);
      expect(sweep(220, 131)).toEqual(['pos:2:c', 'pos:2', 'pos:2:b']);
      expect(sweep(0, 290)).toEqual(['pos:0', 'pos:1:a', 'pos:2:b', 'pos:2', 'pos:2:c', 'pos:3:c', 'pos:3']);
    });

    it('takes the nearest place where a side gives no link', () => {
      expect(spotAt(spots, 30)).toBe('pos:0');
      expect(spotAt(spots, 80)).toBe('pos:1:a');
      expect(spotAt(spots, 300)).toBe('pos:3');
    });
  });
});
