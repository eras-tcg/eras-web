/** Where the cards being ordered go: the deck's top or its bottom. */
export type OrderEnd = 'top' | 'bottom';

/**
 * A tap on a card while ordering: a card without a number takes the next one; a numbered card loses it and the ones
 * after it move up a place. The first id is number 1.
 */
export function toggleInOrder(order: readonly string[], id: string): string[] {
  return order.includes(id) ? order.filter((x) => x !== id) : [...order, id];
}

/** Every card has its number (only then the order can be sent). */
export function orderComplete(order: readonly string[], ids: readonly string[]): boolean {
  return ids.length > 0 && order.length === ids.length && ids.every((id) => order.includes(id));
}

