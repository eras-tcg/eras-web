import { orderComplete, toggleInOrder } from './card-order';

describe('card order', () => {
  it('numbers a card with the next number, and a numbered card loses it while the rest move up', () => {
    let order = toggleInOrder([], 'a');
    order = toggleInOrder(order, 'c');
    order = toggleInOrder(order, 'b');
    expect(order).toEqual(['a', 'c', 'b']);
    expect(toggleInOrder(order, 'a')).toEqual(['c', 'b']);
    expect(toggleInOrder(['c', 'b'], 'a')).toEqual(['c', 'b', 'a']);
  });

  it('is complete only when every card has its number', () => {
    expect(orderComplete(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(orderComplete(['b', 'c', 'a'], ['a', 'b', 'c'])).toBe(true);
    expect(orderComplete(['a', 'x'], ['a', 'b'])).toBe(false);
    expect(orderComplete([], [])).toBe(false);
  });

});
