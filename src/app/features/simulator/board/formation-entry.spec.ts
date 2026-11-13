import { CardSlot } from '@data/simulator/simulator.model';
import { EntryCard, EntryGap, EntryGroup, entryLayout, homePlace, readPlace } from './formation-entry';

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
});
