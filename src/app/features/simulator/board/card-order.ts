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

/**
 * What number 1 means (null: the player picks the end with the button that sends them). The engine puts the cards in
 * the order given with the first one highest: on top, the first is the next card drawn; at the bottom, the last one is
 * the deck's very last card.
 */
export function orderHint(end: OrderEnd | null): string {
  if (end === 'top') return 'Toca las cartas en orden. La 1 queda en el tope de tu mazo: es la próxima que robas.';
  if (end === 'bottom') return 'Toca las cartas en orden. La 1 queda más arriba y la última, en el fondo de tu mazo.';
  return 'Toca las cartas en orden: la 1 queda más arriba de las que envías.';
}
