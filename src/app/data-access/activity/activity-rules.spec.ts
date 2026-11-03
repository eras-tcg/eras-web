import { describe, expect, it } from 'vitest';
import { ACTIVITY_ACTIONS, ACTIVITY_GROUPS, actionLabel, dayRange, dayValue, describeActivity } from './activity-rules';
import { ActivityEntry } from './activity.model';

const entry = (action: ActivityEntry['action'], detail: ActivityEntry['detail'] = {}): ActivityEntry => ({
  id: 'e1',
  userId: 'u1',
  username: 'ana',
  action,
  detail,
  at: '2026-11-03T12:00:00Z',
});

describe('actionLabel / ACTIVITY_GROUPS', () => {
  it('names every action and shows an unknown one as is', () => {
    expect(actionLabel('DECK_DELETE')).toBe('Mazo borrado');
    expect(actionLabel('NEW_THING')).toBe('NEW_THING');
  });

  it('puts every action in one group, in order', () => {
    expect(ACTIVITY_GROUPS.map((g) => g.name)).toEqual(['Ingresos', 'Tienda', 'Mazos', 'Partidas online', 'Modo solo']);
    expect(ACTIVITY_GROUPS.flatMap((g) => g.options.map((o) => o.value))).toEqual(ACTIVITY_ACTIONS.map((a) => a.action));
  });
});

describe('describeActivity', () => {
  it('describes a purchase', () => {
    expect(describeActivity(entry('SHOP_PURCHASE', { product: 'box', editionId: 'E2', price: 2400 }))).toBe('Booster box · E2 · 2400 gemas');
  });

  it('names the deck', () => {
    expect(describeActivity(entry('DECK_UPDATE', { deckId: 'd1', deckName: 'Rojo agresivo' }))).toBe('Rojo agresivo');
  });

  it('gives the rival and the result of an online game', () => {
    expect(describeActivity(entry('ONLINE_GAME_START', { rival: 'bob' }))).toBe('vs bob');
    expect(describeActivity(entry('ONLINE_GAME_END', { rival: 'bob', result: 'won' }))).toBe('vs bob · ganó');
  });

  it('says nothing more for a login', () => {
    expect(describeActivity(entry('LOGIN'))).toBe('');
  });
});

describe('dayRange / dayValue', () => {
  it('covers the whole of both days, in local time', () => {
    const { from, to } = dayRange('2026-11-01', '2026-11-03');
    expect(new Date(from!).getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(new Date(to!).getTime()).toBe(new Date(2026, 10, 3, 23, 59, 59, 999).getTime());
  });

  it('leaves an empty side open', () => {
    expect(dayRange('', 'x')).toEqual({ from: null, to: null });
  });

  it('writes a date as a date input value', () => {
    expect(dayValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
